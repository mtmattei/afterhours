import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const release=path.join(root,'release/uno');
const webroot=fs.existsSync(path.join(release,'wwwroot/index.html'))?path.join(release,'wwwroot'):release;
if(!fs.existsSync(path.join(webroot,'index.html')))throw Error('Build the Uno app first: npm run build:uno');
process.env.AFTERHOURS_STATIC=webroot;
await import('../server.mjs');
