// Create the admin user or set a new password:
//   docker compose exec eatec node src/set-admin.js you@example.com 'new-long-password'
//   (or ADMIN_EMAIL / ADMIN_PASSWORD from the environment)
import { db } from './db.js';
import { hashPassword } from './auth.js';

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.argv[3] || process.env.ADMIN_PASSWORD || '';
if (!email || password.length < 10) {
  console.error('Usage: node src/set-admin.js <email> <password (min 10 chars)>');
  process.exit(1);
}
const hash = hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, existing.id);
else db.prepare('INSERT INTO users (email, pass_hash) VALUES (?, ?)').run(email, hash);
console.log(`${existing ? 'Password updated for' : 'Admin user created:'} ${email}`);
console.log('Users:', db.prepare('SELECT email FROM users').all().map((u) => u.email).join(', '));
