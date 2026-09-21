import Database from 'better-sqlite3';
import { paths } from './config.js';

export const db = new Database(paths.db);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL, lang TEXT NOT NULL DEFAULT '', value TEXT NOT NULL DEFAULT '', PRIMARY KEY (key, lang)
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0,
  title_en TEXT DEFAULT '', title_hu TEXT DEFAULT '', desc_en TEXT DEFAULT '', desc_hu TEXT DEFAULT '',
  image TEXT DEFAULT '', link_url TEXT DEFAULT '', link_label_en TEXT DEFAULT '', link_label_hu TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0,
  name TEXT DEFAULT '', country_en TEXT DEFAULT '', country_hu TEXT DEFAULT '', year TEXT DEFAULT '', image TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, name TEXT DEFAULT '', image TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0,
  title_en TEXT DEFAULT '', title_hu TEXT DEFAULT '', body_en TEXT DEFAULT '', body_hu TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, created TEXT DEFAULT CURRENT_TIMESTAMP,
  name TEXT, email TEXT, phone TEXT, message TEXT, is_read INTEGER NOT NULL DEFAULT 0
);
`);

export const TABLES = ['services', 'projects', 'brands', 'policies'];

export const all = (table) => db.prepare(`SELECT * FROM ${table} ORDER BY sort, id`).all();
export const one = (table, id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
export const nextSort = (table) => (db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table}`).get().n);

// settings: key + lang ('' = shared). Missing or empty means "use the built-in default".
export function getSettings() {
  const map = {};
  for (const r of db.prepare('SELECT key, lang, value FROM settings').all()) map[`${r.key}|${r.lang}`] = r.value;
  return map;
}
export function setSetting(key, lang, value) {
  const v = (value ?? '').toString().trim();
  if (!v) db.prepare('DELETE FROM settings WHERE key = ? AND lang = ?').run(key, lang);
  else db.prepare('INSERT INTO settings (key, lang, value) VALUES (?, ?, ?) ON CONFLICT(key, lang) DO UPDATE SET value = excluded.value').run(key, lang, v);
}
