// Tat:vm CMS — local admin server. Runs only on this computer (127.0.0.1), no cloud services.
//   node cms/server.js            start the dashboard at http://localhost:4600/admin/
// Content lives in cms/data/content.db (SQLite); uploaded files in /uploads/. Publishing rewrites the static site files.
process.removeAllListeners('warning');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const gen = require('./generator');

const ROOT = gen.ROOT;
const PORT = Number(process.env.CMS_PORT || process.argv[2] || 4600);
const DATA = process.env.CMS_DATA || path.join(__dirname, 'data');
const BACKUPS = path.join(DATA, 'backups');
const UPLOAD_DIRS = { blogs: 'uploads/blogs', news: 'uploads/news', clippings: 'uploads/clippings', publishers: 'uploads/publishers' };
const TYPES = [...gen.BLOG_TYPES, ...gen.NEWS_TYPES];
const STATUSES = ['draft', 'published', 'unpublished'];
const MAX_IMAGE = 15 * 1024 * 1024, MAX_PDF = 30 * 1024 * 1024;

fs.mkdirSync(BACKUPS, { recursive: true });
for (const d of Object.values(UPLOAD_DIRS)) fs.mkdirSync(path.join(ROOT, d), { recursive: true });

// ------------------------------------------------------------------ database
const db = new DatabaseSync(path.join(DATA, 'content.db'));
db.exec(`
  PRAGMA journal_mode = DELETE;
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL, description TEXT DEFAULT '', body_html TEXT DEFAULT '',
    category TEXT DEFAULT '', author TEXT DEFAULT '', pub_date TEXT NOT NULL, date_label TEXT,
    publisher TEXT DEFAULT '', image TEXT DEFAULT '', image_alt TEXT DEFAULT '',
    clip_files TEXT DEFAULT '[]', clip_original TEXT, external_url TEXT DEFAULT '',
    seo_title TEXT DEFAULT '', meta_description TEXT DEFAULT '', slug TEXT DEFAULT '',
    legacy_url TEXT, legacy_card TEXT, sort_key INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS publishers (name TEXT PRIMARY KEY, logo TEXT);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS generated (path TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS pending (path TEXT PRIMARY KEY, action TEXT NOT NULL, at TEXT NOT NULL);
`);
{ const cols = db.prepare('PRAGMA table_info(items)').all().map(c => c.name);
  for (const [c, def] of [['faqs', "TEXT DEFAULT '[]'"], ['keywords', "TEXT DEFAULT ''"], ['schema_json', "TEXT DEFAULT ''"]]) if (!cols.includes(c)) db.exec(`ALTER TABLE items ADD COLUMN ${c} ${def}`); }
const setting = (k, v) => v === undefined
  ? (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) || {}).value
  : db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);

// ------------------------------------------------------------------ one-time import of what is already on the site
function parseLooseDate(label) {
  const M = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const s = String(label || '');
  const y = (/(\d{4})/.exec(s) || [])[1], m = M[((/[A-Za-z]{3}/.exec(s) || [''])[0]).toLowerCase()];
  const d = (/(?:^|\D)(\d{1,2})(?:\D|$)/.exec(s.replace(/\d{4}/, '')) || [])[1];
  if (!y || !m) return new Date().toISOString().slice(0, 10);
  return `${y}-${String(m).padStart(2, '0')}-${String(d || 1).padStart(2, '0')}`;
}
function evalArray(file, name) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n[ \\t]*\\]);').exec(s);
  if (!m) throw new Error(file + ': ' + name + ' not found');
  return { list: Function('"use strict"; return ' + m[1])(), src: s };
}
function importExisting() {
  if (setting('imported')) return;
  const now = new Date().toISOString();
  const unesc = s => String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const ins = db.prepare(`INSERT INTO items (type, status, title, description, category, author, pub_date, date_label, publisher, image, image_alt, clip_files, clip_original, legacy_url, legacy_card, sort_key, created_at, updated_at)
    VALUES (?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    // blogs
    const { list: blogs, src } = evalArray('blogs.html', 'BLOG_POSTS');
    const labels = JSON.parse((/const CATEGORY_LABELS = (\{[^\n]*\});/.exec(src) || [, '{}'])[1]);
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    blogs.forEach((b, i) => {
      const lm = new RegExp('<loc>' + (gen.SITE + b.url).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</loc><lastmod>(\\d{4}-\\d{2}-\\d{2})').exec(sitemap);
      ins.run('blog', unesc(b.title), unesc(b.excerpt), labels[b.category] || 'Real Estate', 'Tat:vm Group', lm ? lm[1] : parseLooseDate(b.date), b.date, '', b.image, unesc(b.alt || ''), '[]', null, b.url, JSON.stringify({ readTime: b.readTime }), i, now, now);
    });
    // news
    const { list: news, src: nsrc } = evalArray('news.html', 'NEWS_ITEMS');
    const catLabel = k => Object.keys(gen.NEWS_CATEGORIES).find(l => gen.NEWS_CATEGORIES[l] === k) || 'Press & Media';
    news.forEach((n, i) => {
      const clip = n.type === 'clipping';
      ins.run(clip ? 'clipping' : 'pr-article', unesc(n.title), unesc(n.excerpt), catLabel(n.category), '', parseLooseDate(n.date), n.date, unesc(n.source || ''), n.image, '',
        JSON.stringify(clip ? n.pages || [] : []), clip ? n.file || null : null, clip ? null : n.externalUrl, null, i, now, now);
    });
    // publisher logos already on the site
    const logos = /const PUB_LOGOS = (\{[\s\S]*?\n[ \t]*\});/.exec(nsrc);
    if (logos) for (const [name, logo] of Object.entries(Function('"use strict"; return ' + logos[1])())) db.prepare('INSERT OR IGNORE INTO publishers (name, logo) VALUES (?, ?)').run(name, logo);
    // keep the original order exactly: if the parsed dates would reorder anything, nudge them
    for (const types of [gen.BLOG_TYPES, gen.NEWS_TYPES]) {
      const rows = db.prepare(`SELECT id, pub_date, sort_key FROM items WHERE type IN (${types.map(() => '?').join(',')}) ORDER BY sort_key`).all(...types);
      let last = '9999-12-31';
      for (const r of rows) { if (r.pub_date > last) db.prepare('UPDATE items SET pub_date = ? WHERE id = ?').run(last, r.id); else last = r.pub_date; }
    }
    setting('imported', now);
    db.exec('COMMIT');
    // untouched copy of the pages the CMS rewrites
    const snap = path.join(BACKUPS, 'site-before-cms');
    if (!fs.existsSync(snap)) { fs.mkdirSync(snap, { recursive: true }); for (const f of ['index.html', 'blogs.html', 'news.html', 'sitemap.xml']) fs.copyFileSync(path.join(ROOT, f), path.join(snap, f)); }
    console.log(`Imported ${blogs.length} existing blogs and ${news.length} existing news items.`);
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ------------------------------------------------------------------ auth
const sessions = new Map();            // token -> expiry
let fails = 0, lockedUntil = 0;
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
const checkPw = (pw, stored) => { const [salt, h] = String(stored || ':').split(':'); const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 64); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const cookieToken = req => (/(?:^|;\s*)cms_session=([a-f0-9]{64})/.exec(req.headers.cookie || '') || [])[1];
const authed = req => { const t = cookieToken(req), exp = t && sessions.get(t); if (!exp) return false; if (exp < Date.now()) { sessions.delete(t); return false; } return true; };
function startSession(res) {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + 8 * 3600 * 1000);
  res.setHeader('Set-Cookie', `cms_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
}

// ------------------------------------------------------------------ helpers
class HttpError extends Error { constructor(status, msg, fields) { super(msg); this.status = status; this.fields = fields; } }
const send = (res, status, obj) => { const b = JSON.stringify(obj); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); };
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'That file is too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJson = async req => { try { return JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8') || '{}'); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Invalid request.'); } };
const validUrl = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch (e) { return false; } };
const safeFile = p => typeof p === 'string' && /^(uploads|assets)\/[A-Za-z0-9 _\-./()%]+$/.test(p) && !p.includes('..') && fs.existsSync(path.join(ROOT, p));

// rich text: keep only simple formatting
const ALLOWED = new Set(['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'u', 'blockquote', 'img', 'br', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr', 'pre', 'code', 'sup', 'sub', 's', 'mark', 'small', 'dl', 'dt', 'dd', 'cite']);
const RENAME = { b: 'strong', i: 'em', div: 'p', h1: 'h2', h5: 'h4', h6: 'h4', strike: 's', del: 's' };
const VOID = new Set(['img', 'br', 'hr']);
const attrOf = (attrs, name) => { const r = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(attrs); return r ? (r[1] ?? r[2] ?? r[3] ?? '').trim() : ''; };
// only video and map players from these services may be embedded
function embedSrc(src) {
  let m;
  src = String(src || '').replace(/&amp;/g, '&').trim();
  if ((m = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,20})(?:[?#].*)?$/.exec(src))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  if ((m = /^https:\/\/player\.vimeo\.com\/video\/(\d{4,12})(?:[?#].*)?$/.exec(src))) return 'https://player.vimeo.com/video/' + m[1];
  if (/^https:\/\/www\.google\.com\/maps\/embed\?pb=[A-Za-z0-9!%._~:=&,+*-]+$/.test(src)) return src;
  return null;
}
const escAttr = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function sanitize(html) {
  const embeds = [];
  let s = String(html || '').replace(/\u0000/g, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>[\s\S]*?<\/iframe\s*>/gi, (m, attrs) => {
      const src = embedSrc(attrOf(attrs, 'src'));
      if (!src) return '';
      embeds.push(`<iframe src="${escAttr(src)}" title="${escAttr(attrOf(attrs, 'title') || 'Embedded video')}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`);
      return '\u0000E' + (embeds.length - 1) + '\u0000';
    })
    .replace(/<(script|style|iframe|object|embed|svg|math|form|template|noscript|head|title)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|base|form|input|button|svg|math)\b[^>]*>/gi, '');
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (m, close, tag, attrs) => {
    tag = tag.toLowerCase(); tag = RENAME[tag] || tag;
    if (!ALLOWED.has(tag)) return '';
    if (close) return VOID.has(tag) ? '' : `</${tag}>`;
    const get = name => attrOf(attrs, name);
    if (tag === 'td' || tag === 'th') {
      let out = '<' + tag;
      for (const a of ['colspan', 'rowspan']) { const v = parseInt(get(a), 10); if (v > 1 && v <= 50) out += ` ${a}="${v}"`; }
      if (tag === 'th' && /^(row|col|rowgroup|colgroup)$/.test(get('scope'))) out += ` scope="${get('scope')}"`;
      return out + '>';
    }
    if (tag === 'ol') { const v = parseInt(get('start'), 10); return v > 1 && v < 10000 ? `<ol start="${v}">` : '<ol>'; }
    if (tag === 'a') {
      const href = get('href').replace(/&amp;/g, '&');
      if (!href || !/^(https?:\/\/|mailto:|tel:|#|\/|\.\.?\/|[A-Za-z0-9_\-]+[./])/.test(href) || /^\s*(javascript|data|vbscript):/i.test(href)) return '<a>';
      const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?tatvmgroup\.com/i.test(href);
      return `<a href="${escAttr(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>`;
    }
    if (tag === 'img') {
      let src = get('src').replace(/&amp;/g, '&').replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i, '').replace(/^(\.\.\/)+/, '').replace(/^\//, '');
      if (!/^(uploads|assets)\/[A-Za-z0-9 _\-./()%]+$/.test(src) || src.includes('..')) return '';
      return `<img src="${escAttr(src)}" alt="${escAttr(get('alt'))}" loading="lazy">`;
    }
    return `<${tag}>`;
  });
  return s.replace(/<a>([\s\S]*?)<\/a>/g, '$1').replace(/<p>\s*(<br>)?\s*<\/p>/g, '').replace(/<(h2|h3|h4|li|strong|em|u|s|mark|sup|sub|code|caption)>\s*<\/\1>/g, '').replace(/\u00a0|&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000E(\d+)\u0000/g, (m, i) => embeds[+i] || '').trim();
}

function uniqueSlug(base, id) {
  base = gen.slugify(base) || 'post';
  const self = id ? db.prepare('SELECT * FROM items WHERE id = ?').get(id) : null;
  const own = self && gen.hasPage(self) ? gen.itemUrl(self) : null;        // this item's own page may already exist
  const taken = s => !!db.prepare("SELECT 1 FROM items WHERE slug = ? AND id <> ?").get(s, id || 0)
    || ['blog', 'News'].some(d => d + '/' + s + '.html' !== own && fs.existsSync(path.join(ROOT, d, s + '.html')));
  let s = base, n = 2;
  while (taken(s)) s = base + '-' + n++;
  return s;
}

// validate + normalise a record coming from the form; drafts only need a title
function clean(input, existing) {
  const f = {}, errors = {};
  const str = (k, max) => String(input[k] == null ? '' : input[k]).trim().slice(0, max);
  f.type = existing ? existing.type : str('type', 30);
  if (!TYPES.includes(f.type)) errors.type = 'Choose a content type.';
  f.status = STATUSES.includes(input.status) ? input.status : 'draft';
  f.title = str('title', 200); if (!f.title) errors.title = 'Title is required.';
  f.description = str('description', 400);
  f.category = str('category', 60);
  f.author = str('author', 80);
  f.publisher = str('publisher', 80);
  f.pub_date = str('pub_date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.pub_date) || isNaN(Date.parse(f.pub_date))) errors.pub_date = 'Choose a publication date.';
  f.image = str('image', 300); if (f.image && !safeFile(f.image)) errors.image = 'Upload the image again.';
  f.image_alt = str('image_alt', 200);
  f.external_url = str('external_url', 600); if (f.external_url && !validUrl(f.external_url)) errors.external_url = 'Enter a full web address starting with https://';
  f.seo_title = str('seo_title', 160);
  f.meta_description = str('meta_description', 320);
  f.body_html = existing && existing.legacy_url ? '' : sanitize(input.body_html);
  f.keywords = str('keywords', 300);
  const faqs = Array.isArray(input.faqs) ? input.faqs.slice(0, 30) : [];
  f.faqs = JSON.stringify(faqs.map(x => ({ q: String((x && x.q) || '').trim().slice(0, 300), a: String((x && x.a) || '').replace(/\r/g, '').trim().slice(0, 3000) })).filter(x => x.q || x.a));
  if (JSON.parse(f.faqs).some(x => !x.q || !x.a)) errors.faqs = 'Each FAQ needs both a question and an answer.';
  f.schema_json = '';
  const rawSchema = String(input.schema_json || '').replace(/<\/?script[^>]*>/gi, '').trim();
  if (rawSchema) {
    let parsed = null; try { parsed = JSON.parse(rawSchema); } catch (e) {}
    const list = Array.isArray(parsed) ? parsed : [parsed];
    if (!parsed || typeof parsed !== 'object' || !list.length || list.some(o => !o || typeof o !== 'object' || Array.isArray(o) || !o['@type'])) errors.schema_json = 'This is not valid schema JSON. Each block needs an "@type".';
    else if (rawSchema.length > 50000) errors.schema_json = 'The custom schema is too long.';
    else { for (const o of list) if (!o['@context']) o['@context'] = 'https://schema.org'; f.schema_json = JSON.stringify(parsed); }
  }
  let clips = Array.isArray(input.clip_files) ? input.clip_files.map(String) : [];
  if (clips.some(c => !safeFile(c))) errors.clip_files = 'Upload the clipping again.';
  f.clip_files = JSON.stringify(f.type === 'clipping' ? clips.slice(0, 20) : []);
  clips = JSON.parse(f.clip_files);

  const legacy = existing && existing.legacy_url;
  const needsPage = !legacy && f.type !== 'external-news' && f.type !== 'clipping';
  f.slug = needsPage ? (str('slug', 100) || f.title) : '';
  if (needsPage) {
    const wanted = gen.slugify(f.slug);
    if (!wanted) errors.slug = 'Enter a URL slug.';
    else { f.slug = uniqueSlug(wanted, existing && existing.id); if (str('slug', 100) && f.slug !== wanted) errors.slug = `That address is already used. Try "${f.slug}".`; }
  }
  if (f.status === 'published') {
    if (!f.description) errors.description = 'Add a short description before publishing.';
    if (needsPage && gen.text(f.body_html).length < 20) errors.body_html = 'Write the article content before publishing.';
    if (f.type === 'external-news' && !f.external_url) errors.external_url = 'Add the link to the original article.';
    if (f.type === 'clipping' && !clips.length) errors.clip_files = 'Upload at least one clipping image or PDF.';
    if (f.type === 'clipping' && !f.image && !clips.some(c => !/\.pdf$/i.test(c))) errors.image = 'A PDF clipping needs a thumbnail image for its card.';
    if (f.type !== 'clipping' && !f.image) errors.image = 'Add a featured image before publishing.';
    if (gen.NEWS_TYPES.includes(f.type) && f.type !== 'company-news' && !f.publisher) errors.publisher = 'Choose or add the publisher.';
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
  return f;
}

function backupDb(tag) {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const dest = path.join(BACKUPS, `content-${stamp}${tag ? '-' + tag : ''}.db`);
  db.exec('PRAGMA wal_checkpoint');
  fs.copyFileSync(path.join(DATA, 'content.db'), dest);
  const old = fs.readdirSync(BACKUPS).filter(f => /^content-.*\.db$/.test(f)).sort();
  while (old.length > 40) fs.unlinkSync(path.join(BACKUPS, old.shift()));
  return dest;
}

// run a change and rebuild the site as one step: if the site can't be rebuilt, the change is undone
function commit(change) {
  db.exec('BEGIN');
  let out, result;
  try { out = change(); result = gen.build(db); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e instanceof HttpError ? e : new HttpError(500, e.message); }
  let site;
  try { site = gen.write(db, result); }
  catch (e) { throw new HttpError(500, 'Saved, but the website files could not be updated: ' + e.message); }
  return { out, site };
}

const publicItem = it => it && ({ ...it, clip_files: JSON.parse(it.clip_files || '[]'), faqs: JSON.parse(it.faqs || '[]'), schema_json: it.schema_json ? JSON.stringify(JSON.parse(it.schema_json), null, 4) : '', legacy: !!it.legacy_url, url: gen.itemUrl(it), card_image: gen.cardImage(it), has_page: gen.hasPage(it) });

// ------------------------------------------------------------------ uploads
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.length > 5 && buf.slice(0, 5).toString() === '%PDF-') return 'pdf';
  return null;
}
async function upload(req, url) {
  const folder = url.searchParams.get('folder');
  if (!UPLOAD_DIRS[folder]) throw new HttpError(400, 'Unknown upload folder.');
  const buf = await readBody(req, MAX_PDF);
  const kind = sniff(buf);
  if (!kind) throw new HttpError(415, 'Only JPG, PNG, WEBP images' + (folder === 'clippings' ? ' or PDF files' : '') + ' can be uploaded.');
  if (kind === 'pdf' && folder !== 'clippings') throw new HttpError(415, 'PDF files can only be uploaded as newspaper clippings.');
  if (kind !== 'pdf' && buf.length > MAX_IMAGE) throw new HttpError(413, 'Images must be smaller than 15 MB.');
  const base = gen.slugify(path.parse(url.searchParams.get('name') || 'file').name).slice(0, 60) || 'file';
  const name = `${base}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)}.${kind}`;
  const rel = UPLOAD_DIRS[folder] + '/' + name;
  fs.writeFileSync(path.join(ROOT, rel), buf);
  db.prepare('INSERT INTO pending (path, action, at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET action = excluded.action, at = excluded.at').run(rel, 'upload', new Date().toISOString());
  return { path: rel, size: buf.length, kind };
}

// ------------------------------------------------------------------ API
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const hasPw = !!setting('password');
  if (p === '/api/state' && m === 'GET') return send(res, 200, { setup: !hasPw, authed: hasPw && authed(req) });

  if (m !== 'GET') {            // browser requests from any other site are refused
    const origin = req.headers.origin;
    if (req.headers['x-cms'] !== '1' || (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) throw new HttpError(403, 'Request refused.');
  }
  if (p === '/api/setup' && m === 'POST') {
    if (hasPw) throw new HttpError(403, 'A password is already set.');
    const { password } = await readJson(req);
    if (typeof password !== 'string' || password.length < 8) throw new HttpError(422, 'Use a password of at least 8 characters.');
    setting('password', hashPw(password)); startSession(res);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    if (Date.now() < lockedUntil) throw new HttpError(429, 'Too many wrong attempts. Wait a minute and try again.');
    const { password } = await readJson(req);
    if (!hasPw || typeof password !== 'string' || !checkPw(password, setting('password'))) {
      if (++fails >= 5) { fails = 0; lockedUntil = Date.now() + 60000; }
      throw new HttpError(401, 'Wrong password.');
    }
    fails = 0; startSession(res);
    return send(res, 200, { ok: true });
  }
  if (!authed(req)) throw new HttpError(401, 'Please log in.');

  if (p === '/api/logout' && m === 'POST') { sessions.delete(cookieToken(req)); res.setHeader('Set-Cookie', 'cms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res, 200, { ok: true }); }
  if (p === '/api/password' && m === 'POST') {
    const { current, password } = await readJson(req);
    if (!checkPw(String(current || ''), setting('password'))) throw new HttpError(401, 'Current password is wrong.');
    if (typeof password !== 'string' || password.length < 8) throw new HttpError(422, 'Use a password of at least 8 characters.');
    setting('password', hashPw(password));
    return send(res, 200, { ok: true });
  }
  if (p === '/api/meta' && m === 'GET') {
    const used = t => db.prepare(`SELECT DISTINCT category FROM items WHERE category <> '' AND type IN (${t.map(() => '?').join(',')})`).all(...t).map(r => r.category);
    return send(res, 200, {
      types: TYPES.map(t => ({ key: t, label: gen.TYPE_LABELS[t] })),
      blogCategories: [...new Set([...gen.BLOG_CATEGORIES, ...used(gen.BLOG_TYPES)])],
      newsCategories: [...new Set([...Object.keys(gen.NEWS_CATEGORIES), ...used(gen.NEWS_TYPES)])],
      publishers: db.prepare('SELECT name, logo FROM publishers ORDER BY name').all(),
      counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM items GROUP BY status').all().map(r => [r.status, r.c])),
      pending: db.prepare('SELECT COUNT(*) c FROM pending').get().c
    });
  }
  if (p === '/api/items' && m === 'GET') {
    const q = url.searchParams, where = [], args = [];
    if (TYPES.includes(q.get('type'))) { where.push('type = ?'); args.push(q.get('type')); }
    if (STATUSES.includes(q.get('status'))) { where.push('status = ?'); args.push(q.get('status')); }
    if (q.get('category')) { where.push('category = ?'); args.push(q.get('category')); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('from') || '')) { where.push('pub_date >= ?'); args.push(q.get('from')); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('to') || '')) { where.push('pub_date <= ?'); args.push(q.get('to')); }
    if (q.get('q')) { where.push('(title LIKE ? OR description LIKE ? OR publisher LIKE ?)'); const like = '%' + q.get('q').replace(/[%_]/g, '') + '%'; args.push(like, like, like); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const size = 20, page = Math.max(1, parseInt(q.get('page')) || 1);
    const total = db.prepare(`SELECT COUNT(*) c FROM items ${w}`).get(...args).c;
    const rows = db.prepare(`SELECT * FROM items ${w} ORDER BY pub_date DESC, sort_key ASC, id DESC LIMIT ? OFFSET ?`).all(...args, size, (page - 1) * size);
    return send(res, 200, { total, page, pages: Math.max(1, Math.ceil(total / size)), items: rows.map(r => { const it = publicItem(r); delete it.body_html; return it; }) });
  }
  if (p === '/api/items' && m === 'POST') {
    const input = await readJson(req), f = clean(input, null), now = new Date().toISOString();
    const { out, site } = commit(() => {
      upsertPublisher(f.publisher, input.publisher_logo);
      const r = db.prepare(`INSERT INTO items (type, status, title, description, body_html, category, author, pub_date, publisher, image, image_alt, clip_files, external_url, seo_title, meta_description, slug, faqs, keywords, schema_json, sort_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, -1, ?, ?)`).run(f.type, f.status, f.title, f.description, f.body_html, f.category, f.author, f.pub_date, f.publisher, f.image, f.image_alt, f.clip_files, f.external_url, f.seo_title, f.meta_description, f.slug, f.faqs, f.keywords, f.schema_json, now, now);
      return Number(r.lastInsertRowid);
    });
    return send(res, 200, { item: publicItem(db.prepare('SELECT * FROM items WHERE id = ?').get(out)), site });
  }
  const idm = /^\/api\/items\/(\d+)(\/status)?$/.exec(p);
  if (idm) {
    const id = Number(idm[1]), existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) throw new HttpError(404, 'That item no longer exists.');
    if (m === 'GET' && !idm[2]) return send(res, 200, { item: publicItem(existing) });
    if (m === 'PUT' && !idm[2]) {
      const input = await readJson(req), f = clean(input, existing), now = new Date().toISOString();
      const label = existing.date_label && existing.pub_date === f.pub_date ? existing.date_label : null;
      const { site } = commit(() => {
        upsertPublisher(f.publisher, input.publisher_logo);
        db.prepare(`UPDATE items SET status = ?, title = ?, description = ?, body_html = ?, category = ?, author = ?, pub_date = ?, date_label = ?, publisher = ?, image = ?, image_alt = ?, clip_files = ?, external_url = ?, seo_title = ?, meta_description = ?, slug = ?, faqs = ?, keywords = ?, schema_json = ?, updated_at = ? WHERE id = ?`)
          .run(f.status, f.title, f.description, f.body_html, f.category, f.author, f.pub_date, label, f.publisher, f.image, f.image_alt, f.clip_files, existing.legacy_url ? existing.external_url : f.external_url, f.seo_title, f.meta_description, f.slug, f.faqs, f.keywords, f.schema_json, now, id);
      });
      return send(res, 200, { item: publicItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)), site });
    }
    if (m === 'POST' && idm[2]) {
      const { status } = await readJson(req);
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
      if (status === 'published') clean({ ...existing, clip_files: JSON.parse(existing.clip_files || '[]'), faqs: JSON.parse(existing.faqs || '[]'), status }, existing);   // must be complete to publish
      const { site } = commit(() => db.prepare('UPDATE items SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id));
      return send(res, 200, { item: publicItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)), site });
    }
    if (m === 'DELETE' && !idm[2]) {
      backupDb('before-delete');
      const { site } = commit(() => db.prepare('DELETE FROM items WHERE id = ?').run(id));
      return send(res, 200, { ok: true, site });
    }
  }
  if (p === '/api/upload' && m === 'POST') return send(res, 200, await upload(req, url));
  if (p === '/api/pending' && m === 'GET') return send(res, 200, { files: db.prepare('SELECT path, action, at FROM pending ORDER BY action DESC, path').all() });
  if (p === '/api/pending/clear' && m === 'POST') { db.exec('DELETE FROM pending'); return send(res, 200, { ok: true }); }
  if (p === '/api/regenerate' && m === 'POST') { const { site } = commit(() => null); return send(res, 200, { site }); }
  if (p === '/api/backup' && m === 'POST') {
    const dbFile = backupDb('manual');
    const dir = path.join(BACKUPS, 'uploads-' + path.basename(dbFile, '.db').replace('content-', ''));
    fs.cpSync(path.join(ROOT, 'uploads'), dir, { recursive: true });
    return send(res, 200, { ok: true, database: path.relative(ROOT, dbFile), uploads: path.relative(ROOT, dir) });
  }
  throw new HttpError(404, 'Not found.');
}
function upsertPublisher(name, logo) {
  if (!name) return;
  if (logo && !safeFile(logo)) throw new HttpError(422, 'Please fix the highlighted fields.', { publisher_logo: 'Upload the logo again.' });
  if (logo) db.prepare('INSERT INTO publishers (name, logo) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET logo = excluded.logo').run(name, logo);
  else db.prepare('INSERT OR IGNORE INTO publishers (name, logo) VALUES (?, NULL)').run(name);
}

// ------------------------------------------------------------------ static files (dashboard + site preview)
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/admin' ) { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
  let file;
  if (rel.startsWith('/admin/')) file = path.join(__dirname, 'admin', rel.slice(7) || 'index.html');
  else {
    if (/^\/(cms|\.git|\.claude)(\/|$)/i.test(rel)) { res.writeHead(403); return res.end('Forbidden'); }
    file = path.join(ROOT, rel);
    if (rel.endsWith('/')) file = path.join(file, 'index.html');
  }
  const base = rel.startsWith('/admin/') ? path.join(__dirname, 'admin') : ROOT;
  if (!path.resolve(file).startsWith(path.resolve(base))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}

// ------------------------------------------------------------------ start
importExisting();
backupDb('start');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  api(req, res, url).catch(e => {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message || 'Something went wrong.', fields: e.fields });
  });
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Tat:vm CMS is running.\n  Dashboard:     http://localhost:${PORT}/admin/\n  Site preview:  http://localhost:${PORT}/\n\n  Keep this window open while you work. Close it to stop.\n`);
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use — the CMS may already be running. Open http://localhost:${PORT}/admin/` : e.message); process.exit(1); });
