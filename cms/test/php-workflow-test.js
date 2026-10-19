// End-to-end test of the ONLINE (PHP) Content Manager against a COPY of the website, served by PHP's built-in server.
//   node cms/test/php-workflow-test.js <path-to-site-copy> <path-to-php.exe>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2] || ''), PHP = process.argv[3];
const REAL = path.resolve(__dirname, '..', '..');
if (!process.argv[2] || !PHP || !fs.existsSync(path.join(SITE, 'blogs.html'))) { console.error('Usage: node php-workflow-test.js <copy-of-site> <php executable>'); process.exit(2); }
if (SITE === REAL) { console.error('Refusing to run the test on the real website folder.'); process.exit(2); }
const PORT = 4793, BASE = 'http://127.0.0.1:' + PORT, API = BASE + '/admin/api.php?r=';

// fresh admin + uploads in the copy
fs.rmSync(path.join(SITE, 'admin'), { recursive: true, force: true }); fs.rmSync(path.join(SITE, 'uploads'), { recursive: true, force: true });
fs.cpSync(path.join(REAL, 'admin'), path.join(SITE, 'admin'), { recursive: true });
fs.rmSync(path.join(SITE, 'admin', 'data', 'backups'), { recursive: true, force: true });
for (const d of ['blogs', 'news', 'clippings', 'publishers']) fs.mkdirSync(path.join(SITE, 'uploads', d), { recursive: true });
// the copied database may carry the real admin password: clear it in the COPY so first-time setup can be tested
{ const { DatabaseSync } = require('node:sqlite'), dataDir = path.join(SITE, 'admin', 'data');
  const db = new DatabaseSync(path.join(dataDir, fs.readdirSync(dataDir).find(f => /\.db$/.test(f))));
  db.exec("DELETE FROM settings WHERE key = 'password'"); try { db.exec('DELETE FROM throttle'); } catch (e) {} db.close();
  if (!fs.existsSync(path.join(dataDir, 'setup-code.php'))) fs.writeFileSync(path.join(dataDir, 'setup-code.php'), "<?php\nif (!defined('CMS')) { http_response_code(403); exit; }\nreturn 'TESTS-ONLY1';\n"); }
const CODE = (/return '([^']+)'/.exec(fs.readFileSync(path.join(SITE, 'admin/data/setup-code.php'), 'utf8')) || [])[1];

let cookie = '', token = '', pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); } };
const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const exists = f => fs.existsSync(path.join(SITE, f));
async function call(method, route, body, opts = {}) {
  const headers = { ...(opts.noHeader ? {} : { 'X-CMS': '1' }), ...(opts.noToken ? {} : { 'X-CMS-Token': token }), ...(opts.noCookie ? {} : { Cookie: cookie }), ...(opts.origin ? { Origin: opts.origin } : {}) };
  let b = body;
  if (body && !(body instanceof Buffer)) { b = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const [r, qs] = route.split('?');
  const res = await fetch(API + encodeURIComponent(r) + (qs ? '&' + qs : ''), { method, headers, body: b });
  if (!opts.noCookie) for (const sc of res.headers.getSetCookie ? res.headers.getSetCookie() : []) if (/^tatvm_cms=/.test(sc) && !/deleted/.test(sc)) cookie = sc.split(';')[0];
  let data = {}; const txt = await res.text(); try { data = JSON.parse(txt); } catch (e) { data = { raw: txt.slice(0, 300) }; }
  if (data.token) token = data.token;
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') || '' };
}
const arr = (file, name) => Function('"use strict"; return ' + new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n[ \\t]*\\]);').exec(read(file))[1])();
const dec = l => l.map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : v])));
const pick = (list, keys) => dec(list).map(o => keys.map(k => JSON.stringify(o[k])).join('|'));
const homeBlogs = () => [...read('index.html').split('<!-- Carousel 1: Blogs -->')[1].split('homepage-news')[0].matchAll(/<a href="([^"]+)" class="art-card">/g)].map(m => m[1]);
const B = ['title', 'excerpt', 'category', 'date', 'readTime', 'image', 'url'], N = ['title', 'excerpt', 'category', 'date', 'image', 'type', 'source', 'externalUrl', 'pages', 'file'];

(async () => {
  const origBlogs = arr('blogs.html', 'BLOG_POSTS'), origNews = arr('news.html', 'NEWS_ITEMS'), origHomeNews = arr('index.html', 'HOMEPAGE_NEWS'), origHomeBlogs = homeBlogs();
  const pageHash = () => ['blog', 'News'].flatMap(d => fs.readdirSync(path.join(SITE, d)).map(f => d + '/' + f + ':' + fs.statSync(path.join(SITE, d, f)).size)).sort().join(',');
  const origHash = pageHash();
  const pageDiff = () => { const a = origHash.split(','), b = pageHash().split(','); return [...a.filter(x => !b.includes(x)).map(x => '-' + x), ...b.filter(x => !a.includes(x)).map(x => '+' + x)].join(' '); };
  const before = Object.fromEntries(['blogs.html', 'news.html', 'index.html', 'sitemap.xml'].map(f => [f, read(f)]));

  const srv = spawn(PHP, ['-S', '127.0.0.1:' + PORT, '-t', SITE], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/robots.txt'); break; } catch (e) { await new Promise(r => setTimeout(r, 200)); } }

  try {
    console.log('\nSecurity');
    ok((await call('GET', 'state')).data.setup === true, 'first run asks for setup');
    ok((await call('GET', 'items')).status === 401, 'content API refuses requests before login');
    ok((await call('POST', 'setup', { password: 'a-long-test-password', code: 'WRONG-CODE' })).status === 403, 'setup refused without the correct setup code');
    ok((await call('POST', 'setup', { password: 'short', code: CODE })).status === 422, 'short password rejected');
    ok((await call('POST', 'setup', { password: 'a-long-test-password', code: CODE }, { origin: 'https://evil.example' })).status === 403, 'request from another website (Origin) refused');
    const s = await call('POST', 'setup', { password: 'a-long-test-password', code: CODE });
    ok(s.status === 200 && cookie && token, 'password set with the setup code, session started', JSON.stringify(s.data));
    ok(/HttpOnly/i.test(s.setCookie) && /SameSite=Strict/i.test(s.setCookie), 'session cookie is HttpOnly and SameSite=Strict', s.setCookie);
    ok(!exists('admin/data/setup-code.php'), 'setup code file removed after use');
    ok((await call('POST', 'setup', { password: 'another-long-password', code: CODE })).status === 403, 'password cannot be set a second time');
    ok((await call('GET', 'items', null, { noCookie: true })).status === 401, 'no session cookie -> refused');
    ok((await call('POST', 'regenerate', null, { noToken: true })).status === 403, 'missing CSRF token -> refused');
    ok((await call('POST', 'regenerate', null, { noHeader: true })).status === 403, 'missing request header -> refused');
    ok((await fetch(API + 'items%2F1%2Fdelete', { method: 'DELETE', headers: { Cookie: cookie, 'X-CMS': '1', 'X-CMS-Token': token } })).status === 405, 'unsupported HTTP method refused');
    const savedCookie = cookie, savedToken = token; cookie = ''; token = '';
    ok((await call('POST', 'login', { password: 'wrong-password-123' })).status === 401, 'wrong password rejected');
    for (let i = 0; i < 4; i++) await call('POST', 'login', { password: 'wrong-' + i });
    ok((await call('POST', 'login', { password: 'a-long-test-password' })).status === 429, 'login locked after 5 wrong attempts (even with the right password)');
    cookie = savedCookie; token = savedToken;
    ok((await call('GET', 'items')).status === 200, 'existing session still works during the lockout');
    const dbRaw = fs.readFileSync(path.join(SITE, 'admin/data', fs.readdirSync(path.join(SITE, 'admin/data')).find(f => /.db$/.test(f)))).toString('latin1');
    ok(!dbRaw.includes('a-long-test-password') && /\$2y\$|\$argon2/.test(dbRaw), 'password is stored hashed, not in plain text');
    const lib = await fetch(BASE + '/admin/lib/generator.php'); ok(lib.status === 403 && (await lib.text()) === '', 'code library cannot be run or read directly');

    console.log('\nExisting content is preserved');
    const list = (await call('GET', 'items?status=published')).data;
    ok(list.total === origBlogs.length + origNews.length, `all existing items are in the database (${list.total})`);
    const regen = await call('POST', 'regenerate');
    ok(regen.status === 200, 'first rebuild of the site succeeds', JSON.stringify(regen.data));
    console.log('       (files the PHP generator rewrote on first run: ' + (regen.data.site.changed.join(', ') || 'none — identical to the current site') + ')');
    const same = (a, b, keys, name) => { const x = pick(a, keys), y = pick(b, keys); const i = x.findIndex((v, k) => v !== y[k]); ok(x.length === y.length && i < 0, name, i >= 0 ? `first difference at #${i + 1}: ${x[i]} vs ${y[i]}` : `${x.length} vs ${y.length}`); };
    same(origBlogs, arr('blogs.html', 'BLOG_POSTS'), [...B, 'alt'], 'blog listing: same posts, same order, same details');
    same(origNews, arr('news.html', 'NEWS_ITEMS'), N, 'news listing: same items, same order, same details');
    same(origHomeNews, arr('index.html', 'HOMEPAGE_NEWS'), N, 'homepage news: unchanged');
    ok(JSON.stringify(origHomeBlogs) === JSON.stringify(homeBlogs()), 'homepage blog cards: unchanged');
    ok(Object.keys(before).every(f => read(f) === before[f]), 'PHP output is byte-identical to the current site files', Object.keys(before).filter(f => read(f) !== before[f]).join(', '));
    ok(pageHash() === origHash, 'no existing article page was modified or removed', pageDiff());
    const baseline = Object.fromEntries(Object.keys(before).map(f => [f, read(f)]));
    ok((await call('POST', 'regenerate')).data.site.changed.length === 0, 'rebuilding again changes nothing (stable output)');
    ok(exists('admin/data/backups/site-before-online-cms/index.html'), 'untouched copy of the site pages kept before the first change');

    console.log('\nUploads');
    const jpg = fs.readFileSync(path.join(SITE, 'assets/img/blog/sra-builders-in-mumbai.jpg'));
    const up = (folder, name, buf) => call('POST', `upload?folder=${folder}&name=${encodeURIComponent(name)}`, buf);
    const img = await up('blogs', 'My Test Photo.JPG', jpg);
    ok(img.status === 200 && /^uploads\/blogs\/my-test-photo-[a-f0-9]{8}\.jpg$/.test(img.data.path) && exists(img.data.path), 'image upload stored in uploads/blogs/', JSON.stringify(img.data));
    ok((await up('blogs', 'evil.php', Buffer.from('<?php echo 1; ?>'))).status === 415, 'PHP file upload rejected');
    ok((await up('blogs', 'evil.jpg', Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.from('<?php echo 1; ?>')]))).status === 415, 'fake image (JPEG header + PHP code) rejected');
    const tricky = await up('blogs', 'shell.php.jpg', jpg);
    ok(tricky.status === 200 && /shell-php-[a-f0-9]{8}\.jpg$/.test(tricky.data.path) && !fs.readdirSync(path.join(SITE, 'uploads/blogs')).some(f => /\.php/i.test(f)), 'upload names can never end in or contain .php', tricky.data.path);
    ok((await up('blogs', 'x.html', Buffer.from('<html><script>alert(1)</script></html>'))).status === 415, 'HTML upload rejected');
    ok((await up('blogs', 'doc.pdf', Buffer.from('%PDF-1.4 test'))).status === 415, 'PDF refused outside clippings');
    ok((await up('../admin', 'a.jpg', jpg)).status === 400, 'upload outside the uploads folders refused');
    ok((await call('POST', `upload?folder=blogs&name=a.jpg`, jpg, { noCookie: true })).status === 401, 'upload without login refused');

    console.log('\nBlog: draft -> publish -> edit -> unpublish -> delete');
    const draft = { type: 'blog', status: 'draft', title: 'CMS Test Blog & "Quotes" <b>', description: 'A test description with an & ampersand.', pub_date: '2026-12-01', category: 'Real Estate',
      body_html: '<h2>First section</h2><p onclick="x()">Hello <b>world</b> <a href="https://example.com/a?b=1&c=2">link</a> <a href="javascript:alert(1)">bad</a></p><script>alert(1)</script><img src="../' + img.data.path + '" onerror="x()"><img src="https://evil.example/x.png"><img src="../admin/data/content.db"><h2>Second section</h2><p>More text here for the article body.</p>', image: img.data.path };
    const c1 = await call('POST', 'items', draft);
    ok(c1.status === 200 && c1.data.item.status === 'draft', 'blog saved as draft', JSON.stringify(c1.data));
    const id = c1.data.item.id, slug = c1.data.item.slug;
    ok(slug === 'cms-test-blog-and-quotes-b', 'URL slug generated from the title', slug);
    ok(!read('blogs.html').includes('CMS Test Blog') && !read('index.html').includes('CMS Test Blog') && !exists(`blog/${slug}.html`), 'draft is NOT on the website');
    ok((await call('POST', `items/${id}/status`, { status: 'published' })).status === 200, 'publish');
    const page = exists(`blog/${slug}.html`) ? read(`blog/${slug}.html`) : '';
    ok(!!page, 'article page created at blog/' + slug + '.html');
    ok(arr('blogs.html', 'BLOG_POSTS')[0].url === `blog/${slug}.html`, 'new blog is first on the blog listing page');
    ok(homeBlogs()[0] === `blog/${slug}.html` && homeBlogs().length === 6, 'new blog is the first of 6 homepage cards');
    ok(read('blogs.html').split('featured-blog-content')[1].split('</section>')[0].includes(`blog/${slug}.html`), 'new blog is the featured post');
    ok(read('sitemap.xml').includes(`/blog/${slug}.html</loc>`), 'sitemap includes the new page');
    ok(page.includes(`<link rel="canonical" href="https://tatvmgroup.com/blog/${slug}.html">`) && page.includes('"@type":"BlogPosting"') && page.includes('<meta name="description" content="A test description with an &amp; ampersand.">'), 'page has canonical, schema and meta description');
    ok(page.includes('<h1>CMS Test Blog &amp; &quot;Quotes&quot; &lt;b&gt;</h1>'), 'title is escaped safely on the page');
    const bodyPart = (page.split('<div class="article-body">')[1] || '').split('<div class="share-section">')[0];
    ok(bodyPart.includes('Hello') && !/<script|alert\(1\)|onclick=|onerror=|javascript:|evil\.example|content\.db/.test(bodyPart), 'scripts, event handlers and unsafe links/images removed from the article', bodyPart.slice(0, 400));
    ok(page.includes('<h2 id="section-1">First section</h2>') && page.includes('<a href="#section-2">Second section</a>'), 'contents list built from headings');
    ok(page.includes(`<img src="../${img.data.path}"`) && page.includes('<strong>world</strong>') && page.includes('href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener"'), 'formatting, links and images kept');
    ok((await fetch(`${BASE}/blog/${slug}.html`)).status === 200 && (await fetch(`${BASE}/${img.data.path}`)).status === 200, 'page and its image are served');
    const dup = await call('POST', 'items', { ...draft, slug });
    ok(dup.status === 422 && dup.data.fields.slug, 'duplicate URL slug refused');
    ok((await call('POST', 'items', { ...draft, slug: 'sra-builders-in-mumbai' })).status === 422, 'slug of an existing article page refused');
    ok((await call('POST', 'items', { ...draft, slug: '../../index' })).data.item.slug === 'index', 'path characters in a slug are neutralised');
    await call('POST', `items/${(await call('GET', 'items?q=CMS Test Blog&status=draft')).data.items.find(i => i.slug === 'index').id}/delete`);
    const e1 = await call('POST', `items/${id}/update`, { ...draft, status: 'published', title: 'CMS Test Blog Edited', slug: 'cms-test-blog-edited' });
    ok(e1.status === 200 && exists('blog/cms-test-blog-edited.html') && !exists(`blog/${slug}.html`), 'edit: new slug creates the new page and removes the old one', JSON.stringify(e1.data).slice(0, 200));
    ok(arr('blogs.html', 'BLOG_POSTS')[0].title === 'CMS Test Blog Edited' && read('index.html').includes('CMS Test Blog Edited') && !read('sitemap.xml').includes(slug + '.html'), 'edit is reflected on listing, homepage and sitemap');
    ok((await call('POST', `items/${id}/status`, { status: 'unpublished' })).status === 200 && !exists('blog/cms-test-blog-edited.html') && !read('blogs.html').includes('CMS Test Blog') && !read('index.html').includes('CMS Test Blog') && !read('sitemap.xml').includes('cms-test-blog'), 'unpublish removes it from every section and deletes its page');
    ok((await call('POST', `items/${id}/delete`)).status === 200 && (await call('GET', `items/${id}`)).status === 404, 'delete');
    const incomplete = await call('POST', 'items', { type: 'blog', status: 'published', title: 'No image', pub_date: '2026-12-01' });
    ok(incomplete.status === 422 && incomplete.data.fields.image && incomplete.data.fields.description && incomplete.data.fields.body_html, 'cannot publish without description, image and content');
    ok((await call('POST', 'items', { ...draft, image: '../admin/data/content.db' })).status === 422, 'image path outside uploads refused');
    ok(Object.keys(baseline).every(f => read(f) === baseline[f]), 'website is exactly as before after the blog test');


    console.log('\nRich content and schema');
    const richBody = '<h2>Costs</h2><table class="x" style="color:red"><caption>Cost table</caption><thead><tr><th scope="col" onclick="x()">Item</th><th>Cost</th></tr></thead><tbody><tr><td colspan="2">Total <sup>1</sup> H<sub>2</sub>O</td></tr></tbody></table><hr><pre><code>let a = 1;</code></pre><p><s>old</s> <mark>new</mark> <del>gone</del></p><h4>Small</h4><ol start="3"><li>three</li></ol><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc" title="Walkthrough"></iframe><iframe src="https://evil.example/x"></iframe><iframe src="javascript:alert(1)"></iframe><p>Enough text for the body here.</p>';
    const richBase = { type: 'blog', status: 'published', title: 'Rich Content Test', description: 'Rich test.', pub_date: '2026-12-05', image: img.data.path, body_html: richBody };
    const rich = await call('POST', 'items', { ...richBase, keywords: 'redevelopment, SRA',
      faqs: [{ q: 'What is SRA?', a: 'Slum Rehabilitation Authority.\n\nIt runs schemes.' }, { q: '', a: '' }],
      schema_json: '<script type="application/ld+json">{"@type":"HowTo","name":"Apply"}</script>' });
    ok(rich.status === 200, 'article with table, embed, FAQs and custom schema published', JSON.stringify(rich.data).slice(0, 300));
    const rp = exists('blog/rich-content-test.html') ? read('blog/rich-content-test.html') : '';
    ok(rp.includes('<div class="article-table-wrap"><table class="article-table"><caption>Cost table</caption><thead><tr><th scope="col">Item</th><th>Cost</th></tr></thead><tbody><tr><td colspan="2">Total <sup>1</sup> H<sub>2</sub>O</td></tr></tbody></table></div>'), 'table kept with caption, header row and merged cells; styles and handlers removed', (rp.split('<div class="article-body">')[1] || '').slice(0, 500));
    ok(rp.includes('<hr>') && rp.includes('<pre><code>let a = 1;</code></pre>') && rp.includes('<s>old</s> <mark>new</mark> <s>gone</s>') && rp.includes('<h4>Small</h4>') && rp.includes('<ol start="3">'), 'divider, code block, strikethrough, highlight, H4 and numbered-list start kept');
    ok(rp.includes('<div class="article-embed"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Walkthrough" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>') && !/evil\.example|javascript:/.test((rp.split('<div class="article-body">')[1] || '').split('<div class="share-section">')[0]), 'YouTube embed kept (privacy-enhanced player); other iframes removed');
    ok(rp.includes('<details class="faq-item"><summary>What is SRA?') && rp.includes('<p>Slum Rehabilitation Authority.</p><p>It runs schemes.</p>') && rp.includes('<a href="#section-2">Frequently Asked Questions</a>'), 'FAQ block shown on the page and listed in the contents');
    const lds = [...rp.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])), types = lds.map(o => o['@type']);
    ok(['BlogPosting', 'BreadcrumbList', 'FAQPage', 'HowTo'].every(t => types.includes(t)), 'article schema: BlogPosting + BreadcrumbList + FAQPage + the custom HowTo', types.join(','));
    const bp = lds.find(o => o['@type'] === 'BlogPosting') || {};
    ok(bp.keywords === 'redevelopment, SRA' && bp.articleSection === 'Real Estate' && bp.wordCount > 5 && bp.inLanguage === 'en-IN' && (lds.find(o => o['@type'] === 'HowTo') || {})['@context'] === 'https://schema.org', 'article schema has keywords, section, word count and language; custom schema gets @context');
    ok(((lds.find(o => o['@type'] === 'FAQPage') || {}).mainEntity || []).length === 1, 'FAQ schema lists only the answered question');
    const badSchema = await call('POST', 'items', { ...richBase, status: 'draft', title: 'Bad schema', schema_json: '{not json' });
    ok(badSchema.status === 422 && badSchema.data.fields.schema_json, 'invalid custom schema refused');
    const badFaq = await call('POST', 'items', { ...richBase, status: 'draft', title: 'Bad faq', faqs: [{ q: 'Question only', a: '' }] });
    ok(badFaq.status === 422 && badFaq.data.fields.faqs, 'FAQ without an answer refused');
    const headLd = f => [...read(f).split('</head>')[0].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const bl = headLd('blogs.html'), blogLd = bl.find(o => o['@type'] === 'Blog');
    ok(blogLd && blogLd.blogPost.length === origBlogs.length + 1 && blogLd.blogPost[0].url === 'https://tatvmgroup.com/blog/rich-content-test.html' && blogLd.publisher && bl.some(o => o['@type'] === 'BreadcrumbList'), 'blog page schema: Blog listing every post (newest first) + BreadcrumbList');
    const nl = headLd('news.html'), cp = nl.find(o => o['@type'] === 'CollectionPage');
    ok(cp && cp.mainEntity.itemListElement.length === origNews.length && cp.mainEntity.itemListElement.every(x => /^https:\/\//.test(x.url)) && nl.some(o => o['@type'] === 'BreadcrumbList'), 'news page schema: CollectionPage with an ItemList of every item + BreadcrumbList');
    ok((read('blogs.html').match(/cms:schema:start/g) || []).length === 1 && (read('news.html').match(/cms:schema:start/g) || []).length === 1, 'schema block written once per page, never duplicated');
    await call('POST', `items/${rich.data.item.id}/delete`);
    ok(!exists('blog/rich-content-test.html') && !read('blogs.html').includes('rich-content-test'), 'deleting removes the page and its schema entry');
    ok(Object.keys(baseline).every(f => read(f) === baseline[f]), 'website is exactly as before after the rich content test');

    console.log('\nExternal news link');
    ok((await call('POST', 'items', { type: 'external-news', status: 'published', title: 'Ext', description: 'd', pub_date: '2026-12-02', image: img.data.path, publisher: 'The Hindu', external_url: 'javascript:alert(1)' })).status === 422, 'invalid external URL refused');
    const x = await call('POST', 'items', { type: 'external-news', status: 'published', title: 'CMS External Story', description: 'External description.', pub_date: '2026-12-02', image: img.data.path, publisher: 'The Hindu', external_url: 'https://www.thehindu.com/business/test-article' });
    ok(x.status === 200, 'external news published', JSON.stringify(x.data));
    const n0 = arr('news.html', 'NEWS_ITEMS')[0];
    ok(n0.title === 'CMS External Story' && n0.type === 'external' && n0.externalUrl === 'https://www.thehindu.com/business/test-article' && n0.source === 'The Hindu', 'first news card opens the original article URL');
    ok(arr('index.html', 'HOMEPAGE_NEWS')[0].externalUrl === n0.externalUrl, 'homepage news shows it first');
    ok(read('news.html').split('featured-news-content')[1].split('</section>')[0].includes('href="https://www.thehindu.com/business/test-article" target="_blank"'), 'featured news links to the external article');
    ok(!exists('News/cms-external-story.html'), 'no detail page is generated for an external link');
    ok((await call('POST', `items/${x.data.item.id}/status`, { status: 'draft' })).status === 200 && !read('news.html').includes('CMS External Story'), 'moving back to draft removes it');
    ok((await call('POST', `items/${x.data.item.id}/delete`)).status === 200, 'delete');
    ok(Object.keys(baseline).every(f => read(f) === baseline[f]), 'website is exactly as before after the external-news test');

    console.log('\nNewspaper clipping');
    const clipImg = await up('clippings', 'clip page 1.jpg', jpg), pdf = await up('clippings', 'page.pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 32)])), logo = await up('publishers', 'Mint Logo.jpg', jpg);
    ok(clipImg.status === 200 && pdf.status === 200 && /\.pdf$/.test(pdf.data.path) && logo.status === 200, 'clipping image, PDF and publisher logo uploaded');
    ok((await call('POST', 'items', { type: 'clipping', status: 'published', title: 'PDF only', description: 'd', pub_date: '2026-12-03', publisher: 'Mint', clip_files: [pdf.data.path] })).status === 422, 'PDF-only clipping needs a thumbnail');
    const c = await call('POST', 'items', { type: 'clipping', status: 'published', title: 'CMS Clipping Story', description: 'Clipping description.', pub_date: '2026-12-03', publisher: 'Mint', publisher_logo: logo.data.path, clip_files: [clipImg.data.path, pdf.data.path] });
    ok(c.status === 200, 'clipping published', JSON.stringify(c.data));
    const k0 = arr('news.html', 'NEWS_ITEMS')[0];
    ok(k0.type === 'clipping' && k0.pages.length === 2 && k0.pages[0] === clipImg.data.path && k0.image === clipImg.data.path && k0.source === 'Mint', 'clipping card uses the clipping thumbnail and opens the uploaded pages');
    ok(read('news.html').includes(`'Mint': '${logo.data.path}'`) && read('index.html').includes(`'Mint': '${logo.data.path}'`), 'publisher logo registered for the card badge');
    ok(/data-clip="uploads\/clippings\/[^"]+"/.test(read('news.html').split('featured-news-content')[1].split('</section>')[0]), 'featured clipping opens the zoom viewer');
    const e2 = await call('POST', `items/${c.data.item.id}/update`, { type: 'clipping', status: 'published', title: 'CMS Clipping Story v2', description: 'Clipping description.', pub_date: '2026-12-03', publisher: 'Mint', clip_files: [clipImg.data.path] });
    ok(e2.status === 200 && arr('news.html', 'NEWS_ITEMS')[0].title === 'CMS Clipping Story v2' && arr('news.html', 'NEWS_ITEMS')[0].pages.length === 1, 'clipping edit reflected');
    ok((await call('POST', `items/${c.data.item.id}/delete`)).status === 200 && !read('news.html').includes('CMS Clipping Story'), 'delete removes the clipping card');

    console.log('\nInternal news article + existing items');
    const pr = await call('POST', 'items', { type: 'pr-article', status: 'published', title: 'CMS PR Article', description: 'PR description.', pub_date: '2026-12-04', image: img.data.path, publisher: 'Mint', external_url: 'https://www.livemint.com/x', body_html: '<p>This is the body of the press article for testing.</p>' });
    const prPage = exists('News/cms-pr-article.html') ? read('News/cms-pr-article.html') : '';
    ok(pr.status === 200 && prPage.includes('"@type":"NewsArticle"') && prPage.includes('href="../news.html"') && prPage.includes('<strong>Read More:</strong> <a href="https://www.livemint.com/x" target="_blank"'), 'PR article gets a News/ page with schema and a Read More link', JSON.stringify(pr.data).slice(0, 200));
    ok(arr('news.html', 'NEWS_ITEMS')[0].type === 'article' && arr('news.html', 'NEWS_ITEMS')[0].externalUrl === 'News/cms-pr-article.html', 'card opens the internal detail page');
    await call('POST', `items/${pr.data.item.id}/delete`);
    ok(!exists('News/cms-pr-article.html'), 'deleting removes its page');
    const legacy = (await call('GET', 'items?q=Pitru')).data.items[0];
    ok(legacy && legacy.legacy, 'existing article is listed and marked as pre-CMS');
    await call('POST', `items/${legacy.id}/status`, { status: 'unpublished' });
    ok(!read('news.html').includes('Pitru Paksha 2026') && exists('News/pitru-paksha-2026-new-projects-ghatkopar-west.html'), 'unpublishing an existing item hides its card but never deletes its page');
    await call('POST', `items/${legacy.id}/status`, { status: 'published' });
    ok(pick(arr('news.html', 'NEWS_ITEMS'), N).join() === pick(origNews, N).join() && read('blogs.html') === baseline['blogs.html'] && read('sitemap.xml') === baseline['sitemap.xml'], 'after all tests the listings match the original content again');
    ok(pageHash() === origHash, 'all original article pages are intact', pageDiff());
    ok((await call('POST', 'backup')).status === 200 && fs.readdirSync(path.join(SITE, 'admin/data/backups')).some(f => /^content-.*\.db$/.test(f)) && fs.readdirSync(path.join(SITE, 'admin/data/backups')).some(f => /^uploads-/.test(f)), 'backup of database and uploads created');
    ok((await call('POST', 'password', { current: 'a-long-test-password', password: 'short' })).status === 422 && (await call('POST', 'password', { current: 'nope', password: 'another-long-password' })).status === 401, 'password change needs the current password and a strong new one');
    ok((await call('POST', 'logout')).status === 200 && (await call('GET', 'items')).status === 401, 'logout ends the session');
  } catch (e) { fail++; console.log('  FAIL test crashed: ' + e.stack); }
  srv.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('\nServer log (last lines):\n' + log.split('\n').filter(l => !/Accepted|Closing|\[200\]/.test(l)).slice(-25).join('\n'));
  process.exit(fail ? 1 : 0);
})();
