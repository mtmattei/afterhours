import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const source=await readFile(new URL('../service/dist/server/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const sql=await readFile(new URL('../service/drizzle/0000_world.sql',import.meta.url),'utf8');
function environment(){
  const db=new DatabaseSync(':memory:');db.exec(sql);
  return {FRONTEND_ORIGIN:'https://play.example.test',DB:{prepare(query){
    let values=[];const statement=db.prepare(query);
    return {bind(...args){values=args;return this;},async first(){return statement.get(...values)||null;},async run(){return {meta:statement.run(...values)};}};
  }}};
}
async function call(env,path,body,token,origin='https://play.example.test'){
  const response=await worker.fetch(new Request('https://service.example.test'+path,{
    method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)
  }),env);return {status:response.status,headers:response.headers,body:await response.json()};
}
test('Worker migration and guest persistence work with actual SQLite',async()=>{
  const env=environment(),a=await call(env,'/api/guest',{name:'Alice'}),b=await call(env,'/api/guest',{name:'Bob'});
  assert.equal(a.status,200);assert.equal(b.status,200);
  const s=await call(env,'/api/state',undefined,a.body.token);
  assert.equal(s.body.peers[0].name,'Bob');assert.equal(s.headers.get('Access-Control-Allow-Origin'),'https://play.example.test');
  assert.equal('auth' in s.body,false);
});
test('Worker compare-and-swap preserves concurrent purchases',async()=>{
  const env=environment(),a=await call(env,'/api/guest',{name:'Alice'}),b=await call(env,'/api/guest',{name:'Bob'});
  const results=await Promise.all([
    call(env,'/api/action',{type:'command',payload:{type:'buy',payload:{type:'plant',id:'plant-a'}}},a.body.token),
    call(env,'/api/action',{type:'command',payload:{type:'buy',payload:{type:'lamp',id:'lamp-b'}}},b.body.token)
  ]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);
  const sa=await call(env,'/api/state',undefined,a.body.token),sb=await call(env,'/api/state',undefined,b.body.token);
  assert.equal(sa.body.game.coins,200);assert.equal(sb.body.game.coins,200);
  assert.ok(sa.body.game.items.some(i=>i.id==='plant-a'));assert.ok(sb.body.game.items.some(i=>i.id==='lamp-b'));
});
test('Worker rejects untrusted origins and missing authentication',async()=>{
  const env=environment();
  assert.equal((await call(env,'/api/state',undefined,undefined,'https://untrusted.example')).status,403);
  assert.equal((await call(env,'/api/state')).status,401);
});
test('Worker enforces guest creation limit',async()=>{
  const env=environment();
  for(let i=0;i<5;i++)assert.equal((await call(env,'/api/guest',{name:'Guest '+i})).status,200);
  assert.equal((await call(env,'/api/guest',{name:'Extra'})).status,429);
});
test('managed identity returns the same saved character after linking and on another device',async()=>{
  const pair=await generateKeyPair('ES256'),key=await exportJWK(pair.publicKey),original=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.equal(String(url),'https://worker-test.supabase.co/auth/v1/.well-known/jwks.json');
    return new Response(JSON.stringify({keys:[{...key,kid:'test',alg:'ES256'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const env={...environment(),SUPABASE_URL:'https://worker-test.supabase.co'};
    const id='62d361cf-b3c5-49cf-9a60-ea49ec2cac01';
    const sign=(anonymous,sub=id)=>new SignJWT({role:'authenticated',is_anonymous:anonymous})
      .setProtectedHeader({alg:'ES256',kid:'test'}).setSubject(sub).setIssuer(env.SUPABASE_URL+'/auth/v1')
      .setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
    const guestToken=await sign(true);
    const guest=await call(env,'/api/guest',{name:'Saved guest'},guestToken);
    assert.equal(guest.status,200);assert.equal(guest.body.token,undefined);
    await call(env,'/api/action',{type:'command',payload:{type:'buy',payload:{type:'plant',id:'kept-plant'}}},guestToken);
    // A newly issued token after Google linking has the same verified subject.
    const recovered=await call(env,'/api/guest',{name:'Do not rename'},await sign(false));
    assert.equal(recovered.body.id,guest.body.id);
    assert.equal(recovered.body.snapshot.game.coins,200);
    assert.ok(recovered.body.snapshot.game.items.some(x=>x.id==='kept-plant'));
    assert.equal(recovered.body.account.anonymous,false);
    const stranger=await call(env,'/api/guest',{name:'Other',id:guest.body.id},await sign(false,'91d361cf-b3c5-49cf-9a60-ea49ec2cac01'));
    assert.notEqual(stranger.body.id,guest.body.id);
    assert.equal(stranger.body.snapshot.game.coins,240);
    assert.equal((await call(env,'/api/state',undefined,'forged')).status,401);
  }finally{globalThis.fetch=original;}
});
test('free playtest caps admission and daily requests without deleting saved progress',async()=>{
  const env={...environment(),MAX_ONLINE:1};
  const first=await call(env,'/api/guest',{name:'First'});
  assert.equal(first.status,200);
  assert.equal((await call(env,'/api/guest',{name:'Second'})).status,503);
  assert.equal((await call(env,'/api/state',undefined,first.body.token)).body.self.id,first.body.id);
  env.MAX_DAILY_REQUESTS=3;
  assert.equal((await call(env,'/api/state',undefined,first.body.token)).status,429);
  env.MAX_DAILY_REQUESTS=100;
  assert.equal((await call(env,'/api/state',undefined,first.body.token)).body.self.id,first.body.id);
});
test('public playtest refuses to open without managed account configuration',async()=>{
  const env={...environment(),PUBLIC_PLAYTEST:'true'};
  assert.equal((await call(env,'/api/guest',{name:'Guest'})).status,503);
});
test('single-origin deployment serves Uno assets without sending API requests to the asset fallback',async()=>{
  let assets=0;
  const env={...environment(),ASSETS:{fetch:async request=>{assets++;return new Response('Uno app');}}};
  assert.equal(await (await worker.fetch(new Request('https://play.example.test/game/account-callback.html'),env)).text(),'Uno app');
  assert.equal((await call(env,'/api/state')).status,401);
  assert.equal(assets,1);
});
