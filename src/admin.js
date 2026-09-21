import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { db, all, one, nextSort, getSettings, setSetting } from './db.js';
import { checkPassword, hashPassword, startSession, endSession, loadSession, requireAuth, csrfOk, limited } from './auth.js';
import { savePhoto, saveLogo, deleteImage, imgUrl } from './images.js';
import { SETTING_GROUPS, STR } from './i18n.js';
import { esc } from './render.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 4 } });
export const admin = express.Router();
admin.use(express.urlencoded({ extended: false, limit: '200kb' }));
admin.use(loadSession);
admin.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ---------- entity definitions ----------
const ENTITIES = {
  projects: {
    label: 'Projects', singular: 'project', table: 'projects', sortable: true,
    title: (r) => r.name, sub: (r) => [r.country_en, r.year].filter(Boolean).join(' ') , thumb: 'image',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, help: 'For example: Zara Arena Plaza' },
      { name: 'country_en', label: 'Country (English)', type: 'text', required: true, list: 'countries', help: 'The country filters on the site are built from this. Use the same spelling for the same country.' },
      { name: 'country_hu', label: 'Country (Hungarian)', type: 'text', help: 'If empty, the English name is shown on the Hungarian page.' },
      { name: 'year', label: 'Year', type: 'text' },
      { name: 'image', label: 'Photo', type: 'photo', required: true, help: 'JPG, PNG or WebP. Wide photos, at least 1600 px, look best. Smaller sizes are made automatically.' },
    ],
  },
  services: {
    label: 'Applications', singular: 'application', table: 'services', sortable: true,
    title: (r) => r.title_en, sub: (r) => r.title_hu, thumb: 'image',
    fields: [
      { name: 'title_en', label: 'Title (English)', type: 'text', required: true },
      { name: 'title_hu', label: 'Title (Hungarian)', type: 'text' },
      { name: 'desc_en', label: 'Description (English)', type: 'textarea', help: 'Leave an empty line between paragraphs.' },
      { name: 'desc_hu', label: 'Description (Hungarian)', type: 'textarea' },
      { name: 'image', label: 'Photo', type: 'photo', required: true },
      { name: 'link_url', label: 'Link (optional)', type: 'text', help: 'For example https://www.bendboard.eu' },
      { name: 'link_label_en', label: 'Link text (English)', type: 'text' },
      { name: 'link_label_hu', label: 'Link text (Hungarian)', type: 'text' },
    ],
  },
  brands: {
    label: 'Client logos', singular: 'logo', table: 'brands', sortable: true,
    title: (r) => r.name, sub: () => '', thumb: 'image', logo: true,
    fields: [
      { name: 'name', label: 'Brand name', type: 'text', required: true },
      { name: 'image', label: 'Logo', type: 'logo', required: true, help: 'Dark logo on a white or transparent background. It is turned white automatically for the dark site.' },
    ],
  },
  policies: {
    label: 'Policies', singular: 'policy', table: 'policies', sortable: true,
    title: (r) => r.title_en, sub: (r) => r.title_hu, thumb: null,
    fields: [
      { name: 'title_en', label: 'Title (English)', type: 'text', required: true },
      { name: 'title_hu', label: 'Title (Hungarian)', type: 'text' },
      { name: 'body_en', label: 'Text (English)', type: 'textarea', tall: true, help: 'Leave an empty line between paragraphs.' },
      { name: 'body_hu', label: 'Text (Hungarian)', type: 'textarea', tall: true },
    ],
  },
};

// ---------- layout ----------
function layout(req, title, body, { flash } = {}) {
  const unread = db.prepare('SELECT COUNT(*) c FROM messages WHERE is_read = 0').get().c;
  const nav = [['/admin', 'Dashboard'], ['/admin/settings', 'Site texts'], ...Object.entries(ENTITIES).map(([k, e]) => [`/admin/${k}`, e.label]), ['/admin/messages', `Messages${unread ? ` <b class="badge">${unread}</b>` : ''}`], ['/admin/account', 'Account']];
  const path = req.baseUrl + req.path;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)} | EATEC admin</title>
<link rel="stylesheet" href="/assets/admin.css"><link rel="icon" href="/assets/img/logo-light.png"></head><body>
<aside><a class="brand" href="/admin"><img src="/assets/img/logo-dark.png" alt="EATEC" height="34"></a>
<nav>${nav.map(([h, l]) => `<a href="${h}"${path === h || (h !== '/admin' && path.startsWith(h + '/')) ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
<div class="side-foot"><a href="/" target="_blank" rel="noopener">View site</a>
<form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${req.session.csrf}"><button>Log out</button></form></div></aside>
<main><h1>${esc(title)}</h1>${flash ? `<p class="flash ${flash.type}" role="status">${esc(flash.text)}</p>` : ''}${body}</main>
<script src="/assets/admin.js" defer></script></body></html>`;
}
const flashOf = (req) => (req.query.ok ? { type: 'ok', text: String(req.query.ok) } : req.query.err ? { type: 'err', text: String(req.query.err) } : null);
const back = (res, url, kind, text) => res.redirect(`${url}${url.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(text)}`);
const csrf = (req) => `<input type="hidden" name="_csrf" value="${req.session.csrf}">`;
const thumbHtml = (value, logo) => (value ? `<img class="thumb${logo ? ' logo' : ''}" src="${imgUrl(value, 480)}" alt="">` : '<span class="thumb empty"></span>');

function fieldHtml(f, value, { removable } = {}) {
  const id = `f_${f.name}`;
  const help = f.help ? `<small>${esc(f.help)}</small>` : '';
  if (f.type === 'textarea') return `<div class="fld"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.name}" rows="${f.tall ? 12 : 5}">${esc(value)}</textarea>${help}</div>`;
  if (f.type === 'photo' || f.type === 'logo') {
    return `<div class="fld"><label for="${id}">${esc(f.label)}</label>${value ? `<div class="cur">${thumbHtml(value, f.type === 'logo')}</div>` : ''}
      <input id="${id}" type="file" name="${f.name}" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"${f.required && !value ? ' required' : ''}>
      ${removable && value ? `<label class="chk"><input type="checkbox" name="remove_${f.name}" value="1"> Remove current photo</label>` : ''}${help}</div>`;
  }
  return `<div class="fld"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.name}" value="${esc(value)}"${f.required ? ' required' : ''}${f.list ? ` list="${f.list}"` : ''}>${help}</div>`;
}

// ---------- login / logout ----------
admin.get('/login', (req, res) => {
  if (req.session) return res.redirect('/admin');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Log in | EATEC admin</title><link rel="stylesheet" href="/assets/admin.css"></head>
<body class="login"><form method="post" action="/admin/login"><img src="/assets/img/logo-light.png" alt="EATEC" height="44"><h1>Admin log in</h1>
${req.query.err ? `<p class="flash err">${esc(req.query.err)}</p>` : ''}
<div class="fld"><label for="e">Email</label><input id="e" name="email" type="email" autocomplete="username" required autofocus></div>
<div class="fld"><label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required></div>
<button class="btn">Log in</button></form></body></html>`);
});
admin.post('/login', (req, res) => {
  if (limited(`login:${req.ip}`, 10, 15 * 60 * 1000)) return res.status(429).redirect('/admin/login?err=' + encodeURIComponent('Too many attempts. Try again in a few minutes.'));
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(req.body.email || '').toLowerCase().trim());
  if (!user || !checkPassword(String(req.body.password || ''), user.pass_hash)) return res.redirect('/admin/login?err=' + encodeURIComponent('Wrong email or password.'));
  startSession(req, res, user.id);
  res.redirect('/admin');
});
admin.post('/logout', requireAuth, (req, res) => { if (csrfOk(req)) endSession(req, res); res.redirect('/admin/login'); });

admin.use(requireAuth);

// ---------- dashboard ----------
admin.get('/', (req, res) => {
  const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  const recent = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 5').all();
  res.send(layout(req, 'Dashboard', `
<div class="cards">${Object.entries(ENTITIES).map(([k, e]) => `<a class="card" href="/admin/${k}"><b>${count(e.table)}</b><span>${e.label}</span><em>Add or edit</em></a>`).join('')}
<a class="card" href="/admin/settings"><b>Aa</b><span>Site texts</span><em>Headings, contact, photos</em></a></div>
<h2>Latest messages</h2>${recent.length ? `<ul class="msgs">${recent.map((m) => `<li><a href="/admin/messages/${m.id}">${m.is_read ? '' : '<b class="dot" title="Unread"></b>'}<strong>${esc(m.name)}</strong> <span>${esc(m.email)}</span><small>${esc(m.created)}</small></a></li>`).join('')}</ul>` : '<p class="muted">No messages yet.</p>'}
<p class="muted">Changes appear on the site as soon as you save. Every text has an English and a Hungarian version.</p>`, { flash: flashOf(req) }));
});

// ---------- site texts ----------
admin.get('/settings', (req, res) => {
  const S = getSettings();
  const groups = SETTING_GROUPS.map((g) => `<fieldset><legend>${esc(g.title)}</legend>${g.fields.map((f) => {
    const val = (l) => S[`${f.key}|${l}`] || '';
    if (f.type === 'photo') return fieldHtml({ name: f.key, label: f.label, type: 'photo', help: f.help }, val(''), { removable: true });
    const def = (l) => STR[f.key]?.[l] || '';
    const one1 = (l, label) => {
      const id = `s_${f.key}_${l}`;
      const ph = def(l) ? ` placeholder="${esc(def(l))}"` : '';
      const ctl = f.type === 'textarea' ? `<textarea id="${id}" name="s.${f.key}.${l}" rows="4"${ph}>${esc(val(l))}</textarea>` : `<input id="${id}" name="s.${f.key}.${l}" value="${esc(val(l))}"${ph}>`;
      return `<div class="fld"><label for="${id}"${l === '' ? ' class="sr"' : ''}>${esc(label)}</label>${ctl}</div>`;
    };
    return f.langs
      ? `<div class="pair"><div class="ptitle">${esc(f.label)}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>${one1('en', 'English')}${one1('hu', 'Hungarian')}</div>`
      : `<div class="pair one"><div class="ptitle">${esc(f.label)}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>${one1('', 'Value')}</div>`;
  }).join('')}</fieldset>`).join('');
  res.send(layout(req, 'Site texts', `<p class="muted">Empty fields use the built-in text (shown in grey).</p>
<form method="post" action="/admin/settings" enctype="multipart/form-data">${csrf(req)}${groups}<div class="bar"><button class="btn">Save changes</button></div></form>`, { flash: flashOf(req) }));
});
const IMG_SETTINGS = ['hero_image', 'corp_image'];
admin.post('/settings', upload.fields(IMG_SETTINGS.map((n) => ({ name: n, maxCount: 1 }))), async (req, res) => {
  if (!csrfOk(req)) return back(res, '/admin/settings', 'err', 'Session expired. Reload and try again.');
  try {
    for (const g of SETTING_GROUPS) for (const f of g.fields) {
      if (f.type === 'photo') continue;
      if (f.langs) for (const l of ['en', 'hu']) setSetting(f.key, l, req.body[`s.${f.key}.${l}`]);
      else setSetting(f.key, '', req.body[`s.${f.key}.`]);
    }
    const S = getSettings();
    for (const n of IMG_SETTINGS) {
      const file = req.files?.[n]?.[0];
      const old = S[`${n}|`];
      if (file) { const v = await savePhoto(file.buffer); setSetting(n, '', v); deleteImage(old); }
      else if (req.body[`remove_${n}`] && old) { setSetting(n, '', ''); deleteImage(old); }
    }
    back(res, '/admin/settings', 'ok', 'Saved.');
  } catch (e) { back(res, '/admin/settings', 'err', 'Could not save: ' + (e.message.includes('Input') ? 'the file is not a valid image.' : e.message)); }
});

// ---------- messages ----------
admin.get('/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 300').all();
  res.send(layout(req, 'Messages', rows.length ? `<ul class="msgs">${rows.map((m) => `<li><a href="/admin/messages/${m.id}">${m.is_read ? '' : '<b class="dot" title="Unread"></b>'}<strong>${esc(m.name)}</strong> <span>${esc(m.email)}</span><small>${esc(m.created)}</small></a></li>`).join('')}</ul>` : '<p class="muted">No messages yet.</p>', { flash: flashOf(req) }));
});
admin.get('/messages/:id', (req, res) => {
  const m = one('messages', req.params.id);
  if (!m) return res.redirect('/admin/messages');
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(m.id);
  res.send(layout(req, 'Message', `<div class="msg"><p><b>${esc(m.name)}</b> &lt;<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>&gt;${m.phone ? ` &middot; ${esc(m.phone)}` : ''}</p><p class="muted">${esc(m.created)} (UTC)</p><pre>${esc(m.message)}</pre></div>
<form method="post" action="/admin/messages/${m.id}/delete" data-confirm="Delete this message?">${csrf(req)}<a class="btn ghost" href="mailto:${esc(m.email)}?subject=Re: your message">Reply by email</a> <button class="btn danger">Delete</button></form>`));
});
admin.post('/messages/:id/delete', (req, res) => {
  if (csrfOk(req)) db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  back(res, '/admin/messages', 'ok', 'Message deleted.');
});

// ---------- account ----------
admin.get('/account', (req, res) => res.send(layout(req, 'Account', `<p>Signed in as <b>${esc(req.session.user.email)}</b>.</p>
<form method="post" action="/admin/account" class="narrow">${csrf(req)}
<div class="fld"><label for="c">Current password</label><input id="c" name="current" type="password" autocomplete="current-password" required></div>
<div class="fld"><label for="n">New password</label><input id="n" name="next" type="password" autocomplete="new-password" minlength="10" required><small>At least 10 characters.</small></div>
<button class="btn">Change password</button></form>`, { flash: flashOf(req) })));
admin.post('/account', (req, res) => {
  if (!csrfOk(req)) return back(res, '/admin/account', 'err', 'Session expired. Reload and try again.');
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!checkPassword(String(req.body.current || ''), u.pass_hash)) return back(res, '/admin/account', 'err', 'Current password is wrong.');
  if (String(req.body.next || '').length < 10) return back(res, '/admin/account', 'err', 'New password must be at least 10 characters.');
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(req.body.next), u.id);
  back(res, '/admin/account', 'ok', 'Password changed.');
});

// ---------- generic CRUD ----------
const entity = (req, res, next) => { const e = ENTITIES[req.params.entity]; if (!e) return res.redirect('/admin'); req.ent = e; req.entKey = req.params.entity; next(); };
const imageField = (e) => e.fields.find((f) => f.type === 'photo' || f.type === 'logo');

admin.get('/:entity', entity, (req, res) => {
  const e = req.ent, k = req.entKey, rows = all(e.table);
  const body = `<p><a class="btn" href="/admin/${k}/new">Add ${e.singular}</a></p>
${rows.length ? `<table class="list"><tbody>${rows.map((r, i) => `<tr>${e.thumb ? `<td class="tc">${thumbHtml(r[e.thumb], e.logo)}</td>` : ''}<td><a href="/admin/${k}/${r.id}"><strong>${esc(e.title(r))}</strong></a><br><small>${esc(e.sub(r))}</small></td>
<td class="act"><div class="actbox"><form method="post" action="/admin/${k}/${r.id}/move">${csrf(req)}<button name="dir" value="up" title="Move up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button><button name="dir" value="down" title="Move down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button></form>
<a class="btn ghost" href="/admin/${k}/${r.id}">Edit</a>
<form method="post" action="/admin/${k}/${r.id}/delete" data-confirm="Delete this ${e.singular}? This cannot be undone.">${csrf(req)}<button class="btn danger">Delete</button></form></div></td></tr>`).join('')}</tbody></table>` : `<p class="muted">Nothing here yet.</p>`}
${e.sortable ? '<p class="muted">The order here is the order on the site.</p>' : ''}`;
  res.send(layout(req, e.label, body, { flash: flashOf(req) }));
});

function formPage(req, res, row) {
  const e = req.ent, k = req.entKey;
  const countries = k === 'projects' ? [...new Set(all('projects').map((p) => p.country_en).filter(Boolean))] : [];
  res.send(layout(req, row ? `Edit ${e.singular}` : `New ${e.singular}`, `<form method="post" enctype="multipart/form-data" action="/admin/${k}${row ? `/${row.id}` : ''}" class="narrow">${csrf(req)}
${e.fields.map((f) => fieldHtml(f, row ? row[f.name] : '')).join('')}
${countries.length ? `<datalist id="countries">${countries.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>` : ''}
<div class="bar"><button class="btn">Save</button> <a class="btn ghost" href="/admin/${k}">Cancel</a></div></form>`, { flash: flashOf(req) }));
}
admin.get('/:entity/new', entity, (req, res) => formPage(req, res, null));
admin.get('/:entity/:id', entity, (req, res) => { const row = one(req.ent.table, req.params.id); return row ? formPage(req, res, row) : res.redirect(`/admin/${req.entKey}`); });

async function save(req, res, id) {
  const e = req.ent, k = req.entKey, here = id ? `/admin/${k}/${id}` : `/admin/${k}/new`;
  if (!csrfOk(req)) return back(res, here, 'err', 'Session expired. Reload and try again.');
  const old = id ? one(e.table, id) : null;
  const vals = {};
  for (const f of e.fields) {
    if (f.type === 'photo' || f.type === 'logo') continue;
    vals[f.name] = String(req.body[f.name] ?? '').trim();
    if (f.required && !vals[f.name]) return back(res, here, 'err', `${f.label} is required.`);
  }
  const imgF = imageField(e);
  try {
    if (imgF) {
      const file = req.file;
      if (file) {
        await sharp(file.buffer).metadata(); // rejects anything that is not an image
        vals[imgF.name] = imgF.type === 'logo' ? await saveLogo(file.buffer) : await savePhoto(file.buffer);
      } else if (old) vals[imgF.name] = old[imgF.name];
      else if (imgF.required) return back(res, here, 'err', `${imgF.label} is required.`);
    }
  } catch { return back(res, here, 'err', 'That file is not a valid image (use JPG, PNG or WebP).'); }
  const cols = Object.keys(vals);
  if (old) db.prepare(`UPDATE ${e.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => vals[c]), id);
  else db.prepare(`INSERT INTO ${e.table} (sort, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(nextSort(e.table), ...cols.map((c) => vals[c]));
  if (old && imgF && old[imgF.name] !== vals[imgF.name]) deleteImage(old[imgF.name]);
  back(res, `/admin/${k}`, 'ok', 'Saved.');
}
admin.post('/:entity', entity, upload.single('image'), (req, res) => save(req, res, null));
admin.post('/:entity/:id/move', entity, (req, res) => {
  if (csrfOk(req)) {
    const rows = all(req.ent.table), i = rows.findIndex((r) => String(r.id) === req.params.id), j = req.body.dir === 'up' ? i - 1 : i + 1;
    if (i >= 0 && rows[j]) {
      const swap = db.transaction(() => { rows.splice(j, 0, rows.splice(i, 1)[0]); rows.forEach((r, n) => db.prepare(`UPDATE ${req.ent.table} SET sort = ? WHERE id = ?`).run(n + 1, r.id)); });
      swap();
    }
  }
  res.redirect(`/admin/${req.entKey}`);
});
admin.post('/:entity/:id/delete', entity, (req, res) => {
  if (!csrfOk(req)) return back(res, `/admin/${req.entKey}`, 'err', 'Session expired. Reload and try again.');
  const row = one(req.ent.table, req.params.id);
  if (row) { const f = imageField(req.ent); db.prepare(`DELETE FROM ${req.ent.table} WHERE id = ?`).run(row.id); if (f) deleteImage(row[f.name]); }
  back(res, `/admin/${req.entKey}`, 'ok', 'Deleted.');
});
admin.post('/:entity/:id', entity, upload.single('image'), (req, res) => save(req, res, req.params.id));

admin.use((err, req, res, _next) => { console.error(err); res.status(500).send(layout(req, 'Error', `<p class="flash err">${esc(err.message || 'Something went wrong.')}</p><p><a href="javascript:history.back()">Go back</a></p>`)); });
