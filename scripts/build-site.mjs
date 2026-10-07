import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const destination = resolve('dist/site');
rmSync(destination, { recursive: true, force: true });
mkdirSync(resolve(destination, 'assets'), { recursive: true });
copyFileSync('site/index.html', resolve(destination, 'index.html'));
copyFileSync('assets/housingproof-hero.svg', resolve(destination, 'assets/housingproof-hero.svg'));
writeFileSync(resolve(destination, '.nojekyll'), '');
console.log('Built the static project overview in dist/site. No API, sources, keys, or proving artifacts included.');
