// Rebuilds the listing pages from the database and checks that nothing that was on the site before the
// Content Manager has been lost or reordered. Compares with cms/data/backups/site-before-cms.
//   node cms/test/verify-site.js
const fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const gen = require('../generator');
const ROOT = gen.ROOT, SNAP = path.join(__dirname, '..', 'data', 'backups', 'site-before-cms');
const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'content.db'));
const arr = (file, name, dir) => Function('"use strict"; return ' + new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n[ \\t]*\\]);').exec(fs.readFileSync(path.join(dir, file), 'utf8'))[1])();
const dec = v => typeof v === 'string' ? v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#96;/g, '`') : JSON.stringify(v);
const cards = dir => [...fs.readFileSync(path.join(dir, 'index.html'), 'utf8').split('<!-- Carousel 1: Blogs -->')[1].split('homepage-news')[0].matchAll(/<a href="([^"]+)" class="art-card">[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g)].map(m => m.slice(1).join('|'));

const result = gen.build(db);
const site = gen.write(db, result);
console.log('files rewritten:', site.changed.join(', ') || 'none', '| removed:', site.removed.join(', ') || 'none');

let bad = 0;
const cmp = (file, name, keys) => {
  const a = arr(file, name, SNAP), b = arr(file, name, ROOT);
  const legacy = b.filter(x => a.some(y => dec(y.title) === dec(x.title)));
  const diffs = [];
  a.forEach((o, i) => { const n = legacy[i]; for (const k of keys) if (!n || dec(o[k]) !== dec(n[k])) diffs.push(`#${i + 1} ${k}: ${dec(o[k])} -> ${n ? dec(n[k]) : 'MISSING'}`); });
  if (diffs.length) bad++;
  console.log(`${diffs.length ? 'DIFF' : 'same'}  ${file} ${name}: ${a.length} original items, ${b.length} now${diffs.length ? '\n   ' + diffs.slice(0, 8).join('\n   ') : ''}`);
};
cmp('blogs.html', 'BLOG_POSTS', ['title', 'excerpt', 'category', 'date', 'readTime', 'image', 'alt', 'url']);
cmp('news.html', 'NEWS_ITEMS', ['title', 'excerpt', 'category', 'date', 'image', 'type', 'source', 'externalUrl', 'pages', 'file']);
cmp('index.html', 'HOMEPAGE_NEWS', ['title', 'excerpt', 'category', 'date', 'image', 'type', 'source', 'externalUrl', 'pages', 'file']);
const c0 = cards(SNAP), c1 = cards(ROOT);
const sameCards = JSON.stringify(c0) === JSON.stringify(c1); if (!sameCards) bad++;
console.log(`${sameCards ? 'same' : 'DIFF'}  index.html homepage blog cards: ${c0.length} -> ${c1.length}`);
// everything outside the CMS-managed parts of each page must be byte-identical
const strip = (file, s) => {
  s = s.replace(/ {2}<!-- cms:schema:start -->[\s\S]*?<!-- cms:schema:end -->\n/, '').replace(/const (BLOG_POSTS|NEWS_ITEMS|HOMEPAGE_NEWS) = \[[\s\S]*?\n[ \t]*\];/g, 'DATA').replace(/const PUB_LOGOS = \{[\s\S]*?\n[ \t]*\};/g, 'LOGOS').replace(/const CATEGORY_LABELS = \{[^\n]*\};/, 'CATS')
    .replace(/const link = item\.type === 'internal'\s*\?[^:;]*:\s*item\.externalUrl;/, 'const link = item.externalUrl;').replace(/\s*<!-- cms:[a-z-]+:(start|end) -->/g, '').replace(/\s*<!-- cms:(start|end) -->/g, '');
  if (file === 'index.html') s = s.replace(/(<div class="car-track slim">)[\s\S]*?(\n {6}<\/div>\n {4}<\/div>\n\n {2}<\/div>\n<\/section>\n\n<section class="section homepage-news)/, '$1CARDS$2');
  if (file === 'blogs.html') s = s.replace(/(<section class="featured-blog">)[\s\S]*?(<\/section>)/, '$1F$2').replace(/(data-category="all">All Posts<\/button>)[\s\S]*?(<\/div>)/, '$1B$2');
  if (file === 'news.html') s = s.replace(/(<section class="featured-news">)[\s\S]*?(<\/section>)/, '$1F$2').replace(/(data-category="all">All News<\/button>)[\s\S]*?(<\/div>)/, '$1B$2');
  return s;
};
for (const f of ['index.html', 'blogs.html', 'news.html', 'sitemap.xml']) {
  const a = strip(f, fs.readFileSync(path.join(SNAP, f), 'utf8')), b = strip(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const same = a === b; if (!same) bad++;
  let at = 0; while (same === false && a[at] === b[at]) at++;
  console.log(`${same ? 'same' : 'DIFF'}  ${f}: rest of the page untouched${same ? '' : '\n   first difference near: ' + JSON.stringify(a.slice(at - 60, at + 80)) + '\n   now: ' + JSON.stringify(b.slice(at - 60, at + 80))}`);
}
console.log(bad ? `\n${bad} PROBLEM(S) FOUND` : '\nAll existing content verified.');
process.exit(bad ? 1 : 0);
