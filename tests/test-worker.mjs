import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
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
  assert.equal((await call(env,'/api/guest',{name:'Extra'})).status,400);
});
