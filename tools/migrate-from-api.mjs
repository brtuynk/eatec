// One-time export of the old Django API (api.eatecconstruction.com) into seed/seed.json + seed/media/.
// Run once while the API is still online:  node tools/migrate-from-api.mjs
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.eatecconstruction.com';
const OUT = new URL('../seed/', import.meta.url).pathname;
const MEDIA = path.join(OUT, 'media');
fs.mkdirSync(MEDIA, { recursive: true });

const get = async (ep, lang) => (await fetch(`${API}/${ep}/${lang === 'hu' ? 'listHu' : 'listEn'}/`)).json();
const download = async (p) => {
  if (!p) return null;
  const url = /^https?:/.test(p) ? p.replace(/^http:/, 'https:') : API + p;
  const name = path.basename(new URL(url).pathname);
  const dest = path.join(MEDIA, name);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return name;
};
// brand logos are SVG files wrapping a base64 PNG: pull the raster out
const extractLogo = async (p, slug) => {
  const url = API + p;
  const svg = await (await fetch(url)).text();
  const m = svg.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error('no raster in ' + p);
  const name = `logo-${slug}.${m[1] === 'jpeg' ? 'jpg' : 'png'}`;
  fs.writeFileSync(path.join(MEDIA, name), Buffer.from(m[2], 'base64'));
  return name;
};

const HU_COUNTRY = { Hungary: 'Magyarország', Germany: 'Németország', Italy: 'Olaszország', Netherlands: 'Hollandia', Belgium: 'Belgium', Slovakia: 'Szlovákia' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const [appEn, appHu, projEn, brandEn, polEn, polHu, homeEn, homeHu, headEn, headHu, contEn, contHu, socEn] = await Promise.all([
  get('application', 'en'), get('application', 'hu'), get('project', 'en'), get('brand', 'en'),
  get('our-policies', 'en'), get('our-policies', 'hu'), get('homepage', 'en'), get('homepage', 'hu'),
  get('header', 'en'), get('header', 'hu'), get('contact', 'en'), get('contact', 'hu'), get('socialmedia', 'en'),
]);

const clean = (t) => t.replace(/\s*https?:\/\/\S+/g, '').replace(/\r/g, '').trim();

const services = [];
for (let i = 0; i < appEn.length; i++) {
  const e = appEn[i], h = appHu[i];
  services.push({
    title_en: e.title, title_hu: h.title === '3D komplex gipszka' ? '3D komplex gipszkarton termékek' : h.title,
    desc_en: clean(e.description), desc_hu: clean(h.description),
    image: await download(e.image),
  });
}
// the 3D product card links to the client's own brand site
const bend = services.find((s) => /3D/.test(s.title_en));
if (bend) { bend.link_url = 'https://www.bendboard.eu'; bend.link_label_en = 'bendboard.eu'; bend.link_label_hu = 'bendboard.eu'; }

const projects = [];
for (const p of projEn) {
  const parts = p.title.split(',').map((x) => x.trim());
  const last = parts.pop();
  const y = last.match(/\((\d{4})\)/);
  const country = last.replace(/\s*\(\d{4}\)/, '').trim();
  projects.push({ name: parts.join(', '), country_en: country, country_hu: HU_COUNTRY[country] || country, year: y ? y[1] : '', image: await download(p.image) });
}

const brands = [];
for (const b of brandEn) brands.push({ name: b.title, image: await extractLogo(b.image, slug(b.title)) });

const policies = polEn.map((e, i) => ({
  title_en: e.title, title_hu: { 'KÖRNYEZETVÉDELEM': 'Környezetvédelem' }[polHu[i].title] || polHu[i].title,
  body_en: e.description.replace(/\r/g, '').trim(), body_hu: polHu[i].description.replace(/\r/g, '').trim(),
}));

const settings = {
  hero_image: await download(headEn[0].image),
  corp_image: await download(homeEn[0].image),
  corp_text: { en: homeEn[0].description.replace(/\s+/g, ' ').trim(), hu: homeHu[0].description.replace(/\s+/g, ' ').trim() },
  address: { en: contEn[0].address, hu: contHu[0].address },
  email: contEn[0].email,
  phone: contEn[0].phone || '',
  social: { facebook: socEn[0]?.facebook || '', twitter: socEn[0]?.twitter || '', instagram: socEn[0]?.instagram || '', linkedin: socEn[0]?.linkedin || '' },
};
if (headEn[0].title) settings.hero_title = { en: headEn[0].title, hu: headHu[0].title || '' };
if (headEn[0].description) settings.hero_sub = { en: headEn[0].description, hu: headHu[0].description || '' };

fs.writeFileSync(path.join(OUT, 'seed.json'), JSON.stringify({ services, projects, brands, policies, settings }, null, 2));
console.log(`services ${services.length}, projects ${projects.length}, brands ${brands.length}, policies ${policies.length}`);
