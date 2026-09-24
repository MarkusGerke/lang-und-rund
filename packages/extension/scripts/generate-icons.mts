import { createCanvas } from 'node:canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(dir, { recursive: true });

function makeIcon(size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = Math.max(2, Math.round(size * 0.18));
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fffdf9';
  ctx.font = `600 ${Math.round(size * 0.62)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ſ', size / 2, size / 2 + size * 0.04);
  return canvas.toBuffer('image/png');
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(dir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png`);
}
