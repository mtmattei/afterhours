import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
await build({entryPoints: [path.join(root, 'client/accounts.mjs')], outfile: path.join(root, 'dist/accounts.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof'});
console.log('Built browser account support.');
