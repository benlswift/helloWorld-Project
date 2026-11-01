import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const output = join(resolve(process.argv[2] || join(source, '../outreach-hub')), 'experimental-event');
await mkdir(output, { recursive: true });
await build({
  entryPoints: [join(source, 'main.tsx')],
  outfile: join(output, 'event.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: 'preact',
});
await copyFile(join(source, 'index.html'), join(output, 'index.html'));
