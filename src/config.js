import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  production: env.NODE_ENV === 'production',
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
  siteUrl: (env.SITE_URL || 'https://eatecconstruction.com').replace(/\/$/, ''),
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : 1,
  admin: { email: env.ADMIN_EMAIL || '', password: env.ADMIN_PASSWORD || '' },
  smtp: env.SMTP_HOST ? {
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
    from: env.SMTP_FROM || env.SMTP_USER || 'no-reply@eatecconstruction.com',
  } : null,
  contactTo: env.CONTACT_TO || '',
};

export const paths = {
  uploads: path.join(config.dataDir, 'uploads'),
  db: path.join(config.dataDir, 'site.db'),
  secret: path.join(config.dataDir, 'session.key'),
  seed: path.join(ROOT, 'seed'),
  public: path.join(ROOT, 'public'),
};
fs.mkdirSync(paths.uploads, { recursive: true });

// session secret: from env, else generated once and kept in the data volume
export const sessionSecret = (() => {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (fs.existsSync(paths.secret)) return fs.readFileSync(paths.secret, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(paths.secret, s, { mode: 0o600 });
  return s;
})();
