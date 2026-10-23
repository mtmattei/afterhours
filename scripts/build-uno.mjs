import './build-client.mjs';
import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {scopeCss} from './scope-css.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyUnoRelease} from './verify-uno.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const app=path.join(root,'uno/Afterhours.Uno'),cache=path.join(root,'.build-cache');
await mkdir(path.join(cache,'temp'),{recursive:true});
const game=path.join(app,'Platforms/WebAssembly/wwwroot/game');
await cp(path.join(root,'dist'),game,{recursive:true});
// The hosted game shares the page with Uno, so its stylesheets are scoped under .ah-root.
const sheets=await Promise.all(['style','game','room-view','wardrobe'].map(name=>readFile(path.join(root,'dist',name+'.css'),'utf8')));
await writeFile(path.join(game,'scoped.css'),scopeCss(sheets.join('\n')));
const env={...process.env,TEMP:path.join(cache,'temp'),TMP:path.join(cache,'temp'),MSBUILDDISABLENODEREUSE:'1'};
if(process.argv.includes('--in-process'))env.AfterhoursUseInProcessUnoTasks='true';
// A publish over an older one can keep the previous dotnet boot script; start from an empty folder.
await rm(path.join(root,'release/uno'),{recursive:true,force:true});
const result=spawnSync('dotnet',['publish','-f','net10.0-browserwasm','-c','Release','-o',path.join(root,'release/uno'),'--disable-build-servers'],{cwd:app,env,stdio:'inherit',shell:false});
if (result.status !== 0) process.exit(result.status??1);
await verifyUnoRelease(path.join(root,'release/uno'));
