import fs from 'node:fs';
import path from 'node:path';
import { db, setSetting } from './db.js';
import { paths } from './config.js';
import { savePhoto, saveLogo } from './images.js';

// First boot only: fill an empty database from seed/seed.json (exported from the old API) and its media files.
export async function seedIfEmpty() {
  const empty = ['services', 'projects', 'brands', 'policies'].every((t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c === 0)
    && db.prepare('SELECT COUNT(*) c FROM settings').get().c === 0;
  const file = path.join(paths.seed, 'seed.json');
  if (!empty || !fs.existsSync(file)) return false;

  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cache = new Map();
  const photo = async (name) => {
    if (!name) return '';
    if (!cache.has(name)) cache.set(name, await savePhoto(fs.readFileSync(path.join(paths.seed, 'media', name))));
    return cache.get(name);
  };

  let i = 0;
  for (const s of seed.services) {
    db.prepare(`INSERT INTO services (sort,title_en,title_hu,desc_en,desc_hu,image,link_url,link_label_en,link_label_hu) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(++i, s.title_en, s.title_hu, s.desc_en, s.desc_hu, await photo(s.image), s.link_url || '', s.link_label_en || '', s.link_label_hu || '');
  }
  i = 0;
  for (const p of seed.projects) {
    db.prepare(`INSERT INTO projects (sort,name,country_en,country_hu,year,image) VALUES (?,?,?,?,?,?)`)
      .run(++i, p.name, p.country_en, p.country_hu, p.year || '', await photo(p.image));
  }
  i = 0;
  for (const b of seed.brands) {
    db.prepare(`INSERT INTO brands (sort,name,image) VALUES (?,?,?)`).run(++i, b.name, await saveLogo(fs.readFileSync(path.join(paths.seed, 'media', b.image))));
  }
  i = 0;
  for (const p of seed.policies) {
    db.prepare(`INSERT INTO policies (sort,title_en,title_hu,body_en,body_hu) VALUES (?,?,?,?,?)`).run(++i, p.title_en, p.title_hu, p.body_en, p.body_hu);
  }
  const st = seed.settings;
  setSetting('hero_image', '', await photo(st.hero_image));
  setSetting('corp_image', '', await photo(st.corp_image));
  for (const k of ['corp_text', 'address']) for (const l of ['en', 'hu']) setSetting(k, l, st[k]?.[l]);
  for (const k of ['hero_title', 'hero_sub']) for (const l of ['en', 'hu']) setSetting(k, l, st[k]?.[l]);
  setSetting('email', '', st.email);
  setSetting('phone', '', st.phone);
  for (const k of ['facebook', 'twitter', 'instagram', 'linkedin']) setSetting(k, '', st.social?.[k]);
  return true;
}
