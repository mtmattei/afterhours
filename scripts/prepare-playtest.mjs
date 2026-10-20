import {cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyUnoRelease} from './verify-uno.mjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const at=arg.indexOf('=');if(at<3)throw Error('Use --name=value arguments.');
  return [arg.slice(2,at),arg.slice(at+1)];
}));
for(const key of ['origin','supabase-url','publishable-key','turnstile-site-key','database-id'])
  if(!args[key])throw Error(`Missing --${key}=value. See PLAYTEST-SETUP.md.`);
function origin(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('Use an HTTPS origin without a path.');
  return url.origin;
}
const frontend=origin(args.origin),supabase=origin(args['supabase-url']);
if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(args['publishable-key']))throw Error('Use a Supabase publishable key. Never supply a secret or service-role key.');
if(!/^[a-f0-9-]{36}$/i.test(args['database-id']))throw Error('Use the D1 database UUID.');
const {webroot,packageName}=await verifyUnoRelease(path.join(root,'release/uno'));
await readFile(path.join(root,'service/dist/server/index.js'));
await mkdir(path.join(root,'release'),{recursive:true});
const destination=await mkdtemp(path.join(root,'release/playtest-'));
await cp(webroot,destination,{recursive:true,filter:source=>{
  const first=path.relative(webroot,source).split(path.sep)[0];
  return !first.startsWith('package_')||first===packageName;
}});
const config={url:supabase,publishableKey:args['publishable-key'],turnstileSiteKey:args['turnstile-site-key'],returnTo:'/',googleInviteOnly:true};
await writeFile(path.join(destination,'game/runtime-config.js'),
  `window.AFTERHOURS_API=${JSON.stringify(frontend)};\nwindow.AFTERHOURS_AUTH=${JSON.stringify(config)};\n`);
await writeFile(path.join(destination,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n/game/runtime-config.js\n  Cache-Control: no-store\n/game/account-callback.html\n  Cache-Control: no-store\n/game/account-callback.js\n  Cache-Control: no-store\n`);
for(const file of await readdir(destination,{recursive:true,withFileTypes:true})){
  if(file.isFile()&&(await stat(path.join(file.parentPath,file.name))).size>25*1024*1024)
    throw Error(`Cloudflare's asset limit is 25 MiB: ${file.name}`);
}
await writeFile(path.join(root,'service/wrangler.json'),JSON.stringify({
  $schema:'../node_modules/wrangler/config-schema.json',
  name:'afterhours-playtest',main:'worker/cloudflare.mjs',compatibility_date:'2026-10-20',
  durable_objects:{bindings:[{name:'WORLD',class_name:'SharedWorld'}]},
  migrations:[{tag:'v1-world-coordinator',new_sqlite_classes:['SharedWorld']}],
  assets:{directory:path.relative(path.join(root,'service'),destination).replaceAll('\\','/'),binding:'ASSETS',run_worker_first:['/api/*']},
  vars:{FRONTEND_ORIGIN:frontend,SUPABASE_URL:supabase,PUBLIC_PLAYTEST:'true',MAX_ONLINE:'5',MAX_CHARACTERS:'100',MAX_DAILY_REQUESTS:'12000'},
  d1_databases:[{binding:'DB',database_name:'afterhours-playtest',database_id:args['database-id'],migrations_dir:'drizzle'}]
},null,2)+'\n');
console.log(`Prepared Uno playtest assets at ${destination}\nConfiguration: service/wrangler.json\nNo resources were created and nothing was deployed.`);
