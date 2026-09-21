import express from 'express';
import nodemailer from 'nodemailer';
import { config, paths } from './config.js';
import { db, getSettings } from './db.js';
import { renderPage, esc } from './render.js';
import { admin } from './admin.js';
import { ensureAdmin, limited } from './auth.js';
import { seedIfEmpty } from './seed.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

// security headers (the site loads nothing from other origins)
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (config.production && req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.get('/healthz', (_req, res) => { db.prepare('SELECT 1').get(); res.type('text').send('ok'); });
app.use('/uploads', express.static(paths.uploads, { maxAge: '365d', immutable: true, fallthrough: false }));
app.use('/assets', express.static(paths.public, { maxAge: '7d' }));

app.get(['/', '/index.html'], (_req, res) => res.set('Cache-Control', 'no-cache').type('html').send(renderPage('en')));
app.get(['/hu', '/hu/'], (req, res) => (req.path === '/hu' ? res.redirect(301, '/hu/') : res.set('Cache-Control', 'no-cache').type('html').send(renderPage('hu'))));

app.get('/robots.txt', (_req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nSitemap: ${config.siteUrl}/sitemap.xml\n`));
app.get('/sitemap.xml', (_req, res) => {
  const u = (l) => `<url><loc>${config.siteUrl}${l === 'hu' ? '/hu/' : '/'}</loc><xhtml:link rel="alternate" hreflang="en" href="${config.siteUrl}/"/><xhtml:link rel="alternate" hreflang="hu" href="${config.siteUrl}/hu/"/></url>`;
  res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${u('en')}${u('hu')}</urlset>`);
});

// contact form
const mailer = config.smtp ? nodemailer.createTransport(config.smtp) : null;
app.post('/contact', express.json({ limit: '20kb' }), (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: pretend success
  if (limited(`contact:${req.ip}`, 5, 10 * 60 * 1000)) return res.status(429).json({ ok: false });
  const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
  const m = { name: clean(b.name, 120), email: clean(b.email, 160), phone: clean(b.phone, 40), message: clean(b.message, 5000) };
  if (!m.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) || !m.message) return res.status(400).json({ ok: false });
  db.prepare('INSERT INTO messages (name, email, phone, message) VALUES (?, ?, ?, ?)').run(m.name, m.email, m.phone, m.message);
  const to = getSettings()['contact_to|'] || config.contactTo;
  if (mailer && to) {
    mailer.sendMail({ from: config.smtp.from, to, replyTo: m.email, subject: `Website message from ${m.name}`, text: `${m.message}\n\n${m.name}\n${m.email}\n${m.phone}` })
      .catch((e) => console.error('mail failed:', e.message));
  }
  res.json({ ok: true });
});

app.use('/admin', admin);

app.use((_req, res) => res.status(404).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Not found</title><body style="font:18px system-ui;background:#0a0a09;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><p>Page not found. <a style="color:#f8af41" href="/">Go to the home page</a></p>`));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).type('text').send('Something went wrong.'); });

ensureAdmin();
const seeded = await seedIfEmpty();
if (seeded) console.log('Database filled from seed/seed.json');
app.listen(config.port, () => console.log(`EATEC site: http://localhost:${config.port}  (admin: /admin)`));
