<?php
// Tat:vm Content Manager — turns the published records in the database into the static website files.
// cms_build($db) only computes (nothing is written); cms_write($db, $result) saves the files that changed.
// PHP 7.4+ compatible.
if (!defined('CMS')) { http_response_code(403); exit; }

const CMS_SITE = 'https://tatvmgroup.com/';
const CMS_HOME_BLOGS = 6;
const CMS_HOME_NEWS = 9;
const CMS_BLOG_TYPES = ['blog', 'insight'];
const CMS_NEWS_TYPES = ['company-news', 'pr-article', 'external-news', 'clipping'];
const CMS_TYPE_LABELS = ['blog' => 'Blog', 'insight' => 'Insight', 'company-news' => 'Company News', 'pr-article' => 'PR Article', 'external-news' => 'External News', 'clipping' => 'Newspaper Clipping'];
const CMS_BLOG_CATEGORIES = ['Redevelopment', 'SRA', 'Sustainability', 'Design', 'Real Estate'];
const CMS_NEWS_CATEGORIES = ['Press & Media' => 'press', 'Company News' => 'company-news', 'Events' => 'events', 'Announcements' => 'announcements', 'Awards' => 'awards'];
const CMS_LOGO_BOX = 'position:absolute;left:18px;bottom:18px;top:auto;right:auto;z-index:2;display:inline-flex;align-items:center;justify-content:center;height:46px;min-width:46px;max-width:calc(100% - 28px);padding:6px;box-sizing:border-box;background:rgba(255,255,255,.96);border-radius:10px;box-shadow:0 6px 18px -6px rgba(0,0,0,.45)';
const CMS_LOGO_IMG = 'display:block;width:auto;height:100%;max-width:150px;aspect-ratio:auto;object-fit:contain;border-radius:5px;transform:none;transition:none';

function cms_root() { static $r = null; if ($r === null) $r = rtrim(str_replace('\\', '/', realpath(__DIR__ . '/../..')), '/'); return $r; }
function cms_path($rel) { return cms_root() . '/' . $rel; }

function cms_esc($s) { return htmlspecialchars((string)$s, ENT_COMPAT | ENT_SUBSTITUTE | ENT_HTML401, 'UTF-8'); }
function cms_js($s) { return "'" . preg_replace('/<\/script/i', '<\\/script', preg_replace('/\r?\n/', ' ', str_replace(['\\', "'"], ['\\\\', "\\'"], (string)$s))) . "'"; }
function cms_tpl($s) { return str_replace(['`', '${'], ['&#96;', '$&#123;'], cms_esc($s)); }   // safe inside the pages' template literals
function cms_slugify($s) {
  $s = (string)$s;
  $t = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) : false;
  if ($t !== false && $t !== '') $s = $t;
  $s = strtolower($s);
  $s = str_replace('&', ' and ', $s);
  $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
  return rtrim(substr($s, 0, 90), '-');
}
function cms_text($html) {
  $t = preg_replace('/<[^>]+>/', ' ', (string)$html);
  $t = str_replace(['&nbsp;', '&amp;', '&lt;', '&gt;', '&quot;', '&#39;'], [' ', '&', '<', '>', '"', "'"], $t);
  return trim(preg_replace('/\s+/u', ' ', $t));
}
function cms_read_time($html) { $t = cms_text($html); $n = $t === '' ? 0 : count(explode(' ', $t)); return max(1, (int)round($n / 200)); }
function cms_json($s, $default) { $v = json_decode((string)$s, true); return is_array($v) ? $v : $default; }
function cms_ld_tag($o) { return '  <script type="application/ld+json">' . str_replace('<', '\u003c', json_encode($o, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . '</script>'; }
function cms_abs_url($u) { return $u === '' || $u === null ? '' : (preg_match('/^https?:/', $u) ? $u : CMS_SITE . $u); }
function cms_word_count($html) { $t = cms_text($html); return $t === '' ? 0 : count(explode(' ', $t)); }
function cms_paras($s) {
  $out = '';
  foreach (preg_split('/\n{2,}/', (string)$s) as $p) { $p = trim($p); if ($p !== '') $out .= '<p>' . str_replace("\n", '<br>', cms_esc($p)) . '</p>'; }
  return $out;
}
function cms_org() { return ['@type' => 'Organization', 'name' => 'Tat:vm Builders & Developers', 'url' => CMS_SITE, 'logo' => ['@type' => 'ImageObject', 'url' => CMS_SITE . 'assets/img/tatvm_logo.png']]; }
function cms_meta_desc($s) { return preg_match('/<meta name="description" content="([^"]*)"/', $s, $m) ? str_replace(['&quot;', '&#39;', '&lt;', '&gt;', '&amp;'], ['"', "'", '<', '>', '&'], $m[1]) : ''; }
// ---- pre-rendered cards: the same markup the page scripts draw, so search engines can follow the links without JavaScript
const CMS_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';
const CMS_LOGO_SPAN = 'position:absolute;left:14px;bottom:14px;top:auto;right:auto;z-index:2;display:inline-flex;align-items:center;justify-content:center;height:40px;min-width:40px;max-width:calc(100% - 28px);padding:6px;box-sizing:border-box;background:rgba(255,255,255,.96);border-radius:10px;box-shadow:0 6px 18px -6px rgba(0,0,0,.45)';
const CMS_LOGO_WIDE = 'display:block;width:auto;height:13px;max-width:150px;margin:0 5px;aspect-ratio:auto;object-fit:contain;transform:none;transition:none';
const CMS_LOGO_STD = 'display:block;width:auto;height:100%;max-width:150px;aspect-ratio:auto;object-fit:contain;border-radius:5px;transform:none;transition:none';
function cms_logo_html($it, $logos) { if (empty($logos[$it['publisher']])) return ''; $l = $logos[$it['publisher']]; return '<span class="news-pub" style="' . CMS_LOGO_SPAN . '"><img src="' . cms_esc($l) . '" alt="' . cms_esc($it['publisher']) . '" title="' . cms_esc($it['publisher']) . '" loading="lazy" style="' . (preg_match('/construction-times/', $l) ? CMS_LOGO_WIDE : CMS_LOGO_STD) . '"></span>'; }
function cms_card_parts($it) {
  $clips = cms_json($it['clip_files'], []); $type = cms_news_type($it); $isClip = $type === 'clipping';
  $source = $it['publisher'] !== '' && $it['publisher'] !== null ? $it['publisher'] : 'Tat:vm';
  $link = $isClip ? (!empty($it['clip_original']) ? $it['clip_original'] : (isset($clips[0]) ? $clips[0] : '')) : cms_item_url($it);
  $clip = $isClip ? ' data-clip="' . cms_esc(implode('|', cms_clip_pages($it))) . '" data-clip-title="' . cms_esc($it['title']) . ' — ' . cms_esc($source) . '"' . (!empty($it['clip_original']) ? ' data-clip-file="' . cms_esc($it['clip_original']) . '"' : '') : '';
  $cat = cms_news_cat_key($it['category']); $p = strpos($cat, '-'); $badge = $p === false ? $cat : substr_replace($cat, ' ', $p, 1);
  return ['type' => $type, 'isClip' => $isClip, 'source' => $source, 'link' => $link, 'clip' => $clip, 'ext' => $type === 'external' ? ' target="_blank" rel="noopener noreferrer"' : '',
    'cta' => $isClip ? 'View Clipping' : ($type === 'external' ? 'Read Article' : 'Read More'), 'badge' => $badge];
}
function cms_blog_card($it) {
  return '<article class="blog-card">
  <div class="blog-card-image"><img src="' . cms_esc(cms_card_image($it)) . '" alt="' . cms_esc($it['image_alt'] !== '' && $it['image_alt'] !== null ? $it['image_alt'] : $it['title']) . '" loading="lazy"><span class="blog-card-badge">' . cms_esc($it['category'] !== '' && $it['category'] !== null ? $it['category'] : 'Real Estate') . '</span></div>
  <div class="blog-card-content">
    <h3 class="blog-card-title">' . cms_esc($it['title']) . '</h3>
    <p class="blog-card-excerpt">' . cms_esc($it['description']) . '</p>
    <div class="blog-card-meta"><span>📅 ' . cms_esc(cms_blog_date($it)) . '</span><span>⏱️ ' . cms_esc(cms_read_label($it)) . '</span></div>
    <a href="' . cms_esc(cms_item_url($it)) . '" class="blog-card-cta">Read More ' . CMS_ARROW . '</a>
  </div>
</article>';
}
function cms_news_card($it, $logos) {
  $c = cms_card_parts($it);
  return '<article class="news-card">
  <div class="news-card-image"' . $c['clip'] . '><img src="' . cms_esc(cms_card_image($it)) . '" alt="' . cms_esc($it['title']) . '" loading="lazy"><span class="news-card-badge">' . cms_esc($c['badge']) . '</span>' . ($c['type'] === 'external' ? '<span class="news-card-external">External Link</span>' : '') . ($c['isClip'] ? '<span class="news-card-external">Magazine Clipping</span>' : '') . cms_logo_html($it, $logos) . '</div>
  <div class="news-card-content">
    <h3 class="news-card-title">' . cms_esc($it['title']) . '</h3>
    <p class="news-card-excerpt">' . cms_esc($it['description']) . '</p>
    <div class="news-card-meta"><span>📅 ' . cms_esc(cms_news_date($it)) . '</span></div>
    <div class="news-card-source">📍 ' . cms_esc($c['source']) . '</div>
    <a href="' . cms_esc($c['link']) . '"' . $c['ext'] . ' class="news-card-cta"' . $c['clip'] . '>' . $c['cta'] . ' ' . CMS_ARROW . '</a>
  </div>
</article>';
}
function cms_home_news_card($it, $logos) {
  $c = cms_card_parts($it);
  return '<article class="art-card">
  <figure class="am"' . $c['clip'] . '><img src="' . cms_esc(cms_card_image($it)) . '" alt="' . cms_esc($it['title']) . '" loading="lazy"><span class="acat news">' . cms_esc($c['badge']) . '</span>' . ($c['type'] === 'external' ? '<span class="acat" style="left:auto;right:14px">External link</span>' : '') . ($c['isClip'] ? '<span class="acat" style="left:auto;right:14px">Clipping</span>' : '') . cms_logo_html($it, $logos) . '</figure>
  <div class="ab">
    <h3>' . cms_esc($it['title']) . '</h3>
    <p>' . cms_esc($it['description']) . '</p>
    <div class="ameta"><span>' . cms_esc(cms_news_date($it)) . ' · ' . cms_esc($c['source']) . '</span><a href="' . cms_esc($c['link']) . '"' . $c['ext'] . ' class="link-arrow"' . $c['clip'] . '>' . $c['cta'] . '</a></div>
  </div>
</article>';
}
// fills a card container; the first time, the "injected by JavaScript" comment is turned into markers
function cms_with_cards($s, $comment, $cards, $file) {
  $S = '<!-- cms:cards:start -->'; $E = '<!-- cms:cards:end -->';
  $block = $S . "\n" . implode("\n", $cards) . "\n" . $E;
  if (strpos($s, $S) !== false) return cms_replace_between($s, $S, $E, $block, $file, false);
  $p = strpos($s, $comment); if ($p === false) cms_fail($file, 'the card container');
  return substr($s, 0, $p) . $block . substr($s, $p + strlen($comment));
}

// listing pages: the Content Manager owns one schema block in the <head>
function cms_with_schema($s, $objects, $file) {
  $S = '<!-- cms:schema:start -->'; $E = '<!-- cms:schema:end -->';
  $block = $S . "\n" . implode("\n", array_map('cms_ld_tag', $objects)) . "\n  " . $E;
  if (strpos($s, $S) !== false) return cms_replace_between($s, $S, $E, $block, $file, false);
  $p = strpos($s, '</head>'); if ($p === false) cms_fail($file, '</head>');
  return substr($s, 0, $p) . '  ' . $block . "\n" . substr($s, $p);
}
function cms_ymd($d) { return preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string)$d, $m) ? [(int)$m[1], (int)$m[2], (int)$m[3]] : [1970, 1, 1]; }
function cms_blog_date($it) {
  if (!empty($it['date_label'])) return $it['date_label'];
  $M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  list($y, $m, $d) = cms_ymd($it['pub_date']); return $d . ' ' . $M[$m - 1] . ' ' . $y;
}
function cms_news_date($it) {
  if (!empty($it['date_label'])) return $it['date_label'];
  $M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  list($y, $m, $d) = cms_ymd($it['pub_date']); return $M[$m - 1] . ' ' . $d . ', ' . $y;
}
function cms_short_date($it) {
  if (!empty($it['date_label'])) return $it['date_label'];
  $M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  list($y, $m, $d) = cms_ymd($it['pub_date']); return $d . ' ' . $M[$m - 1] . ' ' . $y;
}
function cms_blog_cat_key($label) { return cms_slugify($label !== '' && $label !== null ? $label : 'Real Estate'); }
function cms_news_cat_key($label) { $c = CMS_NEWS_CATEGORIES; if (isset($c[$label])) return $c[$label]; return cms_slugify($label !== '' && $label !== null ? $label : 'Press & Media'); }
function cms_is_blog($it) { return in_array($it['type'], CMS_BLOG_TYPES, true); }
function cms_item_url($it) {
  if (!empty($it['legacy_url'])) return $it['legacy_url'];
  if (cms_is_blog($it)) return 'blog/' . $it['slug'] . '.html';
  if ($it['type'] === 'external-news') return (string)$it['external_url'];
  if ($it['type'] === 'clipping') { $c = cms_json($it['clip_files'], []); return isset($c[0]) ? $c[0] : ''; }
  return 'News/' . $it['slug'] . '.html';
}
function cms_has_page($it) { return empty($it['legacy_url']) && $it['type'] !== 'external-news' && $it['type'] !== 'clipping'; }
function cms_card_image($it) {
  if (!empty($it['image'])) return $it['image'];
  foreach (cms_json($it['clip_files'], []) as $f) if (!preg_match('/\.pdf$/i', $f)) return $f;
  return '';
}
function cms_read_label($it) { $card = cms_json(isset($it['legacy_card']) ? $it['legacy_card'] : '', []); return !empty($card['readTime']) ? $card['readTime'] : cms_read_time($it['body_html']) . ' min'; }
function cms_clip_pages($it) {
  $clips = cms_json($it['clip_files'], []); $orig = isset($it['clip_original']) ? $it['clip_original'] : null;
  if (count($clips) === 1) return $clips;
  return array_values(array_filter($clips, function ($f) use ($orig) { return $f !== $orig; }));
}

// ---------------------------------------------------------------- region helpers
class CmsLayoutError extends Exception {}
function cms_fail($file, $what) { throw new CmsLayoutError($file . ': could not find ' . $what . '. The page layout has changed; nothing was written.'); }
function cms_replace_between($s, $start, $end, $inner, $file, $keepMarks = true) {
  $a = strpos($s, $start); $b = $a === false ? false : strpos($s, $end, $a + strlen($start));
  if ($a === false || $b === false) cms_fail($file, 'the section to update (' . substr($start, 0, 50) . '…)');
  return $keepMarks ? substr($s, 0, $a + strlen($start)) . $inner . substr($s, $b) : substr($s, 0, $a) . $inner . substr($s, $b + strlen($end));
}
// replaces "const NAME = [ ... ];" or "const NAME = { ... };" (closing bracket alone on its line)
function cms_replace_literal($s, $name, $open, $close, $replacement, $file) {
  $head = 'const ' . $name . ' = ' . $open;
  $a = strpos($s, $head);
  if ($a === false || !preg_match('/\n[ \t]*' . preg_quote($close, '/') . ';/', $s, $m, PREG_OFFSET_CAPTURE, $a)) cms_fail($file, 'the ' . $name . ' list');
  return substr($s, 0, $a) . $replacement . substr($s, $m[0][1] + strlen($m[0][0]));
}
function cms_fix_link($s, $file) {
  $s = preg_replace('/const link = item\.type === \'internal\'\s*\?[^:;]*:\s*item\.externalUrl;/', 'const link = item.externalUrl;', $s);
  if (strpos($s, 'const link = item.externalUrl;') === false) cms_fail($file, 'the news card link');
  return $s;
}

// ---------------------------------------------------------------- listing data
function cms_blog_entry($it, $i, $ind) {
  $o = [
    'id: ' . ($i + 1) . ',', 'title: ' . cms_js(cms_tpl($it['title'])) . ',', 'excerpt: ' . cms_js(cms_tpl($it['description'])) . ',', 'category: ' . cms_js(cms_blog_cat_key($it['category'])) . ',',
    'date: ' . cms_js(cms_blog_date($it)) . ',', 'readTime: ' . cms_js(cms_read_label($it)) . ',', 'image: ' . cms_js(cms_card_image($it)) . ',',
    'alt: ' . cms_js(cms_tpl($it['image_alt'] !== '' && $it['image_alt'] !== null ? $it['image_alt'] : $it['title'])) . ',', 'url: ' . cms_js(cms_item_url($it)),
  ];
  return $ind . "{\n" . implode("\n", array_map(function ($l) use ($ind) { return $ind . '  ' . $l; }, $o)) . "\n" . $ind . '}';
}
function cms_news_type($it) { return $it['type'] === 'clipping' ? 'clipping' : (($it['type'] === 'external-news' || !empty($it['legacy_url'])) ? 'external' : 'article'); }
function cms_news_entry($it, $i, $ind) {
  $clips = cms_json($it['clip_files'], []); $type = cms_news_type($it);
  $o = [
    'id: ' . ($i + 1) . ',', 'title: ' . cms_js(cms_tpl($it['title'])) . ',', 'excerpt: ' . cms_js(cms_tpl($it['description'])) . ',', 'category: ' . cms_js(cms_news_cat_key($it['category'])) . ',',
    'date: ' . cms_js(cms_news_date($it)) . ',', 'image: ' . cms_js(cms_card_image($it)) . ',', 'type: ' . cms_js($type) . ',', 'slug: null,', 'source: ' . cms_js(cms_tpl($it['publisher'] !== '' && $it['publisher'] !== null ? $it['publisher'] : 'Tat:vm')) . ',',
  ];
  if ($type === 'clipping') {
    $o[] = 'pages: [' . implode(', ', array_map('cms_js', cms_clip_pages($it))) . '],';
    if (!empty($it['clip_original'])) $o[] = 'file: ' . cms_js($it['clip_original']) . ',';
    $o[] = 'externalUrl: ' . cms_js(!empty($it['clip_original']) ? $it['clip_original'] : (isset($clips[0]) ? $clips[0] : ''));
  } else $o[] = 'externalUrl: ' . cms_js(cms_item_url($it));
  return $ind . "{\n" . implode("\n", array_map(function ($l) use ($ind) { return $ind . '  ' . $l; }, $o)) . "\n" . $ind . '}';
}

// ---------------------------------------------------------------- detail page
function cms_article_page($it, $peers, $blogCats) {
  $isBlog = cms_is_blog($it);
  $url = cms_item_url($it); $abs = CMS_SITE . $url;
  $seoTitle = $it['seo_title'] !== '' && $it['seo_title'] !== null ? $it['seo_title'] : $it['title'] . ' | Tat:vm';
  $desc = $it['meta_description'] !== '' && $it['meta_description'] !== null ? $it['meta_description'] : (string)$it['description'];
  $img = cms_card_image($it); $absImg = $img !== '' ? CMS_SITE . $img : CMS_SITE . 'assets/img/tatvm_logo.png';
  $author = trim((string)$it['author']) !== '' ? trim($it['author']) : 'Tat:vm Group';
  $orgAuthor = (bool)preg_match('/tat\s*:?\s*v(a)?m/i', $author);
  $dateText = $isBlog ? cms_blog_date($it) : cms_news_date($it);
  $catLabel = $it['category'] !== '' && $it['category'] !== null ? $it['category'] : ($isBlog ? 'Real Estate' : 'Press & Media');
  $listPage = $isBlog ? 'blogs.html' : 'news.html'; $listName = $isBlog ? 'Blog' : 'News & Updates';
  $updated = substr(!empty($it['updated_at']) ? $it['updated_at'] : $it['pub_date'], 0, 10);

  $n = 0; $toc = [];
  $body = preg_replace_callback('/<h2>([\s\S]*?)<\/h2>/', function ($m) use (&$n, &$toc) { $n++; $toc[] = [$n, cms_text($m[1])]; return '<h2 id="section-' . $n . '">' . $m[1] . '</h2>'; }, (string)$it['body_html']);
  $body = preg_replace('/(<img[^>]*\ssrc=")(uploads|assets)\//', '$1../$2/', $body);
  $body = str_replace(['<table>', '</table>'], ['<div class="article-table-wrap"><table class="article-table">', '</table></div>'], $body);
  $body = preg_replace('/<iframe\b[^>]*><\/iframe>/', '<div class="article-embed">$0</div>', $body);
  if (!empty($it['external_url']) && $it['type'] !== 'external-news')
    $body .= "\n" . '<p><strong>Read More:</strong> <a href="' . cms_esc($it['external_url']) . '" target="_blank" rel="noopener">' . cms_esc(!empty($it['publisher']) ? 'Original article on ' . $it['publisher'] : $it['title']) . '</a></p>';
  $faqs = array_values(array_filter(cms_json(isset($it['faqs']) ? $it['faqs'] : '', []), function ($f) { return is_array($f) && !empty($f['q']) && !empty($f['a']); }));
  if ($faqs) {
    $n++; $toc[] = [$n, 'Frequently Asked Questions'];
    $body .= "\n" . '<h2 id="section-' . $n . '">Frequently Asked Questions</h2>' . "\n" . '<div class="article-faq">' . "\n"
      . implode("\n", array_map(function ($f) { return '<details class="faq-item"><summary>' . cms_esc($f['q']) . '<span class="pm" aria-hidden="true">+</span></summary><div class="ans">' . cms_paras($f['a']) . '</div></details>'; }, $faqs)) . "\n" . '</div>';
  }

  $idx = -1; foreach ($peers as $k => $p) if ((int)$p['id'] === (int)$it['id']) $idx = $k;
  $others = array_values(array_filter($peers, function ($p) use ($it) { return (int)$p['id'] !== (int)$it['id']; }));
  $prev = isset($peers[$idx + 1]) ? $peers[$idx + 1] : null; $next = $idx > 0 ? $peers[$idx - 1] : null;      // list is newest first
  $rel = function ($u) { return preg_match('/^https?:/', $u) ? $u : '../' . $u; };
  $ext = function ($p) { return preg_match('/^https?:/', cms_item_url($p)) ? ' target="_blank" rel="noopener"' : ''; };
  $linkable = array_values(array_filter($others, function ($p) { return $p['type'] !== 'clipping'; }));

  $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG;
  $article = ['@context' => 'https://schema.org', '@type' => $isBlog ? 'BlogPosting' : 'NewsArticle', 'headline' => $it['title'], 'description' => $desc, 'image' => $absImg,
    'datePublished' => $it['pub_date'], 'dateModified' => $updated, 'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $abs],
    'author' => $orgAuthor ? ['@type' => 'Organization', 'name' => 'Tat:vm Builders & Developers', 'url' => CMS_SITE] : ['@type' => 'Person', 'name' => $author],
    'publisher' => ['@type' => 'Organization', 'name' => 'Tat:vm Builders & Developers', 'logo' => ['@type' => 'ImageObject', 'url' => CMS_SITE . 'assets/img/tatvm_logo.png']],
    'articleSection' => $catLabel, 'wordCount' => cms_word_count($it['body_html']), 'inLanguage' => 'en-IN'];
  if (!empty($it['keywords'])) $article['keywords'] = $it['keywords'];
  if (!empty($it['external_url']) && $it['type'] !== 'external-news') $article['isBasedOn'] = $it['external_url'];
  $ld = [$article,
    ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
      ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => CMS_SITE],
      ['@type' => 'ListItem', 'position' => 2, 'name' => $listName, 'item' => CMS_SITE . $listPage],
      ['@type' => 'ListItem', 'position' => 3, 'name' => $it['title'], 'item' => $abs]]]];
  if ($faqs) $ld[] = ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(function ($f) { return ['@type' => 'Question', 'name' => $f['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']]]; }, $faqs)];
  $custom = json_decode(isset($it['schema_json']) ? (string)$it['schema_json'] : '', true);
  if (is_array($custom)) { if (array_keys($custom) === range(0, count($custom) - 1)) { foreach ($custom as $o) $ld[] = $o; } else $ld[] = $custom; }
  $ldHtml = implode("\n", array_map('cms_ld_tag', $ld));

  if ($isBlog) $cats = implode("\n", array_map(function ($c) { return '              <a href="../blogs.html?category=' . cms_blog_cat_key($c) . '">' . cms_esc($c) . '</a>'; }, $blogCats));
  else $cats = '              <a href="../news.html">Press &amp; Media</a>' . "\n" . '              <a href="../news.html">All News</a>';

  $h = [];
  $h[] = '<!DOCTYPE html>
<html lang="en">
<head>

<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':
new Date().getTime(),event:\'gtm.js\'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!=\'dataLayer\'?\'&l=\'+l:\'\';j.async=true;j.src=
\'https://www.googletagmanager.com/gtm.js?id=\'+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,\'script\',\'dataLayer\',\'GTM-PS4NC2GK\');</script>
<!-- End Google Tag Manager -->

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>' . cms_esc($seoTitle) . '</title>
  <meta name="description" content="' . cms_esc($desc) . '">
  <link rel="canonical" href="' . $abs . '">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Tat:vm">
  <meta property="og:title" content="' . cms_esc($seoTitle) . '">
  <meta property="og:description" content="' . cms_esc($desc) . '">
  <meta property="og:url" content="' . $abs . '">
  <meta property="og:image" content="' . $absImg . '">
  <meta property="article:published_time" content="' . $it['pub_date'] . '">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="' . cms_esc($seoTitle) . '">
  <meta name="twitter:description" content="' . cms_esc($desc) . '">
  <meta name="twitter:image" content="' . $absImg . '">
  <meta name="theme-color" content="#8E1F24">
  <meta name="generator" content="Tat:vm CMS">
  <link rel="stylesheet" href="../assets/css/style.css?v=15">
  <link rel="stylesheet" href="../assets/css/blog-article.css?v=3">
  <link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Manrope:wght@400..800&display=swap" rel="stylesheet">
' . $ldHtml . '
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version=\'2.0\';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,\'script\',
\'https://connect.facebook.net/en_US/fbevents.js\');
fbq(\'init\', \'2056408405119926\');
fbq(\'track\', \'PageView\');
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
        <a href="../' . $listPage . '">' . cms_esc($listName) . '</a>
        <span>/</span>
        <span>' . cms_esc($it['title']) . '</span>
      </nav>

      <header class="article-header">
        <span class="article-category">' . cms_esc($catLabel) . '</span>
        <h1>' . cms_esc($it['title']) . '</h1>
        <div class="article-meta">
          <span>📅 <time datetime="' . $it['pub_date'] . '">' . cms_esc($dateText) . '</time></span>
          <span>✍️ By ' . cms_esc($author) . '</span>' . (!$isBlog && !empty($it['publisher']) ? "\n" . '          <span>📰 ' . cms_esc($it['publisher']) . '</span>' : '') . '
          <span>⏱️ ' . cms_read_time($it['body_html']) . ' min read</span>
        </div>
      </header>
';
  if ($img !== '') $h[] = '
      <figure class="article-featured article-featured--full">
        <img src="../' . cms_esc($img) . '" alt="' . cms_esc($it['image_alt'] !== '' && $it['image_alt'] !== null ? $it['image_alt'] : $it['title']) . '">
      </figure>
';
  $h[] = '
      <div class="article-body-wrapper">
        <aside class="article-sidebar">';
  if ($toc) $h[] = '
          <div class="toc-box">
            <h4>Contents</h4>
            <ul class="toc-list">
' . implode("\n", array_map(function ($t) { return '              <li><a href="#section-' . $t[0] . '">' . cms_esc($t[1]) . '</a></li>'; }, $toc)) . '
            </ul>
          </div>
';
  if ($linkable) $h[] = '
          <div class="related-sidebar">
            <h4>' . ($isBlog ? 'Latest Posts' : 'Latest News') . '</h4>
' . implode("\n", array_map(function ($p) use ($rel, $ext) { return '            <div class="related-item">
              <a href="' . cms_esc($rel(cms_item_url($p))) . '"' . $ext($p) . '>' . cms_esc($p['title']) . '</a>
              <div class="related-item-meta">' . cms_esc(cms_short_date($p)) . '</div>
            </div>'; }, array_slice($linkable, 0, 4))) . '
          </div>
';
  $h[] = '
          <div class="categories-box">
            <h4>' . ($isBlog ? 'Categories' : 'News Categories') . '</h4>
            <div class="categories-list">
' . $cats . '
            </div>
          </div>
        </aside>

        <main class="article-content">
          <div class="article-body">
' . $body . '
          </div>

          <div class="share-section">
            <span class="share-label">Share this ' . ($isBlog ? 'article' : 'news') . ':</span>
            <div class="share-buttons">
              <button class="share-btn" onclick="shareOn(\'twitter\')" aria-label="Share on X">𝕏</button>
              <button class="share-btn" onclick="shareOn(\'linkedin\')" aria-label="Share on LinkedIn">in</button>
              <button class="share-btn" onclick="shareOn(\'facebook\')" aria-label="Share on Facebook">f</button>
              <button class="share-btn" onclick="shareOn(\'copy\')" aria-label="Copy link">🔗</button>
            </div>
          </div>
';
  $navs = [];
  foreach ([[$prev, '← Previous ' . ($isBlog ? 'Post' : 'News')], [$next, 'Next ' . ($isBlog ? 'Post' : 'News') . ' →']] as $pair) {
    $p = $pair[0]; if (!$p || $p['type'] === 'clipping') continue;
    $navs[] = '            <a href="' . cms_esc($rel(cms_item_url($p))) . '"' . $ext($p) . ' class="nav-link">
              <span class="nav-link-label">' . $pair[1] . '</span>
              <span class="nav-link-title">' . cms_esc($p['title']) . '</span>
            </a>';
  }
  if ($navs) $h[] = '
          <nav class="article-navigation">
' . implode("\n", $navs) . '
          </nav>
';
  $h[] = '
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
';
  if ($linkable) $h[] = '
          <section class="article-related">
            <h3>Related ' . ($isBlog ? 'Articles' : 'News') . '</h3>
            <div class="related-grid">
' . implode("\n", array_map(function ($p) use ($rel, $ext, $isBlog) { return '              <article class="related-card">
                <div class="related-card-image">
                  <img src="../' . cms_esc(cms_card_image($p)) . '" alt="' . cms_esc($p['image_alt'] !== '' && $p['image_alt'] !== null ? $p['image_alt'] : $p['title']) . '" loading="lazy">
                </div>
                <div class="related-card-content">
                  <h4 class="related-card-title">' . cms_esc($p['title']) . '</h4>
                  <div class="related-card-meta">' . cms_esc($isBlog ? cms_blog_date($p) : cms_news_date($p)) . '</div>
                  <a href="' . cms_esc($rel(cms_item_url($p))) . '"' . $ext($p) . ' class="related-card-link">Read More →</a>
                </div>
              </article>'; }, array_slice($linkable, 0, 3))) . '
            </div>
          </section>
';
  $h[] = '        </main>
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
      const text = ' . json_encode($it['title'], $flags) . ';
      if (platform === \'copy\') { navigator.clipboard.writeText(url).then(() => alert(\'Link copied to clipboard!\')); }
      else if (platform === \'twitter\') { window.open(\'https://twitter.com/intent/tweet?url=\' + encodeURIComponent(url) + \'&text=\' + encodeURIComponent(text), \'_blank\'); }
      else if (platform === \'linkedin\') { window.open(\'https://www.linkedin.com/sharing/share-offsite/?url=\' + encodeURIComponent(url), \'_blank\'); }
      else if (platform === \'facebook\') { window.open(\'https://www.facebook.com/sharer/sharer.php?u=\' + encodeURIComponent(url), \'_blank\'); }
    }
    document.querySelectorAll(\'.toc-list a\').forEach(link => {
      link.addEventListener(\'click\', (e) => {
        e.preventDefault();
        const section = document.getElementById(link.getAttribute(\'href\').substring(1));
        if (section) section.scrollIntoView({ behavior: \'smooth\', block: \'start\' });
      });
    });
  </script>
</body>
</html>
';
  return implode('', $h);
}

// ---------------------------------------------------------------- build
function cms_build(PDO $db) {
  $all = $db->query("SELECT * FROM items WHERE status = 'published' ORDER BY pub_date DESC, sort_key ASC, id DESC")->fetchAll(PDO::FETCH_ASSOC);
  $blogs = array_values(array_filter($all, 'cms_is_blog'));
  $news = array_values(array_filter($all, function ($i) { return in_array($i['type'], CMS_NEWS_TYPES, true); }));
  // logo badges only for publishers that have published news
  $usedPubs = array_map(function ($x) { return $x['publisher']; }, $news);
  $publishers = array_values(array_filter($db->query("SELECT name, logo FROM publishers WHERE logo IS NOT NULL AND logo <> '' ORDER BY name")->fetchAll(PDO::FETCH_ASSOC), function ($p) use ($usedPubs) { return in_array($p['name'], $usedPubs, true); }));
  $files = [];
  $read = function ($f) { $s = @file_get_contents(cms_path($f)); if ($s === false) cms_fail($f, 'the file'); return $s; };

  $blogCats = CMS_BLOG_CATEGORIES;
  foreach ($blogs as $b) if ($b['category'] !== '' && $b['category'] !== null && !in_array($b['category'], $blogCats, true)) $blogCats[] = $b['category'];
  $newsCats = [];
  foreach ($news as $x) { $c = $x['category'] !== '' && $x['category'] !== null ? $x['category'] : 'Press & Media'; if (!in_array($c, $newsCats, true)) $newsCats[] = $c; }
  $logoMap = []; foreach ($publishers as $p) $logoMap[$p['name']] = $p['logo'];
  $pubMap = function ($ind) use ($publishers) {
    return "const PUB_LOGOS = {\n" . implode(",\n", array_map(function ($p) use ($ind) { return $ind . '  ' . cms_js(cms_tpl($p['name'])) . ': ' . cms_js($p['logo']); }, $publishers)) . "\n" . $ind . '};';
  };
  $entries = function ($list, $fn, $ind) { $o = []; foreach ($list as $i => $it) $o[] = $fn($it, $i, $ind); return implode(",\n", $o); };

  // ---- blogs.html
  $b = $read('blogs.html');
  $b = cms_replace_literal($b, 'BLOG_POSTS', '[', ']', "const BLOG_POSTS = [\n" . $entries($blogs, 'cms_blog_entry', '        ') . "\n      ];", 'blogs.html');
  $labels = []; foreach ($blogCats as $c) $labels[cms_blog_cat_key($c)] = $c;
  $count = 0;
  $b = preg_replace_callback('/const CATEGORY_LABELS = \{[^\n]*\};/', function () use ($labels) { return 'const CATEGORY_LABELS = ' . json_encode($labels, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';'; }, $b, 1, $count);
  if (!$count) cms_fail('blogs.html', 'the category labels');
  $b = cms_replace_between($b, '<button class="filter-btn active" data-category="all">All Posts</button>', '</div>',
    "\n" . implode("\n", array_map(function ($c) { return '      <button class="filter-btn" data-category="' . cms_blog_cat_key($c) . '">' . cms_esc($c) . '</button>'; }, $blogCats)) . "\n    ", 'blogs.html');
  if ($blogs) {
    $f = $blogs[0];
    $b = cms_replace_between($b, '<section class="featured-blog">', '</section>', '
    <div class="featured-blog-content">
      <div class="featured-blog-image">
        <img src="' . cms_esc(cms_card_image($f)) . '" alt="' . cms_esc($f['image_alt'] !== '' && $f['image_alt'] !== null ? $f['image_alt'] : $f['title']) . '" loading="lazy">
      </div>
      <div class="featured-blog-text">
        <div class="featured-blog-tag">Latest</div>
        <h2>' . cms_esc($f['title']) . '</h2>
        <div class="featured-blog-meta">
          <span>📅 ' . cms_esc(cms_blog_date($f)) . '</span>
          <span>✍️ By ' . cms_esc($f['author'] !== '' && $f['author'] !== null ? $f['author'] : 'Tat:vm Group') . '</span>
          <span>⏱️ ' . cms_esc(cms_read_label($f)) . ' read</span>
        </div>
        <p>' . cms_esc($f['description']) . '</p>
        <a href="' . cms_esc(cms_item_url($f)) . '" class="featured-blog-cta">
          Read Full Article
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </a>
      </div>
    </div>
  ', 'blogs.html');
  }
  $b = cms_with_schema($b, [
    ['@context' => 'https://schema.org', '@type' => 'Blog', '@id' => CMS_SITE . 'blogs.html#blog', 'name' => 'Tat:vm Blog', 'url' => CMS_SITE . 'blogs.html', 'description' => cms_meta_desc($b), 'inLanguage' => 'en-IN', 'publisher' => cms_org(),
      'blogPost' => array_map(function ($p) { return ['@type' => 'BlogPosting', 'headline' => $p['title'], 'url' => cms_abs_url(cms_item_url($p)), 'datePublished' => $p['pub_date'], 'image' => cms_abs_url(cms_card_image($p))]; }, array_slice($blogs, 0, 50))],
    ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
      ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => CMS_SITE],
      ['@type' => 'ListItem', 'position' => 2, 'name' => 'Blog', 'item' => CMS_SITE . 'blogs.html']]],
  ], 'blogs.html');
  $b = cms_with_cards($b, '<!-- Blog cards injected by JavaScript -->', array_map('cms_blog_card', array_slice($blogs, 0, 6)), 'blogs.html');
  $files['blogs.html'] = $b;

  // ---- index.html
  $h = $read('index.html');
  $S = '<!-- cms:home-blogs:start -->'; $E = '<!-- cms:home-blogs:end -->';
  if (strpos($h, $S) === false) {           // first run: mark the homepage blog cards so later runs are exact
    $c = strpos($h, '<!-- Carousel 1: Blogs -->'); $a = $c === false ? false : strpos($h, '<div class="car-track slim">', $c);
    if ($a === false || !preg_match('/\n {6}<\/div>\n {4}<\/div>/', $h, $m, PREG_OFFSET_CAPTURE, $a)) cms_fail('index.html', 'the homepage blog carousel');
    $start = $a + strlen('<div class="car-track slim">'); $end = $m[0][1];
    $h = substr($h, 0, $start) . "\n        " . $S . substr($h, $start, $end - $start) . "\n        " . $E . substr($h, $end);
  }
  $h = cms_replace_between($h, $S, $E, "\n" . implode("\n", array_map(function ($it) {
    return '        <a href="' . cms_esc(cms_item_url($it)) . '" class="art-card">
          <figure class="am"><img src="' . cms_esc(cms_card_image($it)) . '" alt="' . cms_esc($it['image_alt'] !== '' && $it['image_alt'] !== null ? $it['image_alt'] : $it['title']) . '" loading="lazy"><span class="acat">' . cms_esc($it['category'] !== '' && $it['category'] !== null ? $it['category'] : 'Real Estate') . '</span></figure>
          <div class="ab">
            <h3>' . cms_esc($it['title']) . '</h3>
            <p>' . cms_esc($it['description']) . '</p>
            <div class="ameta"><span>' . cms_esc(cms_blog_date($it)) . ' · ' . cms_esc(cms_read_label($it)) . ' read</span><span>Read →</span></div>
          </div>
        </a>';
  }, array_slice($blogs, 0, CMS_HOME_BLOGS))) . "\n        ", 'index.html');
  $h = cms_replace_literal($h, 'HOMEPAGE_NEWS', '[', ']', "const HOMEPAGE_NEWS = [\n" . $entries(array_slice($news, 0, CMS_HOME_NEWS), 'cms_news_entry', '    ') . "\n    ];", 'index.html');
  $h = cms_replace_literal($h, 'PUB_LOGOS', '{', '}', $pubMap('    '), 'index.html');
  $h = cms_fix_link($h, 'index.html');
  $h = cms_with_cards($h, '<!-- News cards injected by JavaScript -->', array_map(function ($it) use ($logoMap) { return cms_home_news_card($it, $logoMap); }, array_slice($news, 0, CMS_HOME_NEWS)), 'index.html');
  $files['index.html'] = $h;

  // ---- news.html
  $nw = $read('news.html');
  $nw = cms_replace_literal($nw, 'NEWS_ITEMS', '[', ']', "const NEWS_ITEMS = [\n" . $entries($news, 'cms_news_entry', '        ') . "\n      ];", 'news.html');
  $nw = cms_replace_literal($nw, 'PUB_LOGOS', '{', '}', $pubMap('      '), 'news.html');
  $nw = cms_fix_link($nw, 'news.html');
  $nw = cms_replace_between($nw, '<button class="filter-btn active" data-category="all">All News</button>', '</div>',
    "\n" . implode("\n", array_map(function ($c) { return '      <button class="filter-btn" data-category="' . cms_news_cat_key($c) . '">' . cms_esc($c) . '</button>'; }, $newsCats)) . "\n    ", 'news.html');
  if ($news) {
    $f = $news[0]; $clips = cms_json($f['clip_files'], []); $logo = '';
    foreach ($publishers as $p) if ($p['name'] === $f['publisher']) $logo = $p['logo'];
    $isClip = $f['type'] === 'clipping'; $isExt = $f['type'] === 'external-news';
    $clipAttr = $isClip ? ' data-clip="' . cms_esc(implode('|', cms_clip_pages($f))) . '" data-clip-title="' . cms_esc($f['title']) . ' — ' . cms_esc((string)$f['publisher']) . '"' . (!empty($f['clip_original']) ? ' data-clip-file="' . cms_esc($f['clip_original']) . '"' : '') : '';
    $nw = cms_replace_between($nw, '<section class="featured-news">', '</section>', '
    <div class="featured-news-content">
      <div class="featured-news-image"' . $clipAttr . '>
        <img src="' . cms_esc(cms_card_image($f)) . '" alt="' . cms_esc($f['image_alt'] !== '' && $f['image_alt'] !== null ? $f['image_alt'] : $f['title']) . '">' . ($logo !== '' ? '
        <span class="news-pub" style="' . CMS_LOGO_BOX . '"><img src="' . cms_esc($logo) . '" alt="' . cms_esc($f['publisher']) . '" title="' . cms_esc($f['publisher']) . '" style="' . CMS_LOGO_IMG . '"></span>' : '') . '
      </div>
      <div class="featured-news-text">
        <div class="featured-news-tag">Latest</div>
        <h2>' . cms_esc($f['title']) . '</h2>
        <div class="featured-news-meta">
          <span>📅 ' . cms_esc(cms_news_date($f)) . '</span>
          <span>🏢 ' . cms_esc($f['category'] !== '' && $f['category'] !== null ? $f['category'] : 'Press & Media') . '</span>
        </div>
        <p>' . cms_esc($f['description']) . '</p>
        <div class="featured-news-source">
          🔗 ' . cms_esc($f['publisher'] !== '' && $f['publisher'] !== null ? $f['publisher'] : 'Tat:vm') . '
        </div>
        <a href="' . cms_esc($isClip ? (!empty($f['clip_original']) ? $f['clip_original'] : (isset($clips[0]) ? $clips[0] : '')) : cms_item_url($f)) . '"' . ($isExt ? ' target="_blank" rel="noopener noreferrer"' : '') . ' class="featured-news-cta"' . $clipAttr . '>
          ' . ($isClip ? 'View Clipping' : 'Read Full Story') . '
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </a>
      </div>
    </div>
  ', 'news.html');
  }
  $listed = array_slice($news, 0, 50); $items = [];
  foreach ($listed as $i => $p) $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'url' => cms_abs_url(cms_item_url($p)), 'name' => $p['title']];
  $nw = cms_with_schema($nw, [
    ['@context' => 'https://schema.org', '@type' => 'CollectionPage', '@id' => CMS_SITE . 'news.html#page', 'name' => 'News & Updates', 'url' => CMS_SITE . 'news.html', 'description' => cms_meta_desc($nw), 'inLanguage' => 'en-IN',
      'isPartOf' => ['@type' => 'WebSite', 'name' => 'Tat:vm', 'url' => CMS_SITE], 'publisher' => cms_org(),
      'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($listed), 'itemListElement' => $items]],
    ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
      ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => CMS_SITE],
      ['@type' => 'ListItem', 'position' => 2, 'name' => 'News & Updates', 'item' => CMS_SITE . 'news.html']]],
  ], 'news.html');
  $nw = cms_with_cards($nw, '<!-- News cards injected by JavaScript -->', array_map(function ($it) use ($logoMap) { return cms_news_card($it, $logoMap); }, array_slice($news, 0, 9)), 'news.html');
  $files['news.html'] = $nw;

  // ---- detail pages for content created in the Content Manager
  $pages = []; $lastmod = [];
  foreach ($all as $it) {
    if (!cms_has_page($it)) continue;
    $rel = cms_item_url($it);
    $files[$rel] = cms_article_page($it, cms_is_blog($it) ? $blogs : $news, $blogCats);
    $pages[] = $rel; $lastmod[$rel] = substr(!empty($it['updated_at']) ? $it['updated_at'] : $it['pub_date'], 0, 10);
  }

  // ---- sitemap.xml (only the block the Content Manager owns)
  $sm = $read('sitemap.xml');
  $SS = '  <!-- cms:start -->'; $SE = '  <!-- cms:end -->';
  $base = strpos($sm, $SS) !== false ? substr($sm, 0, strpos($sm, $SS)) . substr($sm, strpos($sm, $SE) + strlen($SE)) : $sm;
  // sitemap entries = CMS pages + published pre-CMS article pages the main list lacks (these are listed only, never owned)
  $listed = $pages;
  foreach ($all as $it) {
    $u = isset($it['legacy_url']) ? (string)$it['legacy_url'] : '';
    if ($u !== '' && preg_match('/^(blog|News)\/[A-Za-z0-9_-]+\.html$/', $u) && strpos($base, '<loc>' . CMS_SITE . $u . '</loc>') === false && !in_array($u, $listed, true)) { $listed[] = $u; $lastmod[$u] = $it['pub_date']; }
  }
  $block = $SS . "\n";
  foreach ($listed as $p) $block .= '  <url><loc>' . CMS_SITE . $p . '</loc><lastmod>' . $lastmod[$p] . '</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>' . "\n";
  $block .= $SE;
  if (strpos($sm, $SS) !== false) $sm = cms_replace_between($sm, $SS, $SE, $block, 'sitemap.xml', false);
  else { if (strpos($sm, '</urlset>') === false) cms_fail('sitemap.xml', '</urlset>'); $sm = str_replace('</urlset>', $block . "\n</urlset>", $sm); }
  $files['sitemap.xml'] = $sm;

  return ['files' => $files, 'pages' => $pages];
}

// ---------------------------------------------------------------- write
function cms_write(PDO $db, array $result) {
  $changed = []; $removed = [];
  $known = $db->query('SELECT path FROM generated')->fetchAll(PDO::FETCH_COLUMN);
  foreach ($result['files'] as $rel => $content) {
    $abs = cms_path($rel);
    $isPage = in_array($rel, $result['pages'], true);
    $old = is_file($abs) ? file_get_contents($abs) : null;
    if ($isPage && $old !== null && !in_array($rel, $known, true) && strpos($old, '<meta name="generator" content="Tat:vm CMS">') === false)
      throw new CmsLayoutError($rel . ' already exists on the site and was not created by the Content Manager. Choose a different URL slug.');
    if ($old === $content) continue;
    if (!is_dir(dirname($abs))) mkdir(dirname($abs), 0755, true);
    // write to a temporary file and swap it in; if the server does not allow that, write the file directly
    $tmp = $abs . '.cms-tmp';
    $done = @file_put_contents($tmp, $content, LOCK_EX) !== false && @rename($tmp, $abs);
    if (!$done) { @unlink($tmp); $done = @file_put_contents($abs, $content, LOCK_EX) !== false; }
    if (!$done) throw new CmsLayoutError('The server did not allow writing ' . $rel . '. Check the file permissions.');
    @chmod($abs, 0644);
    $changed[] = $rel;
  }
  $del = $db->prepare('DELETE FROM generated WHERE path = ?');
  foreach ($known as $rel) {
    if (in_array($rel, $result['pages'], true)) continue;
    if (preg_match('/^(blog|News)\/[a-z0-9-]+\.html$/', $rel) && is_file(cms_path($rel))) { unlink(cms_path($rel)); $removed[] = $rel; }
    $del->execute([$rel]);
  }
  $ins = $db->prepare('INSERT OR IGNORE INTO generated (path) VALUES (?)');
  foreach ($result['pages'] as $rel) $ins->execute([$rel]);
  return ['changed' => $changed, 'removed' => $removed];
}
