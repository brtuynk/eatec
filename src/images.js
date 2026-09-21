import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { paths } from './config.js';
import { db } from './db.js';

// Photos are stored as "<hash>|480,960,1600": the widths that exist on disk as <hash>-<w>.webp.
// Logos are stored as "<hash>-logo.png": white artwork on transparent, so they read on the dark theme.
const WIDTHS = [480, 960, 1600];
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);

export async function savePhoto(buf) {
  const base = hash(buf);
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const srcW = meta.width || 1600;
  const widths = [...new Set([...WIDTHS.filter((w) => w < srcW), Math.min(srcW, WIDTHS.at(-1))])].sort((a, b) => a - b);
  for (const w of widths) {
    await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(paths.uploads, `${base}-${w}.webp`));
  }
  return `${base}|${widths.join(',')}`;
}

// Logos are expected to be dark artwork on a light or transparent background.
export async function saveLogo(buf) {
  const base = hash(buf);
  const flat = sharp(buf, { failOn: 'none' }).flatten({ background: '#ffffff' }).trim({ threshold: 25 }).grayscale();
  const { data, info } = await flat.clone().resize({ height: 160, withoutEnlargement: true }).negate().raw().toBuffer({ resolveWithObject: true });
  const out = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
    .joinChannel(data, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  const name = `${base}-logo.png`;
  fs.writeFileSync(path.join(paths.uploads, name), out);
  return name;
}

// Identical uploads share files (names come from a content hash), so only delete when nothing else still uses them.
function inUse(value) {
  for (const t of ['services', 'projects', 'brands']) if (db.prepare(`SELECT 1 FROM ${t} WHERE image = ? LIMIT 1`).get(value)) return true;
  return !!db.prepare('SELECT 1 FROM settings WHERE value = ? LIMIT 1').get(value);
}
// Call this AFTER the database no longer points at the image.
export function deleteImage(value) {
  if (!value || inUse(value)) return;
  try {
    if (value.endsWith('-logo.png')) return fs.rmSync(path.join(paths.uploads, value), { force: true });
    const [base, w] = value.split('|');
    for (const x of (w || '').split(',')) fs.rmSync(path.join(paths.uploads, `${base}-${x}.webp`), { force: true });
  } catch { /* file already gone */ }
}

const parse = (value) => { const [base, w] = value.split('|'); return { base, widths: (w || '').split(',').map(Number).filter(Boolean) }; };

export const imgUrl = (value, width) => {
  if (!value) return '';
  if (value.endsWith('-logo.png')) return `/uploads/${value}`;
  const { base, widths } = parse(value);
  const w = width ? (widths.find((x) => x >= width) || widths.at(-1)) : widths.at(-1);
  return `/uploads/${base}-${w}.webp`;
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function imgTag(value, { alt = '', sizes = '100vw', cls = '', eager = false, id = '' } = {}) {
  if (!value) return '';
  const attrs = `${cls ? ` class="${cls}"` : ''}${id ? ` id="${id}"` : ''} alt="${esc(alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}`;
  if (value.endsWith('-logo.png')) return `<img src="/uploads/${value}"${attrs}>`;
  const { base, widths } = parse(value);
  const src = `/uploads/${base}-${widths.at(-1)}.webp`;
  const srcset = widths.map((w) => `/uploads/${base}-${w}.webp ${w}w`).join(', ');
  return `<img src="${src}" srcset="${srcset}" sizes="${sizes}"${attrs}>`;
}
