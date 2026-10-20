import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initialWorld,createGuest,authenticate,action,snapshot,tick} from './session-core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4176),dataDir=process.env.AFTERHOURS_DATA||path.join(root,'local-data');
fs.mkdirSync(dataDir,{recursive:true});const file=path.join(dataDir,'world.json');let db;
try{db=JSON.parse(fs.readFileSync(file,'utf8'));}catch{db=initialWorld();}
const save=()=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,file);};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.json':'application/json','.dat':'application/octet-stream','.dll':'application/octet-stream','.br':'application/octet-stream'};
let queue=Promise.resolve();const rates=new Map();
function rate(req){const ip=req.socket.remoteAddress,now=Date.now(),entry=rates.get(ip)||{count:0,time:now};if(now-entry.time>60000){entry.count=0;entry.time=now;}entry.count++;rates.set(ip,entry);if(entry.count>1800)throw Error('Too many requests. Please wait a moment.');}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const part of req){text+=part;if(text.length>250000)throw Error('Request is too large.');}return text?JSON.parse(text):{};}
async function api(req,res,url){
  rate(req);
  if(url.pathname==='/api/health'){json(res,200,{ok:true,world:'Afterhours',version:5});return;}
  if(req.method==='POST'&&url.pathname==='/api/guest'){
    const input=await body(req),guest=await createGuest(db,input);save();json(res,200,{...guest,snapshot:snapshot(db,db.users[guest.id])});return;
  }
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  const user=await authenticate(db,token);user.lastSeen=Date.now();tick(db);
  if(url.pathname==='/api/state'){json(res,200,snapshot(db,user));return;}
  if(url.pathname==='/api/action'&&req.method==='POST'){
    const payload=await body(req);const result=action(db,user,payload.type,payload.payload);save();json(res,200,{result,snapshot:snapshot(db,user)});return;
  }
  json(res,404,{error:'Not found.'});
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
    const task=queue.then(()=>api(req,res,url));queue=task.catch(()=>{});
    try{await task;}catch(e){if(!res.headersSent)json(res,/session expired/.test(e.message)?401:400,{error:e.message});}return;
  }
  let relative;
  try{relative=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
  if(relative==='/')relative='/index.html';
  const base=path.resolve(process.env.AFTERHOURS_STATIC||path.join(root,'dist')),target=path.resolve(base,'.'+relative);
  if(!target.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{const stat=fs.statSync(target);if(!stat.isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(target).pipe(res);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Afterhours is ready at http://127.0.0.1:${port}`));
const interval=setInterval(()=>{const rev=db.revision;tick(db);if(db.revision!==rev)save();},1000);
function stop(){clearInterval(interval);save();server.close(()=>process.exit(0));}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
