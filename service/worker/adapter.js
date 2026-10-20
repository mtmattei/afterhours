// The complete world commits through a revision compare-and-swap. This bounded
// playtest service favors atomic trades over sharding. Scale rooms before launch.
import {verifyIdentity} from './identity.mjs';
const fault=(message,status)=>Object.assign(Error(message),{status});
const bounded=(value,fallback,max)=>Math.min(max,Math.max(1,Math.floor(Number(value)||fallback)));
function admit(db,id,env){
  const active=Object.values(db.users).filter(u=>u.id!==id&&Date.now()-u.lastSeen<20000).length;
  if(active>=bounded(env.MAX_ONLINE,5,10))throw fault('The playtest is full right now. Your character is safe; try again shortly.',503);
}
async function dailyBudget(DB,maximum){
  const day=Math.floor(Date.now()/86400000),key='daily-budget';
  const current=await DB.prepare('SELECT window,count FROM request_limits WHERE id=?').bind(key).first();
  if(current?.window===day&&current.count>=maximum)throw fault('Today’s free playtest allowance is used up. Saved progress is safe. Please return after midnight UTC.',429);
  const row=await DB.prepare(`INSERT INTO request_limits(id,window,count) VALUES(?,?,1)
    ON CONFLICT(id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
    window=excluded.window RETURNING count`).bind(key,day).first();
  if(row.count>maximum)throw fault('Today’s free playtest allowance is used up. Saved progress is safe. Please return after midnight UTC.',429);
}
const developmentOrigins=new Set([
  'http://127.0.0.1:4176','http://localhost:4176'
]);
function response(data,status=200,origin=''){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    ...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})
  }});
}
async function limit(DB,key,max){
  const window=Math.floor(Date.now()/60000);
  const row=await DB.prepare(`INSERT INTO request_limits(id,window,count) VALUES(?,?,1)
    ON CONFLICT(id) DO UPDATE SET
      count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
      window=excluded.window RETURNING count`).bind(key,window).first();
  if(row.count>max)throw fault('Too many requests. Please wait a moment.',429);
}
async function transact(DB,work){
  await DB.prepare('INSERT OR IGNORE INTO world_state(id,revision,body) VALUES(?,?,?)').bind('main',0,JSON.stringify(initialWorld())).run();
  for(let attempt=0;attempt<6;attempt++){
    const row=await DB.prepare('SELECT revision,body FROM world_state WHERE id=?').bind('main').first();
    const db=JSON.parse(row.body),out=await work(db);
    const body=JSON.stringify(db);
    if(new TextEncoder().encode(body).byteLength>1700000)throw Error('The playtest world is full. Please contact the host.');
    const saved=await DB.prepare('UPDATE world_state SET revision=?,body=? WHERE id=? AND revision=?')
      .bind(row.revision+1,body,'main',row.revision).run();
    if(saved.meta.changes===1)return out;
  }
  throw Error('The room is busy. Please try again.');
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin')||'';
    if(!url.pathname.startsWith('/api/')&&env.ASSETS)return env.ASSETS.fetch(request);
    const allowedOrigins=new Set(developmentOrigins);
    if(env.FRONTEND_ORIGIN){try{const configured=new URL(env.FRONTEND_ORIGIN);if(configured.protocol==='https:')allowedOrigins.add(configured.origin);}catch{}}
    if(request.method==='OPTIONS'){
      if(!allowedOrigins.has(origin))return response({error:'Origin not allowed.'},403);
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
    }
    if(origin&&!allowedOrigins.has(origin))return response({error:'Origin not allowed.'},403);
    if(url.pathname==='/api/health')return response({ok:!!env.DB,world:'Afterhours',version:5,
      accounts:env.SUPABASE_URL?'supabase':'browser',maxOnline:bounded(env.MAX_ONLINE,5,10)},200,origin);
    if(url.pathname==='/')return response({world:'Afterhours shared playtest service',status:'ready',privacy:'Guest character data, chat and reports persist on this service. This is a limited playtest.'},200,origin);
    if(!['GET','POST'].includes(request.method))return response({error:'Method not allowed.'},405,origin);
    try{
      if(!env.DB)throw Error('The shared world database has not been connected.');
      if(env.PUBLIC_PLAYTEST==='true'&&!env.SUPABASE_URL)throw fault('Account recovery must be configured before this playtest opens.',503);
      if(!['/api/guest','/api/state','/api/action'].includes(url.pathname))return response({error:'Not found.'},404,origin);
      await dailyBudget(env.DB,bounded(env.MAX_DAILY_REQUESTS,12000,12000));
      const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
      let identity=null;
      if(env.SUPABASE_URL){
        try{identity=await verifyIdentity(token,env.SUPABASE_URL);}
        catch{throw fault('Your account could not be verified. Sign in again to continue your saved character.',401);}
      }
      let input={};
      if(request.method==='POST'){
        if(Number(request.headers.get('Content-Length')||0)>100000)throw Error('Request is too large.');
        const reader=request.body?.getReader();let size=0,chunks=[];
        if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();throw Error('Request is too large.');}chunks.push(value);}
        const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
        input=JSON.parse(new TextDecoder().decode(bytes)||'{}');
      }
      if(url.pathname==='/api/guest'&&request.method==='POST'){
        await limit(env.DB,'guest:'+await hash(request.headers.get('CF-Connecting-IP')||'unknown'),5);
        const result=await transact(env.DB,async db=>{
          if(identity){
            db.identities||={};
            const id=db.identities[identity.id];
            if(id&&db.users[id]){
              admit(db,id,env);db.users[id].lastSeen=Date.now();tick(db);
              return {id,snapshot:snapshot(db,db.users[id]),account:{anonymous:identity.anonymous}};
            }
          }
          admit(db,null,env);
          if(Object.keys(db.users).length>=bounded(env.MAX_CHARACTERS,100,100))throw fault('The guest playtest is full. Existing characters can still return.',503);
          const guest=await createGuest(db,input);
          if(identity){
            db.identities[identity.id]=guest.id;
            delete db.auth[await hash(guest.token)];
            return {id:guest.id,snapshot:snapshot(db,db.users[guest.id]),account:{anonymous:identity.anonymous}};
          }
          return {...guest,snapshot:snapshot(db,db.users[guest.id])};
        });return response(result,200,origin);
      }
      if(!['/api/state','/api/action'].includes(url.pathname))return response({error:'Not found.'},404,origin);
      if(!identity&&!/^[0-9a-f]{64}$/.test(token))return response({error:'Your session expired. Sign in again to recover your character.'},401,origin);
      await limit(env.DB,'player:'+await hash(identity?.id||token),420);
      const result=await transact(env.DB,async db=>{
        const user=identity?db.users[db.identities?.[identity.id]]:await authenticate(db,token);
        if(!user)throw fault('Join the shared world to set up this account’s character.',404);
        admit(db,user.id,env);user.lastSeen=Date.now();tick(db);
        if(url.pathname==='/api/state'&&request.method==='GET')return snapshot(db,user);
        if(url.pathname==='/api/action'&&request.method==='POST'){
          const result=action(db,user,input.type,input.payload);
          return {result,snapshot:snapshot(db,user)};
        }
        throw Error('Method not allowed.');
      });return response(result,200,origin);
    }catch(error){
      const message=error instanceof Error?error.message:'The shared world could not be reached.';
      const safe=/session expired|too many|Too many|playtest|Request is too|busy|database has not/.test(message)||!message.includes('D1');
      return response({error:safe?message:'The world could not save. Please try again.'},error.status||(/session expired/.test(message)?401:400),origin);
    }
  }
};
