// Generates icon-16.png, icon-48.png, icon-128.png from public/icons/logo.svg
// Run once after changing the logo: node scripts/make-icons.mjs

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src  = resolve(root, 'public/icons/logo.svg');
const out  = resolve(root, 'public/icons');

mkdirSync(out, { recursive: true });

for (const size of [16, 48, 128]) {
  const dest = resolve(out, `icon-${size}.png`);
  await sharp(src).resize(size, size).png().toFile(dest);
  console.log(`✓ public/icons/icon-${size}.png`);
}

console.log('\nDone — run npm run build to include the icons in dist/');
