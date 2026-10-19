// Tat:vm CMS — turns the published records in the database into the static website files.
// build(db) only computes (nothing is written); write(db, result) saves the files that changed.
const fs = require('fs'), path = require('path');

const ROOT = process.env.CMS_ROOT || path.join(__dirname, '..');   // CMS_ROOT is only used for testing on a copy of the site
const SITE = 'https://tatvmgroup.com/';
const R = (...p) => path.join(ROOT, ...p);

const BLOG_TYPES = ['blog', 'insight'];
const NEWS_TYPES = ['company-news', 'pr-article', 'external-news', 'clipping'];
const TYPE_LABELS = { blog: 'Blog', insight: 'Insight', 'company-news': 'Company News', 'pr-article': 'PR Article', 'external-news': 'External News', clipping: 'Newspaper Clipping' };
const BLOG_CATEGORIES = ['Redevelopment', 'SRA', 'Sustainability', 'Design', 'Real Estate'];
const NEWS_CATEGORIES = { 'Press & Media': 'press', 'Company News': 'company-news', Events: 'events', Announcements: 'announcements', Awards: 'awards' };
const HOME_BLOGS = 6, HOME_NEWS = 9;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsStr = s => "'" + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ').replace(/<\/script/gi, '<\\/script') + "'";
const tpl = s => esc(s).replace(/`/g, '&#96;').replace(/\$\{/g, '$&#123;');   // safe inside the pages' template literals
const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');
const text = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const readTime = html => Math.max(1, Math.round(text(html).split(' ').filter(Boolean).length / 200));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const ymd = d => (/^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '') || []).slice(1).map(Number);
const blogDate = it => it.date_label || (([y, m, d]) => `${d} ${MONTHS[m - 1]} ${y}`)(ymd(it.pub_date));
const newsDate = it => it.date_label || (([y, m, d]) => `${MON[m - 1]} ${d}, ${y}`)(ymd(it.pub_date));
const shortDate = it => it.date_label || (([y, m, d]) => `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`)(ymd(it.pub_date));

const blogCatKey = label => slugify(label || 'Real Estate');
const newsCatKey = label => NEWS_CATEGORIES[label] || slugify(label || 'Press & Media');
const json = (s, d) => { try { return JSON.parse(s || ''); } catch (e) { return d; } };
const ldTag = o => `  <script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const absUrl = u => !u ? '' : /^https?:/.test(u) ? u : SITE + u;
const wordCount = html => { const t = text(html); return t ? t.split(' ').length : 0; };
const paras = s => String(s || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
const ORG = { '@type': 'Organization', name: 'Tat:vm Builders & Developers', url: SITE, logo: { '@type': 'ImageObject', url: SITE + 'assets/img/tatvm_logo.png' } };
const metaDesc = s => { const m = /<meta name="description" content="([^"]*)"/.exec(s); return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : ''; };
// ---- pre-rendered cards: the same markup the page scripts draw, so search engines can follow the links without JavaScript
const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
const LOGO_SPAN = 'position:absolute;left:14px;bottom:14px;top:auto;right:auto;z-index:2;display:inline-flex;align-items:center;justify-content:center;height:40px;min-width:40px;max-width:calc(100% - 28px);padding:6px;box-sizing:border-box;background:rgba(255,255,255,.96);border-radius:10px;box-shadow:0 6px 18px -6px rgba(0,0,0,.45)';
const LOGO_WIDE = 'display:block;width:auto;height:13px;max-width:150px;margin:0 5px;aspect-ratio:auto;object-fit:contain;transform:none;transition:none';
const LOGO_STD = 'display:block;width:auto;height:100%;max-width:150px;aspect-ratio:auto;object-fit:contain;border-radius:5px;transform:none;transition:none';
const logoHtml = (it, logos) => { const l = logos[it.publisher]; return l ? `<span class="news-pub" style="${LOGO_SPAN}"><img src="${esc(l)}" alt="${esc(it.publisher)}" title="${esc(it.publisher)}" loading="lazy" style="${/construction-times/.test(l) ? LOGO_WIDE : LOGO_STD}"></span>` : ''; };
function cardParts(it) {
  const clips = json(it.clip_files, []), type = it.type === 'clipping' ? 'clipping' : (it.type === 'external-news' || it.legacy_url) ? 'external' : 'article';
  const isClip = type === 'clipping', source = it.publisher || 'Tat:vm';
  const link = isClip ? (it.clip_original || clips[0] || '') : itemUrl(it);
  const clip = isClip ? ` data-clip="${esc(clips.filter(f => f !== it.clip_original || clips.length === 1).join('|'))}" data-clip-title="${esc(it.title)} — ${esc(source)}"${it.clip_original ? ` data-clip-file="${esc(it.clip_original)}"` : ''}` : '';
  const ext = type === 'external' ? ' target="_blank" rel="noopener noreferrer"' : '';
  const cta = isClip ? 'View Clipping' : type === 'external' ? 'Read Article' : 'Read More';
  return { type, isClip, source, link, clip, ext, cta, badge: newsCatKey(it.category).replace('-', ' ') };
}
const blogCard = it => `<article class="blog-card">
  <div class="blog-card-image"><img src="${esc(cardImage(it))}" alt="${esc(it.image_alt || it.title)}" loading="lazy"><span class="blog-card-badge">${esc(it.category || 'Real Estate')}</span></div>
  <div class="blog-card-content">
    <h3 class="blog-card-title">${esc(it.title)}</h3>
    <p class="blog-card-excerpt">${esc(it.description)}</p>
    <div class="blog-card-meta"><span>📅 ${esc(blogDate(it))}</span><span>⏱️ ${esc(json(it.legacy_card, {}).readTime || readTime(it.body_html) + ' min')}</span></div>
    <a href="${esc(itemUrl(it))}" class="blog-card-cta">Read More ${ARROW}</a>
  </div>
</article>`;
const newsCard = (it, logos) => { const c = cardParts(it); return `<article class="news-card">
  <div class="news-card-image"${c.clip}><img src="${esc(cardImage(it))}" alt="${esc(it.title)}" loading="lazy"><span class="news-card-badge">${esc(c.badge)}</span>${c.type === 'external' ? '<span class="news-card-external">External Link</span>' : ''}${c.isClip ? '<span class="news-card-external">Magazine Clipping</span>' : ''}${logoHtml(it, logos)}</div>
  <div class="news-card-content">
    <h3 class="news-card-title">${esc(it.title)}</h3>
    <p class="news-card-excerpt">${esc(it.description)}</p>
    <div class="news-card-meta"><span>📅 ${esc(newsDate(it))}</span></div>
    <div class="news-card-source">📍 ${esc(c.source)}</div>
    <a href="${esc(c.link)}"${c.ext} class="news-card-cta"${c.clip}>${c.cta} ${ARROW}</a>
  </div>
</article>`; };
const homeNewsCard = (it, logos) => { const c = cardParts(it); return `<article class="art-card">
  <figure class="am"${c.clip}><img src="${esc(cardImage(it))}" alt="${esc(it.title)}" loading="lazy"><span class="acat news">${esc(c.badge)}</span>${c.type === 'external' ? '<span class="acat" style="left:auto;right:14px">External link</span>' : ''}${c.isClip ? '<span class="acat" style="left:auto;right:14px">Clipping</span>' : ''}${logoHtml(it, logos)}</figure>
  <div class="ab">
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.description)}</p>
    <div class="ameta"><span>${esc(newsDate(it))} · ${esc(c.source)}</span><a href="${esc(c.link)}"${c.ext} class="link-arrow"${c.clip}>${c.cta}</a></div>
  </div>
</article>`; };
// fills a card container; the first time, the "injected by JavaScript" comment is turned into markers
function withCards(s, comment, cards, file) {
  const S = '<!-- cms:cards:start -->', E = '<!-- cms:cards:end -->';
  const block = S + '\n' + cards.join('\n') + '\n' + E;
  if (s.includes(S)) return replaceBetween(s, S, E, block, file, false);
  if (!s.includes(comment)) throw new Error(file + ': card container not found. The page layout has changed; nothing was written.');
  return s.replace(comment, () => block);
}

// listing pages: the Content Manager owns one schema block in the <head>
function withSchema(s, objects, file) {
  const S = '<!-- cms:schema:start -->', E = '<!-- cms:schema:end -->';
  const block = S + '\n' + objects.map(ldTag).join('\n') + '\n  ' + E;
  if (s.includes(S)) return replaceBetween(s, S, E, block, file, false);
  if (!s.includes('</head>')) throw new Error(file + ': </head> not found. The page layout has changed; nothing was written.');
  return s.replace('</head>', () => '  ' + block + '\n</head>');
}

function itemUrl(it) {
  if (it.legacy_url) return it.legacy_url;
  if (BLOG_TYPES.includes(it.type)) return 'blog/' + it.slug + '.html';
  if (it.type === 'external-news') return it.external_url;
  if (it.type === 'clipping') return json(it.clip_files, [])[0] || '';
  return 'News/' + it.slug + '.html';
}
const hasPage = it => !it.legacy_url && it.type !== 'external-news' && it.type !== 'clipping';
const cardImage = it => it.image || json(it.clip_files, []).find(f => !/\.pdf$/i.test(f)) || '';

// ---------------------------------------------------------------- region helpers
function between(s, startMark, endMark, file) {
  const a = s.indexOf(startMark), b = a < 0 ? -1 : s.indexOf(endMark, a + startMark.length);
  if (a < 0 || b < 0) throw new Error(`${file}: could not find the section to update (${startMark.slice(0, 50)}…). The page layout has changed; nothing was written.`);
  return [a, b];
}
function replaceBetween(s, startMark, endMark, inner, file, keepMarks = true) {
  const [a, b] = between(s, startMark, endMark, file);
  return keepMarks ? s.slice(0, a + startMark.length) + inner + s.slice(b) : s.slice(0, a) + inner + s.slice(b + endMark.length);
}
function replaceRegex(s, re, repl, file, what) {
  if (!re.test(s)) throw new Error(`${file}: could not find ${what}. The page layout has changed; nothing was written.`);
  return s.replace(re, () => repl);
}

// ---------------------------------------------------------------- listing data
const LOGO_BOX = 'position:absolute;left:18px;bottom:18px;top:auto;right:auto;z-index:2;display:inline-flex;align-items:center;justify-content:center;height:46px;min-width:46px;max-width:calc(100% - 28px);padding:6px;box-sizing:border-box;background:rgba(255,255,255,.96);border-radius:10px;box-shadow:0 6px 18px -6px rgba(0,0,0,.45)';
const LOGO_IMG = 'display:block;width:auto;height:100%;max-width:150px;aspect-ratio:auto;object-fit:contain;border-radius:5px;transform:none;transition:none';

function blogEntry(it, i, ind) {
  const card = json(it.legacy_card, {});
  const o = [
    `id: ${i + 1},`, `title: ${jsStr(tpl(it.title))},`, `excerpt: ${jsStr(tpl(it.description))},`, `category: ${jsStr(blogCatKey(it.category))},`,
    `date: ${jsStr(blogDate(it))},`, `readTime: ${jsStr(card.readTime || readTime(it.body_html) + ' min')},`, `image: ${jsStr(cardImage(it))},`,
    `alt: ${jsStr(tpl(it.image_alt || it.title))},`, `url: ${jsStr(itemUrl(it))}`
  ];
  return ind + '{\n' + o.map(l => ind + '  ' + l).join('\n') + '\n' + ind + '}';
}
function newsEntry(it, i, ind) {
  const clips = json(it.clip_files, []);
  const type = it.type === 'clipping' ? 'clipping' : (it.type === 'external-news' || it.legacy_url) ? 'external' : 'article';
  const o = [
    `id: ${i + 1},`, `title: ${jsStr(tpl(it.title))},`, `excerpt: ${jsStr(tpl(it.description))},`, `category: ${jsStr(newsCatKey(it.category))},`,
    `date: ${jsStr(newsDate(it))},`, `image: ${jsStr(cardImage(it))},`, `type: ${jsStr(type)},`, `slug: null,`, `source: ${jsStr(tpl(it.publisher || 'Tat:vm'))},`
  ];
  if (type === 'clipping') {
    o.push(`pages: [${clips.filter(f => f !== it.clip_original || clips.length === 1).map(jsStr).join(', ')}],`);
    if (it.clip_original) o.push(`file: ${jsStr(it.clip_original)},`);
    o.push(`externalUrl: ${jsStr(it.clip_original || clips[0] || '')}`);
  } else o.push(`externalUrl: ${jsStr(itemUrl(it))}`);
  return ind + '{\n' + o.map(l => ind + '  ' + l).join('\n') + '\n' + ind + '}';
}

// ---------------------------------------------------------------- detail page
function articlePage(it, ctx) {
  const isBlog = BLOG_TYPES.includes(it.type);
  const url = itemUrl(it), abs = SITE + url;
  const seoTitle = it.seo_title || `${it.title} | Tat:vm`;
  const desc = it.meta_description || it.description || '';
  const img = cardImage(it), absImg = img ? SITE + img : SITE + 'assets/img/tatvm_logo.png';
  const author = (it.author || '').trim() || 'Tat:vm Group';
  const orgAuthor = /tat\s*:?\s*v(a)?m/i.test(author);
  const dateText = isBlog ? blogDate(it) : newsDate(it);
  const catLabel = it.category || (isBlog ? 'Real Estate' : 'Press & Media');
  const listPage = isBlog ? 'blogs.html' : 'news.html', listName = isBlog ? 'Blog' : 'News & Updates';

  // body: section ids for the contents list, site-relative image paths
  let n = 0; const toc = [];
  let body = String(it.body_html || '').replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => { n++; toc.push([n, text(inner)]); return `<h2 id="section-${n}">${inner}</h2>`; });
  body = body.replace(/(<img[^>]*\ssrc=")(uploads|assets)\//g, '$1../$2/');
  body = body.replace(/<table>/g, '<div class="article-table-wrap"><table class="article-table">').replace(/<\/table>/g, '</table></div>')
    .replace(/<iframe\b[^>]*><\/iframe>/g, m => '<div class="article-embed">' + m + '</div>');
  if (it.external_url && it.type !== 'external-news') body += `\n<p><strong>Read More:</strong> <a href="${esc(it.external_url)}" target="_blank" rel="noopener">${esc(it.publisher ? 'Original article on ' + it.publisher : it.title)}</a></p>`;
  const faqs = json(it.faqs, []).filter(f => f && f.q && f.a);
  if (faqs.length) {
    n++; toc.push([n, 'Frequently Asked Questions']);
    body += `\n<h2 id="section-${n}">Frequently Asked Questions</h2>\n<div class="article-faq">\n` + faqs.map(f => `<details class="faq-item"><summary>${esc(f.q)}<span class="pm" aria-hidden="true">+</span></summary><div class="ans">${paras(f.a)}</div></details>`).join('\n') + '\n</div>';
  }

  const peers = ctx.peers.filter(p => p.id !== it.id);
  const idx = ctx.peers.findIndex(p => p.id === it.id);
  const prev = ctx.peers[idx + 1], next = ctx.peers[idx - 1];      // list is newest first
  const rel = u => /^https?:/.test(u) ? u : '../' + u;
  const ext = p => (/^https?:/.test(itemUrl(p)) ? ' target="_blank" rel="noopener"' : '');
  const linkable = peers.filter(p => p.type !== 'clipping');

  const article = { '@context': 'https://schema.org', '@type': isBlog ? 'BlogPosting' : 'NewsArticle', headline: it.title, description: desc, image: absImg,
    datePublished: it.pub_date, dateModified: (it.updated_at || it.pub_date).slice(0, 10), mainEntityOfPage: { '@type': 'WebPage', '@id': abs },
    author: orgAuthor ? { '@type': 'Organization', name: 'Tat:vm Builders & Developers', url: SITE } : { '@type': 'Person', name: author },
    publisher: { '@type': 'Organization', name: 'Tat:vm Builders & Developers', logo: { '@type': 'ImageObject', url: SITE + 'assets/img/tatvm_logo.png' } },
    articleSection: catLabel, wordCount: wordCount(it.body_html), inLanguage: 'en-IN' };
  if (it.keywords) article.keywords = it.keywords;
  if (it.external_url && it.type !== 'external-news') article.isBasedOn = it.external_url;
  const schemas = [article,
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: listName, item: SITE + listPage },
      { '@type': 'ListItem', position: 3, name: it.title, item: abs }] }];
  if (faqs.length) schemas.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  const custom = json(it.schema_json, null);
  if (custom) for (const o of Array.isArray(custom) ? custom : [custom]) schemas.push(o);
  const ld = schemas.map(ldTag).join('\n');

  const cats = isBlog
    ? ctx.blogCats.map(c => `              <a href="../blogs.html?category=${blogCatKey(c)}">${esc(c)}</a>`).join('\n')
    : `              <a href="../news.html">Press &amp; Media</a>\n              <a href="../news.html">All News</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>

<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PS4NC2GK');</script>
<!-- End Google Tag Manager -->

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(seoTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${abs}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Tat:vm">
  <meta property="og:title" content="${esc(seoTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${abs}">
  <meta property="og:image" content="${absImg}">
  <meta property="article:published_time" content="${it.pub_date}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(seoTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${absImg}">
  <meta name="theme-color" content="#8E1F24">
  <meta name="generator" content="Tat:vm CMS">
  <link rel="stylesheet" href="../assets/css/style.css?v=15">
  <link rel="stylesheet" href="../assets/css/blog-article.css?v=3">
  <link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Manrope:wght@400..800&display=swap" rel="stylesheet">
${ld}
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '2056408405119926');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=2056408405119926&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
</head>
<body>

<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PS4NC2GK"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

  <div class="loader" id="loader"><div class="in"><span data-logo="dark"></span><div class="bar"><i></i></div></div></div>
  <div id="header-slot"></div>

  <article class="article-wrapper">
    <div class="article-container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="../index.html">Home</a>
        <span>/</span>
        <a href="../${listPage}">${esc(listName)}</a>
        <span>/</span>
        <span>${esc(it.title)}</span>
      </nav>

      <header class="article-header">
        <span class="article-category">${esc(catLabel)}</span>
        <h1>${esc(it.title)}</h1>
        <div class="article-meta">
          <span>📅 <time datetime="${it.pub_date}">${esc(dateText)}</time></span>
          <span>✍️ By ${esc(author)}</span>${!isBlog && it.publisher ? `\n          <span>📰 ${esc(it.publisher)}</span>` : ''}
          <span>⏱️ ${readTime(it.body_html)} min read</span>
        </div>
      </header>
${img ? `
      <figure class="article-featured article-featured--full">
        <img src="../${esc(img)}" alt="${esc(it.image_alt || it.title)}">
      </figure>
` : ''}
      <div class="article-body-wrapper">
        <aside class="article-sidebar">${toc.length ? `
          <div class="toc-box">
            <h4>Contents</h4>
            <ul class="toc-list">
${toc.map(([i, t]) => `              <li><a href="#section-${i}">${esc(t)}</a></li>`).join('\n')}
            </ul>
          </div>
` : ''}${linkable.length ? `
          <div class="related-sidebar">
            <h4>${isBlog ? 'Latest Posts' : 'Latest News'}</h4>
${linkable.slice(0, 4).map(p => `            <div class="related-item">
              <a href="${esc(rel(itemUrl(p)))}"${ext(p)}>${esc(p.title)}</a>
              <div class="related-item-meta">${esc(shortDate(p))}</div>
            </div>`).join('\n')}
          </div>
` : ''}
          <div class="categories-box">
            <h4>${isBlog ? 'Categories' : 'News Categories'}</h4>
            <div class="categories-list">
${cats}
            </div>
          </div>
        </aside>

        <main class="article-content">
          <div class="article-body">
${body}
          </div>

          <div class="share-section">
            <span class="share-label">Share this ${isBlog ? 'article' : 'news'}:</span>
            <div class="share-buttons">
              <button class="share-btn" onclick="shareOn('twitter')" aria-label="Share on X">𝕏</button>
              <button class="share-btn" onclick="shareOn('linkedin')" aria-label="Share on LinkedIn">in</button>
              <button class="share-btn" onclick="shareOn('facebook')" aria-label="Share on Facebook">f</button>
              <button class="share-btn" onclick="shareOn('copy')" aria-label="Copy link">🔗</button>
            </div>
          </div>
${(prev && prev.type !== 'clipping') || (next && next.type !== 'clipping') ? `
          <nav class="article-navigation">
${[[prev, '← Previous ' + (isBlog ? 'Post' : 'News')], [next, 'Next ' + (isBlog ? 'Post' : 'News') + ' →']].filter(([p]) => p && p.type !== 'clipping').map(([p, label]) => `            <a href="${esc(rel(itemUrl(p)))}"${ext(p)} class="nav-link">
              <span class="nav-link-label">${label}</span>
              <span class="nav-link-title">${esc(p.title)}</span>
            </a>`).join('\n')}
          </nav>
` : ''}
          <section class="article-cta">
            <h3>Planning a home or a redevelopment in Mumbai?</h3>
            <p>Talk to the Tat:vm team, or explore our upcoming projects.</p>
            <a href="../projects.html" class="article-cta-btn">
              Explore Our Projects
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </section>
${linkable.length ? `
          <section class="article-related">
            <h3>Related ${isBlog ? 'Articles' : 'News'}</h3>
            <div class="related-grid">
${linkable.slice(0, 3).map(p => `              <article class="related-card">
                <div class="related-card-image">
                  <img src="../${esc(cardImage(p))}" alt="${esc(p.image_alt || p.title)}" loading="lazy">
                </div>
                <div class="related-card-content">
                  <h4 class="related-card-title">${esc(p.title)}</h4>
                  <div class="related-card-meta">${esc(isBlog ? blogDate(p) : newsDate(p))}</div>
                  <a href="${esc(rel(itemUrl(p)))}"${ext(p)} class="related-card-link">Read More →</a>
                </div>
              </article>`).join('\n')}
            </div>
          </section>
` : ''}        </main>
      </div>
    </div>
  </article>

  <div id="footer-slot"></div>

  <script src="../assets/js/svg.js?v=7"></script>
  <script src="../assets/js/components.js?v=10"></script>
  <script src="../assets/js/main.js?v=10"></script>
  <script>
    function shareOn(platform) {
      const url = window.location.href;
      const text = ${JSON.stringify(it.title).replace(/</g, '\\u003c')};
      if (platform === 'copy') { navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!')); }
      else if (platform === 'twitter') { window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank'); }
      else if (platform === 'linkedin') { window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url), '_blank'); }
      else if (platform === 'facebook') { window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank'); }
    }
    document.querySelectorAll('.toc-list a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById(link.getAttribute('href').substring(1));
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- build
function build(db) {
  const all = db.prepare("SELECT * FROM items WHERE status = 'published' ORDER BY pub_date DESC, sort_key ASC, id DESC").all();
  const blogs = all.filter(i => BLOG_TYPES.includes(i.type)), news = all.filter(i => NEWS_TYPES.includes(i.type));
  // logo badges only for publishers that have published news
  const publishers = db.prepare('SELECT name, logo FROM publishers WHERE logo IS NOT NULL AND logo <> \'\' ORDER BY name').all().filter(p => news.some(n => n.publisher === p.name));
  const files = new Map();
  const read = f => fs.readFileSync(R(f), 'utf8');

  const blogCats = [...new Set([...BLOG_CATEGORIES, ...blogs.map(b => b.category).filter(Boolean)])];
  const newsCats = [...new Set(news.map(n => n.category || 'Press & Media'))];
  const logoMap = Object.fromEntries(publishers.map(p => [p.name, p.logo]));
  const pubMap = ind => 'const PUB_LOGOS = {\n' + publishers.map(p => `${ind}  ${jsStr(tpl(p.name))}: ${jsStr(p.logo)}`).join(',\n') + '\n' + ind + '};';

  // ---- blogs.html
  let b = read('blogs.html');
  b = replaceRegex(b, /const BLOG_POSTS = \[[\s\S]*?\n[ \t]*\];/, 'const BLOG_POSTS = [\n' + blogs.map((it, i) => blogEntry(it, i, '        ')).join(',\n') + '\n      ];', 'blogs.html', 'the blog list');
  b = replaceRegex(b, /const CATEGORY_LABELS = \{[^\n]*\};/, 'const CATEGORY_LABELS = ' + JSON.stringify(Object.fromEntries(blogCats.map(c => [blogCatKey(c), c]))) + ';', 'blogs.html', 'the category labels');
  b = replaceBetween(b, '<button class="filter-btn active" data-category="all">All Posts</button>', '</div>',
    '\n' + blogCats.map(c => `      <button class="filter-btn" data-category="${blogCatKey(c)}">${esc(c)}</button>`).join('\n') + '\n    ', 'blogs.html');
  if (blogs[0]) {
    const f = blogs[0], card = json(f.legacy_card, {});
    b = replaceBetween(b, '<section class="featured-blog">', '</section>', `
    <div class="featured-blog-content">
      <div class="featured-blog-image">
        <img src="${esc(cardImage(f))}" alt="${esc(f.image_alt || f.title)}" loading="lazy">
      </div>
      <div class="featured-blog-text">
        <div class="featured-blog-tag">Latest</div>
        <h2>${esc(f.title)}</h2>
        <div class="featured-blog-meta">
          <span>📅 ${esc(blogDate(f))}</span>
          <span>✍️ By ${esc(f.author || 'Tat:vm Group')}</span>
          <span>⏱️ ${esc(card.readTime || readTime(f.body_html) + ' min')} read</span>
        </div>
        <p>${esc(f.description)}</p>
        <a href="${esc(itemUrl(f))}" class="featured-blog-cta">
          Read Full Article
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </a>
      </div>
    </div>
  `, 'blogs.html');
  }
  b = withSchema(b, [
    { '@context': 'https://schema.org', '@type': 'Blog', '@id': SITE + 'blogs.html#blog', name: 'Tat:vm Blog', url: SITE + 'blogs.html', description: metaDesc(b), inLanguage: 'en-IN', publisher: ORG,
      blogPost: blogs.slice(0, 50).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: absUrl(itemUrl(p)), datePublished: p.pub_date, image: absUrl(cardImage(p)) })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + 'blogs.html' }] }
  ], 'blogs.html');
  b = withCards(b, '<!-- Blog cards injected by JavaScript -->', blogs.slice(0, 6).map(blogCard), 'blogs.html');
  files.set('blogs.html', b);

  // ---- index.html
  let h = read('index.html');
  const S = '<!-- cms:home-blogs:start -->', E = '<!-- cms:home-blogs:end -->';
  if (!h.includes(S)) {                       // first run: mark the homepage blog cards so later runs are exact
    const c = h.indexOf('<!-- Carousel 1: Blogs -->'), a = c < 0 ? -1 : h.indexOf('<div class="car-track slim">', c);
    const m = a < 0 ? null : /\n {6}<\/div>\n {4}<\/div>/.exec(h.slice(a));
    if (!m) throw new Error('index.html: could not find the homepage blog carousel. Nothing was written.');
    const start = a + '<div class="car-track slim">'.length, end = a + m.index;
    h = h.slice(0, start) + '\n        ' + S + h.slice(start, end) + '\n        ' + E + h.slice(end);
  }
  h = replaceBetween(h, S, E, '\n' + blogs.slice(0, HOME_BLOGS).map(it => {
    const card = json(it.legacy_card, {});
    return `        <a href="${esc(itemUrl(it))}" class="art-card">
          <figure class="am"><img src="${esc(cardImage(it))}" alt="${esc(it.image_alt || it.title)}" loading="lazy"><span class="acat">${esc(it.category || 'Real Estate')}</span></figure>
          <div class="ab">
            <h3>${esc(it.title)}</h3>
            <p>${esc(it.description)}</p>
            <div class="ameta"><span>${esc(blogDate(it))} · ${esc(card.readTime || readTime(it.body_html) + ' min')} read</span><span>Read →</span></div>
          </div>
        </a>`;
  }).join('\n') + '\n        ', 'index.html');
  h = replaceRegex(h, /const HOMEPAGE_NEWS = \[[\s\S]*?\n[ \t]*\];/, 'const HOMEPAGE_NEWS = [\n' + news.slice(0, HOME_NEWS).map((it, i) => newsEntry(it, i, '    ')).join(',\n') + '\n    ];', 'index.html', 'the homepage news list');
  h = replaceRegex(h, /const PUB_LOGOS = \{[\s\S]*?\n[ \t]*\};/, pubMap('    '), 'index.html', 'the publisher logos');
  h = h.replace(/const link = item\.type === 'internal'\s*\?[^:;]*:\s*item\.externalUrl;/, 'const link = item.externalUrl;');
  if (!h.includes('const link = item.externalUrl;')) throw new Error('index.html: could not find the news card link. Nothing was written.');
  h = withCards(h, '<!-- News cards injected by JavaScript -->', news.slice(0, HOME_NEWS).map(it => homeNewsCard(it, logoMap)), 'index.html');
  files.set('index.html', h);

  // ---- news.html
  let n = read('news.html');
  n = replaceRegex(n, /const NEWS_ITEMS = \[[\s\S]*?\n[ \t]*\];/, 'const NEWS_ITEMS = [\n' + news.map((it, i) => newsEntry(it, i, '        ')).join(',\n') + '\n      ];', 'news.html', 'the news list');
  n = replaceRegex(n, /const PUB_LOGOS = \{[\s\S]*?\n[ \t]*\};/, pubMap('      '), 'news.html', 'the publisher logos');
  n = n.replace(/const link = item\.type === 'internal'\s*\?[^:;]*:\s*item\.externalUrl;/, 'const link = item.externalUrl;');
  if (!n.includes('const link = item.externalUrl;')) throw new Error('news.html: could not find the news card link. Nothing was written.');
  n = replaceBetween(n, '<button class="filter-btn active" data-category="all">All News</button>', '</div>',
    '\n' + newsCats.map(c => `      <button class="filter-btn" data-category="${newsCatKey(c)}">${esc(c)}</button>`).join('\n') + '\n    ', 'news.html');
  if (news[0]) {
    const f = news[0], clips = json(f.clip_files, []), logo = (publishers.find(p => p.name === f.publisher) || {}).logo;
    const isClip = f.type === 'clipping', isExt = f.type === 'external-news';
    const clipAttr = isClip ? ` data-clip="${esc(clips.filter(c => c !== f.clip_original || clips.length === 1).join('|'))}" data-clip-title="${esc(f.title)} — ${esc(f.publisher || '')}"${f.clip_original ? ` data-clip-file="${esc(f.clip_original)}"` : ''}` : '';
    n = replaceBetween(n, '<section class="featured-news">', '</section>', `
    <div class="featured-news-content">
      <div class="featured-news-image"${clipAttr}>
        <img src="${esc(cardImage(f))}" alt="${esc(f.image_alt || f.title)}">${logo ? `
        <span class="news-pub" style="${LOGO_BOX}"><img src="${esc(logo)}" alt="${esc(f.publisher)}" title="${esc(f.publisher)}" style="${LOGO_IMG}"></span>` : ''}
      </div>
      <div class="featured-news-text">
        <div class="featured-news-tag">Latest</div>
        <h2>${esc(f.title)}</h2>
        <div class="featured-news-meta">
          <span>📅 ${esc(newsDate(f))}</span>
          <span>🏢 ${esc(f.category || 'Press & Media')}</span>
        </div>
        <p>${esc(f.description)}</p>
        <div class="featured-news-source">
          🔗 ${esc(f.publisher || 'Tat:vm')}
        </div>
        <a href="${esc(isClip ? (f.clip_original || clips[0] || '') : itemUrl(f))}"${isExt ? ' target="_blank" rel="noopener noreferrer"' : ''} class="featured-news-cta"${clipAttr}>
          ${isClip ? 'View Clipping' : 'Read Full Story'}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </a>
      </div>
    </div>
  `, 'news.html');
  }
  n = withSchema(n, [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': SITE + 'news.html#page', name: 'News & Updates', url: SITE + 'news.html', description: metaDesc(n), inLanguage: 'en-IN',
      isPartOf: { '@type': 'WebSite', name: 'Tat:vm', url: SITE }, publisher: ORG,
      mainEntity: { '@type': 'ItemList', numberOfItems: Math.min(news.length, 50), itemListElement: news.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(itemUrl(p)), name: p.title })) } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'News & Updates', item: SITE + 'news.html' }] }
  ], 'news.html');
  n = withCards(n, '<!-- News cards injected by JavaScript -->', news.slice(0, 9).map(it => newsCard(it, logoMap)), 'news.html');
  files.set('news.html', n);

  // ---- detail pages for content created in the CMS
  const pages = [];
  for (const it of all.filter(hasPage)) {
    const rel = itemUrl(it);
    files.set(rel, articlePage(it, { peers: BLOG_TYPES.includes(it.type) ? blogs : news, blogCats }));
    pages.push({ path: rel, lastmod: (it.updated_at || it.pub_date).slice(0, 10) });
  }

  // ---- sitemap.xml (only the block the CMS owns)
  let sm = read('sitemap.xml');
  const SS = '  <!-- cms:start -->', SE = '  <!-- cms:end -->';
  const base = sm.includes(SS) ? sm.slice(0, sm.indexOf(SS)) + sm.slice(sm.indexOf(SE) + SE.length) : sm;
  // sitemap entries = CMS pages + published pre-CMS article pages the main list lacks (these are listed only, never owned)
  const listed = pages.slice();
  for (const it of all) if (it.legacy_url && /^(blog|News)\/[A-Za-z0-9_-]+\.html$/.test(it.legacy_url) && !base.includes('<loc>' + SITE + it.legacy_url + '</loc>') && !listed.some(p => p.path === it.legacy_url))
    listed.push({ path: it.legacy_url, lastmod: it.pub_date });
  const block = SS + '\n' + listed.map(p => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`).join('') + SE;
  if (sm.includes(SS)) sm = replaceBetween(sm, SS, SE, block, 'sitemap.xml', false);
  else { if (!sm.includes('</urlset>')) throw new Error('sitemap.xml: </urlset> not found. Nothing was written.'); sm = sm.replace('</urlset>', block + '\n</urlset>'); }
  files.set('sitemap.xml', sm);

  return { files, pages: pages.map(p => p.path), counts: { blogs: blogs.length, news: news.length } };
}

// ---------------------------------------------------------------- write
function write(db, result) {
  const changed = [], removed = [];
  const known = new Set(db.prepare('SELECT path FROM generated').all().map(r => r.path));
  for (const [rel, content] of result.files) {
    const abs = R(rel);
    const isPage = result.pages.includes(rel);
    if (isPage && fs.existsSync(abs) && !known.has(rel) && !/<meta name="generator" content="Tat:vm CMS">/.test(fs.readFileSync(abs, 'utf8')))
      throw new Error(`${rel} already exists on the site and was not created by the CMS. Choose a different URL slug.`);
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) continue;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = abs + '.cms-tmp';
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, abs);
    changed.push(rel);
  }
  for (const rel of known) if (!result.pages.includes(rel)) {
    const abs = R(rel);
    if (/^(blog|News)\/[a-z0-9-]+\.html$/.test(rel) && fs.existsSync(abs)) { fs.unlinkSync(abs); removed.push(rel); }
    db.prepare('DELETE FROM generated WHERE path = ?').run(rel);
  }
  const ins = db.prepare('INSERT OR IGNORE INTO generated (path) VALUES (?)');
  for (const rel of result.pages) ins.run(rel);
  const pend = db.prepare('INSERT INTO pending (path, action, at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET action = excluded.action, at = excluded.at');
  const now = new Date().toISOString();
  for (const rel of changed) pend.run(rel, 'upload', now);
  for (const rel of removed) pend.run(rel, 'delete', now);
  return { changed, removed };
}

module.exports = { build, write, itemUrl, hasPage, cardImage, slugify, text, ROOT, SITE, BLOG_TYPES, NEWS_TYPES, TYPE_LABELS, BLOG_CATEGORIES, NEWS_CATEGORIES };
