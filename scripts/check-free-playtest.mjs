// Bounded remote checks against a disposable Worker/D1, never the public game.
// Test identities use a dedicated ES256 issuer. They cannot log into production.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {initialWorld,createGuest} from '../session-core.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const directory=path.join(root,'.build-cache/playtest-check');
const [mode,...flags]=process.argv.slice(2);
const args=Object.fromEntries(flags.map(value=>{const at=value.indexOf('=');return [value.slice(2,at),value.slice(at+1)];}));
const origin=args.origin||'https://afterhours-check.matthewtmattei.workers.dev';
const url=new URL(origin);
assert.equal(url.protocol,'https:');
assert.match(url.hostname,/^afterhours-check\.[a-z0-9-]+\.workers\.dev$/);
assert.equal(url.origin,origin,'Use only the disposable test origin, without a path.');
const issuer=origin.replace('://afterhours-check.', '://afterhours-check-identity.');
const save=(name,data)=>writeFile(path.join(directory,name),data);
await mkdir(directory,{recursive:true});
if(mode==='prepare'){
  assert.match(args['database-id']||'',/^[a-f0-9-]{36}$/i);
  const pair=await generateKeyPair('ES256'),key=await exportJWK(pair.publicKey);
  const jwks={keys:[{...key,kid:'isolated-check',alg:'ES256'}]};
  const world=initialWorld();world.identities={};const actors=[];
  const sign=(id,expiry='2h')=>new SignJWT({role:'authenticated',is_anonymous:false})
    .setProtectedHeader({alg:'ES256',kid:'isolated-check'}).setSubject(id)
    .setIssuer(issuer+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime(expiry).sign(pair.privateKey);
  for(let i=0;i<100;i++){
    const guest=await createGuest(world,{name:'Check '+(i+1)},0),identity=crypto.randomUUID();
    world.identities[identity]=guest.id;
    if(i<6)actors.push({id:guest.id,identity,token:await sign(identity)});
  }
  world.auth={};
  const body=JSON.stringify(world),quote=value=>"'"+value.replaceAll("'","''")+"'";
  const chunks=body.match(/[\s\S]{1,8000}/g);
  const sql=await readFile(path.join(root,'service/drizzle/0000_world.sql'),'utf8');
  await save('seed.sql',sql+"\nDELETE FROM world_state; DELETE FROM request_limits;\nINSERT INTO world_state VALUES('main',0,'');\n"+chunks.map(chunk=>"UPDATE world_state SET body=body||"+quote(chunk)+" WHERE id='main';").join('\n')+'\n');
  await save('identities.json',JSON.stringify({origin,issuer,actors,newToken:await sign(crypto.randomUUID()),expired:await sign(actors[0].identity,1)},null,2));
  await save('issuer.mjs',`export default {fetch(request){return new URL(request.url).pathname==='/auth/v1/.well-known/jwks.json'?Response.json(${JSON.stringify(jwks)}):new Response('Isolated test public key service',{status:404});}};\n`);
  await save('issuer-wrangler.json',JSON.stringify({name:'afterhours-check-identity',main:'issuer.mjs',compatibility_date:'2026-10-20'},null,2));
  await save('worker.mjs',`import game from '../../service/dist/server/index.js';
import entry,{SharedWorld as Coordinator} from '../../service/worker/cloudflare.mjs';
export default entry;
export class SharedWorld extends Coordinator {async handle(request){
  const env=this.env;
  const metric={reads:0,writes:0,queries:0};
  const record=r=>{metric.reads+=r.meta?.rows_read||0;metric.writes+=r.meta?.rows_written||0;metric.queries++;return r;};
  const DB={prepare(sql){const wrap=statement=>({bind(...v){return wrap(statement.bind(...v));},async first(){return record(await statement.all()).results[0]||null;},async run(){return record(await statement.run());}});return wrap(env.DB.prepare(sql));}};
  const started=Date.now();const result=await game.fetch(request,{...env,DB});
  const response=new Response(result.body,result);for(const [key,value] of Object.entries(metric))response.headers.set('x-check-'+key,String(value));
  response.headers.set('x-check-wall-ms',String(Date.now()-started));return response;
}}\n`);
  await save('wrangler.json',JSON.stringify({name:'afterhours-check',main:'worker.mjs',compatibility_date:'2026-10-20',compatibility_flags:['global_fetch_strictly_public'],
    durable_objects:{bindings:[{name:'WORLD',class_name:'SharedWorld'}]},migrations:[{tag:'v1-world-coordinator',new_sqlite_classes:['SharedWorld']}],
    observability:{enabled:true},vars:{FRONTEND_ORIGIN:origin,SUPABASE_URL:issuer,PUBLIC_PLAYTEST:'true',MAX_ONLINE:'5',MAX_CHARACTERS:'100',MAX_DAILY_REQUESTS:'12000'},
    d1_databases:[{binding:'DB',database_name:'afterhours-check',database_id:args['database-id']}]},null,2));
  console.log(JSON.stringify({prepared:true,origin,characters:100,worldBytes:Buffer.byteLength(body),directory}));
}else if(mode==='run'){
  const credentials=JSON.parse(await readFile(path.join(directory,'identities.json'),'utf8'));
  assert.equal(credentials.origin,origin);
  const {actors}=credentials,requests=[],checks=[];
  let count=0;
  async function call(actor,route='/api/state',body,expected=200){
    assert.ok(++count<=2200,'Bounded test request budget reached');
    const started=performance.now();
    const response=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+(typeof actor==='string'?actor:actors[actor].token)},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={error:text.slice(0,160)};}
    requests.push({status:response.status,ms:Math.round(performance.now()-started),reads:Number(response.headers.get('x-check-reads')),writes:Number(response.headers.get('x-check-writes')),queries:Number(response.headers.get('x-check-queries')),wallMs:Number(response.headers.get('x-check-wall-ms'))});
    if(expected!==null)assert.equal(response.status,expected,`${route}: ${JSON.stringify(data.error||data)}`);
    return {data,status:response.status};
  }
  const action=(actor,type,payload={},expected=200)=>call(actor,'/api/action',{type,payload},expected);
  const command=(actor,type,payload)=>action(actor,'command',{type,payload});
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    await call('invalid',undefined,undefined,401);await call(credentials.expired,undefined,undefined,401);checks.push('invalid and expired identities rejected');
    const full=await call(credentials.newToken,'/api/guest',{name:'Overflow'},503);assert.match(full.data.error,/guest playtest is full/);checks.push('100-character admission cap');
    const admitted=await Promise.all(actors.slice(0,5).map((_,i)=>call(i)));
    assert.deepEqual(admitted.map(x=>x.data.self.id),actors.slice(0,5).map(x=>x.id));
    const sixth=await call(5,undefined,undefined,503);assert.match(sixth.data.error,/full right now/);checks.push('five concurrent players; sixth refused');
    const resumed=await call(0,'/api/guest',{name:'Do not replace'});assert.equal(resumed.data.id,actors[0].id);checks.push('new signed session retains character');
    await Promise.all(actors.slice(0,5).map((_,i)=>command(i,'buy',{type:i===1?'lamp':'plant',id:'check-item-'+i})));
    for(let i=0;i<5;i++){const {data}=await call(i);assert.equal(data.game.coins,200);assert.equal(data.game.items.filter(x=>x.id==='check-item-'+i).length,1);}checks.push('concurrent purchases retain every item and balance');
    await action(0,'seat',{id:'lounge-0-0',point:[200,400]});await action(1,'seat',{id:'lounge-0-0',point:[200,400]},400);await action(0,'stand');checks.push('exclusive seat ownership');
    await action(0,'chat',{text:'check-private',mode:'whisper',to:actors[1].id});
    assert.ok((await call(1)).data.chats.some(x=>x.text==='check-private'));
    assert.ok(!(await call(2)).data.chats.some(x=>x.text==='check-private'));checks.push('whisper privacy');
    await action(0,'friend',{user:actors[1].id});await action(1,'answerFriend',{user:actors[0].id,accept:true});checks.push('friend request acceptance');
    const trade=(await action(0,'trade',{user:actors[1].id})).data.result.id;
    await action(1,'tradeAccept',{id:trade});await action(0,'tradeOffer',{id:trade,items:['check-item-0']});await action(1,'tradeOffer',{id:trade,items:['check-item-1']});
    await action(0,'tradeConfirm',{id:trade});assert.ok((await call(0)).data.game.items.some(x=>x.id==='check-item-0'));
    await action(1,'tradeConfirm',{id:trade});await action(0,'tradeConfirm',{id:trade},400);
    for(let i=0;i<2;i++){const items=(await call(i)).data.game.items;assert.equal(items.filter(x=>x.id==='check-item-'+(1-i)).length,1);assert.ok(!items.some(x=>x.id==='check-item-'+i));}checks.push('two-party trade, replay protection and persistent ownership');
    await command(0,'song',{id:'check-track',title:'Load check',pattern:[[1],[1],[1],[1]]});await action(0,'queue',{song:'check-track'});
    const duration=Math.min(90,Math.max(25,Number(args.seconds)||60))*1000,start=performance.now();
    const loadStart=requests.length;let networkResets=0;
    await Promise.all(actors.slice(0,5).map(async(_,i)=>{
      let step=0;
      while(performance.now()-start<duration){
        const before=performance.now();
        let result;
        try{result=step%5===0?await call(i,undefined,undefined,null):await action(i,'pose',{x:5.5+Math.sin(step/8)*.4,y:5.5+Math.cos(step/8)*.4,avatar:i},null);}
        catch(error){
          // A dropped connection can lose a response after its save. Only state
          // and absolute pose updates are safe to repeat; never retry purchases.
          if(error.cause?.code!=='ECONNRESET'||++networkResets>3)throw error;
          await delay(1000);continue;
        }
        if(result.status!==200)throw Error(`load response ${result.status}: ${result.data.error}`);
        step++;await delay(Math.max(0,250-(performance.now()-before)));
      }
    }));
    const load=requests.slice(loadStart);checks.push('five-client sustained motion and state load');
    const final=(await call(0)).data;assert.equal(final.game.coins,240);assert.ok(final.game.songs.some(s=>s.id==='check-track'));checks.push('shared performance reward exactly once');
    const sorted=load.map(x=>x.ms).sort((a,b)=>a-b),q=p=>sorted[Math.floor((sorted.length-1)*p)];
    const report={ok:true,checks,origin,seedCharacters:100,concurrentClients:5,durationSeconds:Math.round(duration/1000),loadRequests:load.length,totalRequests:requests.length,networkResets,latencyMs:{p50:q(.5),p95:q(.95),p99:q(.99),max:sorted.at(-1)},rowsRead:requests.reduce((n,r)=>n+r.reads,0),rowsWritten:requests.reduce((n,r)=>n+r.writes,0),queries:requests.reduce((n,r)=>n+r.queries,0),maxQueries:Math.max(...requests.map(r=>r.queries)),statuses:Object.fromEntries([...new Set(requests.map(r=>r.status))].map(s=>[s,requests.filter(r=>r.status===s).length]))};
    await save('report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }catch(error){await save('failure.json',JSON.stringify({error:error.message,checks,requests},null,2)+'\n');throw error;}
}else throw Error('Use prepare --database-id=UUID, then run --seconds=60. See PLAYTEST-SETUP.md.');
