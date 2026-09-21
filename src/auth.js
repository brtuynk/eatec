import crypto from 'node:crypto';
import { db } from './db.js';
import { config, sessionSecret } from './config.js';

const b64 = (b) => Buffer.from(b).toString('base64url');
const hmac = (s) => crypto.createHmac('sha256', sessionSecret).update(s).digest('base64url');
const MAX_AGE = 60 * 60 * 24 * 7;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((p) => p[0]));

export function startSession(req, res, uid) {
  const payload = b64(JSON.stringify({ uid, csrf: crypto.randomBytes(18).toString('hex'), exp: Date.now() + MAX_AGE * 1000 }));
  res.append('Set-Cookie', `sid=${payload}.${hmac(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${req.secure ? '; Secure' : ''}`);
}
export function endSession(req, res) {
  res.append('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? '; Secure' : ''}`);
}

export function loadSession(req, _res, next) {
  req.session = null;
  const raw = cookies(req).sid;
  if (raw) {
    const [payload, sig] = raw.split('.');
    if (payload && sig && sig.length === hmac(payload).length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(payload)))) {
      try {
        const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
        const user = s.exp > Date.now() && db.prepare('SELECT id, email FROM users WHERE id = ?').get(s.uid);
        if (user) req.session = { ...s, user };
      } catch { /* invalid cookie */ }
    }
  }
  next();
}
export const requireAuth = (req, res, next) => (req.session ? next() : res.redirect('/admin/login'));
export const csrfOk = (req) => !!req.session && !!req.body && req.body._csrf === req.session.csrf;

// tiny in-memory rate limiter
const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

export function ensureAdmin() {
  // ADMIN_FORCE_RESET=true: apply ADMIN_EMAIL / ADMIN_PASSWORD even if users already exist (remove the flag afterwards)
  if (process.env.ADMIN_FORCE_RESET === 'true' && config.admin.email && config.admin.password.length >= 10) {
    const email = config.admin.email.toLowerCase();
    const hash = hashPassword(config.admin.password);
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (u) db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, u.id);
    else db.prepare('INSERT INTO users (email, pass_hash) VALUES (?, ?)').run(email, hash);
    console.log(`\n  Admin password reset for ${email} (ADMIN_FORCE_RESET). Remove that variable now.\n`);
    return;
  }
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  let { email, password } = config.admin;
  let generated = false;
  if (!email) email = 'admin@eatecconstruction.com';
  if (!password) { password = crypto.randomBytes(9).toString('base64url'); generated = true; }
  db.prepare('INSERT INTO users (email, pass_hash) VALUES (?, ?)').run(email.toLowerCase(), hashPassword(password));
  console.log(`\n  Admin user created: ${email}${generated ? `\n  Generated password (shown once): ${password}` : ''}\n  Change it under Admin > Account.\n`);
}
