import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const game=path.resolve(root,'..');
const read=p=>readFile(p,'utf8');
const wrap=(name,source)=>`const ${name}=(()=>{const module={exports:{}};\n${source}\nreturn module.exports;})();\n`;
const core=(await read(path.join(game,'session-core.mjs'))).replace(/^import .+;\r?\n/gm,'').replace(/^export /gm,'');
const source=wrap('F',await read(path.join(game,'dist/furniture.js')))+wrap('G',(await read(path.join(game,'dist/game-core.js'))).replace("require('./furniture.js')",'F'))+core+'\n'+await read(path.join(root,'worker/adapter.js'));
await mkdir(path.join(root,'dist/server'),{recursive:true});
await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await mkdir(path.join(root,'dist/drizzle'),{recursive:true});
await build({stdin:{contents:source,resolveDir:path.join(root,'worker'),sourcefile:'world-worker.mjs'},
  outfile:path.join(root,'dist/server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
await copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
await copyFile(path.join(root,'drizzle/0000_world.sql'),path.join(root,'dist/drizzle/0000_world.sql'));
console.log('Built portable shared-world Worker with D1 migration.');
