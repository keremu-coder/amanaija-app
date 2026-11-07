import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const maplibrePackageJson = require.resolve('maplibre-gl/package.json', { paths: [appRoot] });
const maplibreDist = path.join(path.dirname(maplibrePackageJson), 'dist');
const publicDir = path.join(appRoot, 'public', 'maplibre');

mkdirSync(publicDir, { recursive: true });

const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

for (const file of files) {
  const source = path.join(maplibreDist, file);
  if (!existsSync(source)) {
    throw new Error('Could not find maplibre file: ' + source);
  }
  const destination = path.join(publicDir, file);
  copyFileSync(source, destination);
  console.log('Copied ' + file + ' to public/maplibre/');
}
