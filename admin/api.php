<?php
// Tat:vm Content Manager — online admin API (PHP 7.4+, SQLite). Called by admin/index.html as api.php?r=<route>.
define('CMS', 1);
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require __DIR__ . '/lib/generator.php';

const CMS_STATUSES = ['draft', 'published', 'unpublished'];
const CMS_UPLOAD_DIRS = ['blogs' => 'uploads/blogs', 'news' => 'uploads/news', 'clippings' => 'uploads/clippings', 'publishers' => 'uploads/publishers'];
const CMS_MAX_IMAGE = 15728640;   // 15 MB
const CMS_MAX_PDF = 31457280;     // 30 MB
const CMS_SESSION_HOURS = 8;
define('CMS_DATA', __DIR__ . '/data');
define('CMS_BACKUPS', CMS_DATA . '/backups');
// the database file has a random name (kept in data/config.php) so it cannot be guessed even if the folder protection fails
function db_file() { static $f = null; if ($f === null) { $c = is_file(CMS_DATA . '/config.php') ? include CMS_DATA . '/config.php' : []; $f = CMS_DATA . '/' . (is_array($c) && !empty($c['db']) && preg_match('/^[A-Za-z0-9._-]+$/', $c['db']) ? $c['db'] : 'content.db'); } return $f; }

class HttpError extends Exception {
  public $status; public $fields;
  public function __construct($status, $msg, $fields = null) { parent::__construct($msg); $this->status = $status; $this->fields = $fields; }
}
function send($status, $obj) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($obj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}
set_exception_handler(function ($e) {
  if ($e instanceof HttpError) send($e->status, ['error' => $e->getMessage(), 'fields' => $e->fields]);
  if ($e instanceof CmsLayoutError) send(500, ['error' => $e->getMessage()]);
  error_log('Tat:vm CMS: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
  send(500, ['error' => 'The server could not complete that. Please try again.']);
});
set_error_handler(function ($no, $str, $file, $line) { if (!(error_reporting() & $no)) return false; throw new ErrorException($str, 0, $no, $file, $line); });

// ------------------------------------------------------------------ database
function db() {
  static $db = null;
  if ($db) return $db;
  if (!extension_loaded('pdo_sqlite')) throw new HttpError(500, 'This server does not have SQLite for PHP (pdo_sqlite) enabled. Ask your hosting provider to enable it.');
  if (!is_dir(CMS_BACKUPS)) @mkdir(CMS_BACKUPS, 0755, true);
  if (!is_writable(CMS_DATA)) throw new HttpError(500, 'The admin/data folder is not writable on the server. Set its permissions to 755 (or 775).');
  $db = new PDO('sqlite:' . db_file());
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $db->exec('PRAGMA busy_timeout = 5000');
  $db->exec("
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
    CREATE TABLE IF NOT EXISTS throttle (ip TEXT PRIMARY KEY, fails INTEGER NOT NULL, until INTEGER NOT NULL);
  ");
  $cols = array_map(function ($c) { return $c['name']; }, $db->query('PRAGMA table_info(items)')->fetchAll());
  foreach (['faqs' => "TEXT DEFAULT '[]'", 'keywords' => "TEXT DEFAULT ''", 'schema_json' => "TEXT DEFAULT ''"] as $c => $def)
    if (!in_array($c, $cols, true)) $db->exec("ALTER TABLE items ADD COLUMN $c $def");
  return $db;
}
function q($sql, $args = []) { $st = db()->prepare($sql); $st->execute($args); return $st; }
function setting($k, $v = null) {
  if ($v === null) { $r = q('SELECT value FROM settings WHERE key = ?', [$k])->fetch(); return $r ? $r['value'] : null; }
  q('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [$k, $v]);
  return $v;
}
function now_iso() { return gmdate('Y-m-d\TH:i:s\Z'); }

// ------------------------------------------------------------------ session + request guards
function start_session() {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
  $dir = rtrim(str_replace('\\', '/', dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/admin/api.php')), '/') . '/';
  session_name('tatvm_cms');
  session_set_cookie_params(['lifetime' => 0, 'path' => $dir, 'secure' => $secure, 'httponly' => true, 'samesite' => 'Strict']);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');
  session_start();
}
function authed() { return !empty($_SESSION['auth']) && !empty($_SESSION['exp']) && $_SESSION['exp'] > time(); }
function login_session() { session_regenerate_id(true); $_SESSION['auth'] = true; $_SESSION['exp'] = time() + CMS_SESSION_HOURS * 3600; $_SESSION['csrf'] = bin2hex(random_bytes(24)); }
function header_val($name) { $k = 'HTTP_' . strtoupper(str_replace('-', '_', $name)); return isset($_SERVER[$k]) ? $_SERVER[$k] : ''; }
function guard_post($needToken) {
  if (header_val('X-CMS') !== '1') throw new HttpError(403, 'Request refused.');
  $origin = header_val('Origin');
  if ($origin !== '') { $oh = parse_url($origin, PHP_URL_HOST); $host = preg_replace('/:\d+$/', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : ''); if (!$oh || strcasecmp($oh, $host) !== 0) throw new HttpError(403, 'Request refused.'); }
  if ($needToken && (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], header_val('X-CMS-Token')))) throw new HttpError(403, 'Your session has expired. Reload the page and log in again.');
}
function body_json() { $d = json_decode((string)file_get_contents('php://input'), true); if (!is_array($d)) throw new HttpError(400, 'Invalid request.'); return $d; }
function client_ip() { return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0'; }

// ------------------------------------------------------------------ helpers
function valid_url($u) { $p = @parse_url((string)$u); return is_array($p) && isset($p['scheme'], $p['host']) && in_array(strtolower($p['scheme']), ['http', 'https'], true) && !preg_match('/\s/', $u); }
function safe_file($p) { return is_string($p) && preg_match('/^(uploads|assets)\/[A-Za-z0-9 _\-.\/()%]+$/', $p) && strpos($p, '..') === false && is_file(cms_path($p)); }

function esc_attr($s) { $s = preg_replace('/&(?!amp;|lt;|gt;|quot;|#)/', '&amp;', (string)$s); return str_replace(['"', '<', '>'], ['&quot;', '&lt;', '&gt;'], $s); }
function attr_of($attrs, $name) { return preg_match('/(?:^|\s)' . $name . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $attrs, $r) ? trim(isset($r[3]) ? $r[3] : (isset($r[2]) && $r[2] !== '' ? $r[2] : $r[1])) : ''; }
// only video and map players from these services may be embedded
function embed_src($src) {
  $src = trim(str_replace('&amp;', '&', (string)$src));
  if (preg_match('/^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,20})(?:[?#].*)?$/', $src, $m)) return 'https://www.youtube-nocookie.com/embed/' . $m[1];
  if (preg_match('/^https:\/\/player\.vimeo\.com\/video\/(\d{4,12})(?:[?#].*)?$/', $src, $m)) return 'https://player.vimeo.com/video/' . $m[1];
  if (preg_match('/^https:\/\/www\.google\.com\/maps\/embed\?pb=[A-Za-z0-9!%._~:=&,+*-]+$/', $src)) return $src;
  return null;
}
function sanitize_html($html) {
  $allowed = ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'u', 'blockquote', 'img', 'br', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr', 'pre', 'code', 'sup', 'sub', 's', 'mark', 'small', 'dl', 'dt', 'dd', 'cite'];
  $rename = ['b' => 'strong', 'i' => 'em', 'div' => 'p', 'h1' => 'h2', 'h5' => 'h4', 'h6' => 'h4', 'strike' => 's', 'del' => 's'];
  $s = (string)$html;
  if (strlen($s) > 600000) throw new HttpError(422, 'Please fix the highlighted fields.', ['body_html' => 'The article is too long.']);
  $s = str_replace("\0", '', $s);
  $s = preg_replace('/<!--[\s\S]*?-->/', '', $s);
  $embeds = [];
  $s = preg_replace_callback('/<iframe\b((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>[\s\S]*?<\/iframe\s*>/i', function ($m) use (&$embeds) {
    $src = embed_src(attr_of($m[1], 'src'));
    if (!$src) return '';
    $title = attr_of($m[1], 'title');
    $embeds[] = '<iframe src="' . esc_attr($src) . '" title="' . esc_attr($title !== '' ? $title : 'Embedded video') . '" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    return "\0E" . (count($embeds) - 1) . "\0";
  }, $s);
  $s = preg_replace('/<(script|style|iframe|object|embed|svg|math|form|template|noscript|head|title)\b[\s\S]*?<\/\1\s*>/i', '', $s);
  $s = preg_replace('/<(script|style|iframe|object|embed|link|meta|base|form|input|button|svg|math)\b[^>]*>/i', '', $s);
  $s = preg_replace_callback('/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>/', function ($m) use ($allowed, $rename) {
    $tag = strtolower($m[2]); if (isset($rename[$tag])) $tag = $rename[$tag];
    if (!in_array($tag, $allowed, true)) return '';
    if ($m[1] === '/') return in_array($tag, ['img', 'br', 'hr'], true) ? '' : '</' . $tag . '>';
    $attrs = $m[3];
    $get = function ($name) use ($attrs) { return attr_of($attrs, $name); };
    if ($tag === 'td' || $tag === 'th') {
      $out = '<' . $tag;
      foreach (['colspan', 'rowspan'] as $a) { $v = (int)$get($a); if ($v > 1 && $v <= 50) $out .= ' ' . $a . '="' . $v . '"'; }
      if ($tag === 'th' && preg_match('/^(row|col|rowgroup|colgroup)$/', $get('scope'))) $out .= ' scope="' . $get('scope') . '"';
      return $out . '>';
    }
    if ($tag === 'ol') { $v = (int)$get('start'); return ($v > 1 && $v < 10000) ? '<ol start="' . $v . '">' : '<ol>'; }
    if ($tag === 'a') {
      $href = str_replace('&amp;', '&', $get('href'));
      if ($href === '' || !preg_match('/^(https?:\/\/|mailto:|tel:|#|\/|\.\.?\/|[A-Za-z0-9_\-]+[.\/])/', $href) || preg_match('/^\s*(javascript|data|vbscript):/i', $href)) return '<a>';
      $external = preg_match('/^https?:\/\//i', $href) && !preg_match('/^https?:\/\/(www\.)?tatvmgroup\.com/i', $href);
      return '<a href="' . esc_attr($href) . '"' . ($external ? ' target="_blank" rel="noopener"' : '') . '>';
    }
    if ($tag === 'img') {
      $src = str_replace('&amp;', '&', $get('src'));
      $src = preg_replace('/^https?:\/\/[^\/]+\//i', '', $src, 1, $hadHost);
      if ($hadHost && !preg_match('/^(uploads|assets)\//', $src)) return '';
      $src = preg_replace('/^(\.\.\/)+/', '', $src); $src = preg_replace('/^\//', '', $src);
      if (!preg_match('/^(uploads|assets)\/[A-Za-z0-9 _\-.\/()%]+$/', $src) || strpos($src, '..') !== false || !is_file(cms_path($src))) return '';
      return '<img src="' . esc_attr($src) . '" alt="' . esc_attr($get('alt')) . '" loading="lazy">';
    }
    return '<' . $tag . '>';
  }, $s);
  $s = preg_replace('/<a>([\s\S]*?)<\/a>/', '$1', $s);
  $s = preg_replace('/<p>\s*(<br>)?\s*<\/p>/', '', $s);
  $s = preg_replace('/<(h2|h3|h4|li|strong|em|u|s|mark|sup|sub|code|caption)>\s*<\/\1>/', '', $s);
  $s = str_replace(["\xC2\xA0", '&nbsp;'], ' ', $s);
  $s = preg_replace('/\n{3,}/', "\n\n", $s);
  $s = preg_replace_callback('/\0E(\d+)\0/', function ($m) use ($embeds) { return isset($embeds[(int)$m[1]]) ? $embeds[(int)$m[1]] : ''; }, $s);
  return trim($s);
}

function unique_slug($base, $id) {
  $base = cms_slugify($base); if ($base === '') $base = 'post';
  $own = null;
  if ($id) { $self = q('SELECT * FROM items WHERE id = ?', [$id])->fetch(); if ($self && cms_has_page($self)) $own = cms_item_url($self); }
  $taken = function ($s) use ($id, $own) {
    if (q('SELECT 1 FROM items WHERE slug = ? AND id <> ?', [$s, (int)$id])->fetch()) return true;
    foreach (['blog', 'News'] as $d) if ($d . '/' . $s . '.html' !== $own && is_file(cms_path($d . '/' . $s . '.html'))) return true;
    return false;
  };
  $s = $base; $n = 2;
  while ($taken($s)) $s = $base . '-' . $n++;
  return $s;
}

// validate + normalise a record coming from the form; drafts only need a title
function clean_item($in, $existing) {
  $f = []; $e = [];
  $str = function ($k, $max) use ($in) { $v = isset($in[$k]) && is_scalar($in[$k]) ? trim((string)$in[$k]) : ''; return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max); };
  $types = array_merge(CMS_BLOG_TYPES, CMS_NEWS_TYPES);
  $f['type'] = $existing ? $existing['type'] : $str('type', 30);
  if (!in_array($f['type'], $types, true)) $e['type'] = 'Choose a content type.';
  $f['status'] = isset($in['status']) && in_array($in['status'], CMS_STATUSES, true) ? $in['status'] : 'draft';
  $f['title'] = $str('title', 200); if ($f['title'] === '') $e['title'] = 'Title is required.';
  $f['description'] = $str('description', 400);
  $f['category'] = $str('category', 60);
  $f['author'] = $str('author', 80);
  $f['publisher'] = $str('publisher', 80);
  $f['pub_date'] = $str('pub_date', 10);
  if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $f['pub_date'], $dm) || !checkdate((int)$dm[2], (int)$dm[3], (int)$dm[1])) $e['pub_date'] = 'Choose a publication date.';
  $f['image'] = $str('image', 300); if ($f['image'] !== '' && !safe_file($f['image'])) $e['image'] = 'Upload the image again.';
  $f['image_alt'] = $str('image_alt', 200);
  $f['external_url'] = $str('external_url', 600); if ($f['external_url'] !== '' && !valid_url($f['external_url'])) $e['external_url'] = 'Enter a full web address starting with https://';
  $f['seo_title'] = $str('seo_title', 160);
  $f['meta_description'] = $str('meta_description', 320);
  $legacy = $existing && !empty($existing['legacy_url']);
  $f['body_html'] = $legacy ? '' : sanitize_html(isset($in['body_html']) ? $in['body_html'] : '');
  $f['keywords'] = $str('keywords', 300);
  $faqs = [];
  foreach (array_slice(isset($in['faqs']) && is_array($in['faqs']) ? $in['faqs'] : [], 0, 30) as $x) {
    $q = is_array($x) && isset($x['q']) && is_scalar($x['q']) ? trim((string)$x['q']) : '';
    $a = is_array($x) && isset($x['a']) && is_scalar($x['a']) ? trim(str_replace("\r", '', (string)$x['a'])) : '';
    $q = function_exists('mb_substr') ? mb_substr($q, 0, 300, 'UTF-8') : substr($q, 0, 300);
    $a = function_exists('mb_substr') ? mb_substr($a, 0, 3000, 'UTF-8') : substr($a, 0, 3000);
    if ($q === '' && $a === '') continue;
    if ($q === '' || $a === '') $e['faqs'] = 'Each FAQ needs both a question and an answer.';
    $faqs[] = ['q' => $q, 'a' => $a];
  }
  $f['faqs'] = json_encode($faqs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $f['schema_json'] = '';
  $raw = trim(preg_replace('/<\/?script[^>]*>/i', '', isset($in['schema_json']) && is_scalar($in['schema_json']) ? (string)$in['schema_json'] : ''));
  if ($raw !== '') {
    $parsed = json_decode($raw, true);
    $isList = is_array($parsed) && $parsed && array_keys($parsed) === range(0, count($parsed) - 1);
    $list = $isList ? $parsed : [$parsed];
    $ok = is_array($parsed) && $parsed;
    foreach ($list as $o) if (!is_array($o) || !$o || array_keys($o) === range(0, count($o) - 1) || empty($o['@type'])) $ok = false;
    if (!$ok) $e['schema_json'] = 'This is not valid schema JSON. Each block needs an "@type".';
    elseif (strlen($raw) > 50000) $e['schema_json'] = 'The custom schema is too long.';
    else {
      foreach ($list as $k => $o) if (empty($o['@context'])) $list[$k] = array_merge(['@context' => 'https://schema.org'], $o);
      $f['schema_json'] = json_encode($isList ? $list : $list[0], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
  }
  $clips = isset($in['clip_files']) && is_array($in['clip_files']) ? array_values(array_map('strval', $in['clip_files'])) : [];
  foreach ($clips as $c) if (!safe_file($c)) $e['clip_files'] = 'Upload the clipping again.';
  $clips = $f['type'] === 'clipping' ? array_slice($clips, 0, 20) : [];
  $f['clip_files'] = json_encode($clips, JSON_UNESCAPED_SLASHES);

  $needsPage = !$legacy && $f['type'] !== 'external-news' && $f['type'] !== 'clipping';
  $f['slug'] = '';
  if ($needsPage) {
    $given = $str('slug', 100); $wanted = cms_slugify($given !== '' ? $given : $f['title']);
    if ($wanted === '') $e['slug'] = 'Enter a URL slug.';
    else { $f['slug'] = unique_slug($wanted, $existing ? $existing['id'] : 0); if ($given !== '' && $f['slug'] !== $wanted) $e['slug'] = 'That address is already used. Try "' . $f['slug'] . '".'; }
  }
  if ($f['status'] === 'published') {
    $hasImageClip = false; foreach ($clips as $c) if (!preg_match('/\.pdf$/i', $c)) $hasImageClip = true;
    if ($f['description'] === '') $e['description'] = 'Add a short description before publishing.';
    if ($needsPage && strlen(cms_text($f['body_html'])) < 20) $e['body_html'] = 'Write the article content before publishing.';
    if ($f['type'] === 'external-news' && $f['external_url'] === '') $e['external_url'] = 'Add the link to the original article.';
    if ($f['type'] === 'clipping' && !$clips) $e['clip_files'] = 'Upload at least one clipping image or PDF.';
    if ($f['type'] === 'clipping' && $f['image'] === '' && !$hasImageClip) $e['image'] = 'A PDF clipping needs a thumbnail image for its card.';
    if ($f['type'] !== 'clipping' && $f['image'] === '') $e['image'] = 'Add a featured image before publishing.';
    if (in_array($f['type'], CMS_NEWS_TYPES, true) && $f['type'] !== 'company-news' && $f['publisher'] === '') $e['publisher'] = 'Choose or add the publisher.';
  }
  if ($e) throw new HttpError(422, 'Please fix the highlighted fields.', $e);
  return $f;
}
function upsert_publisher($name, $logo) {
  if ($name === '' || $name === null) return;
  if ($logo !== null && $logo !== '' && !safe_file($logo)) throw new HttpError(422, 'Please fix the highlighted fields.', ['publisher_logo' => 'Upload the logo again.']);
  if ($logo) q('INSERT OR REPLACE INTO publishers (name, logo) VALUES (?, ?)', [$name, $logo]);
  else q('INSERT OR IGNORE INTO publishers (name, logo) VALUES (?, NULL)', [$name]);
}

function backup_db($tag) {
  if (!is_file(db_file())) return null;
  $dest = CMS_BACKUPS . '/content-' . gmdate('Y-m-d-H-i-s') . ($tag ? '-' . $tag : '') . '-' . bin2hex(random_bytes(6)) . '.db';
  copy(db_file(), $dest);
  $old = glob(CMS_BACKUPS . '/content-*.db'); sort($old);
  while (count($old) > 40) @unlink(array_shift($old));
  return $dest;
}
function snapshot_site_once() {          // untouched copy of the pages the Content Manager rewrites
  $snap = CMS_BACKUPS . '/site-before-online-cms';
  if (is_dir($snap)) return;
  @mkdir($snap, 0755, true);
  foreach (['index.html', 'blogs.html', 'news.html', 'sitemap.xml'] as $f) if (is_file(cms_path($f))) @copy(cms_path($f), $snap . '/' . $f);
}
function copy_dir($from, $to) {
  @mkdir($to, 0755, true);
  foreach (scandir($from) as $n) { if ($n === '.' || $n === '..') continue; $a = $from . '/' . $n; $b = $to . '/' . $n; if (is_dir($a)) copy_dir($a, $b); else copy($a, $b); }
}

// run a change and rebuild the site as one step: if the site can't be rebuilt, the change is undone
function commit_change($change) {
  $db = db();
  snapshot_site_once();
  $db->beginTransaction();
  try { $out = $change(); $result = cms_build($db); $db->commit(); }
  catch (Exception $ex) { if ($db->inTransaction()) $db->rollBack(); throw $ex; }
  try { $site = cms_write($db, $result); }
  catch (Exception $ex) { throw new HttpError(500, 'Saved, but the website pages could not be updated: ' . $ex->getMessage()); }
  return ['out' => $out, 'site' => $site];
}
function public_item($it, $withBody = true) {
  if (!$it) return null;
  $it['clip_files'] = cms_json($it['clip_files'], []);
  $it['faqs'] = cms_json(isset($it['faqs']) ? $it['faqs'] : '', []);
  $it['legacy'] = !empty($it['legacy_url']);
  $it['url'] = cms_item_url(array_merge($it, ['clip_files' => json_encode($it['clip_files'])]));
  $it['schema_json'] = isset($it['schema_json']) && $it['schema_json'] !== '' ? json_encode(json_decode($it['schema_json'], true), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '';
  $it['card_image'] = cms_card_image(array_merge($it, ['clip_files' => json_encode($it['clip_files'])]));
  $it['has_page'] = cms_has_page($it);
  $it['id'] = (int)$it['id'];
  if (!$withBody) unset($it['body_html']);
  return $it;
}
function get_item($id) { return q('SELECT * FROM items WHERE id = ?', [(int)$id])->fetch(); }

// ------------------------------------------------------------------ uploads
function sniff($buf) {
  if (strncmp($buf, "\xFF\xD8\xFF", 3) === 0) return 'jpg';
  if (strncmp($buf, "\x89PNG\r\n\x1A\n", 8) === 0) return 'png';
  if (strlen($buf) > 12 && substr($buf, 0, 4) === 'RIFF' && substr($buf, 8, 4) === 'WEBP') return 'webp';
  if (strncmp($buf, '%PDF-', 5) === 0) return 'pdf';
  return null;
}
function handle_upload() {
  $folder = isset($_GET['folder']) ? (string)$_GET['folder'] : '';
  $dirs = CMS_UPLOAD_DIRS;
  if (!isset($dirs[$folder])) throw new HttpError(400, 'Unknown upload folder.');
  $len = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
  if ($len > CMS_MAX_PDF) throw new HttpError(413, 'That file is too large.');
  $buf = (string)file_get_contents('php://input');
  if ($buf === '') throw new HttpError(413, $len > 0 ? 'The server rejected the file as too large. Try a smaller file.' : 'No file was received.');
  $kind = sniff($buf);
  if (!$kind) throw new HttpError(415, 'Only JPG, PNG, WEBP images' . ($folder === 'clippings' ? ' or PDF files' : '') . ' can be uploaded.');
  if ($kind === 'pdf' && $folder !== 'clippings') throw new HttpError(415, 'PDF files can only be uploaded as newspaper clippings.');
  if ($kind !== 'pdf') {
    if (strlen($buf) > CMS_MAX_IMAGE) throw new HttpError(413, 'Images must be smaller than 15 MB.');
    if (function_exists('getimagesizefromstring') && $kind !== 'webp' && @getimagesizefromstring($buf) === false) throw new HttpError(415, 'That image file is damaged or not a real image.');
  }
  $base = substr(cms_slugify(pathinfo(isset($_GET['name']) ? (string)$_GET['name'] : 'file', PATHINFO_FILENAME)), 0, 60);
  if ($base === '') $base = 'file';
  $rel = $dirs[$folder] . '/' . $base . '-' . substr(sha1($buf), 0, 8) . '.' . $kind;
  $abs = cms_path($rel);
  if (!is_dir(dirname($abs)) && !@mkdir(dirname($abs), 0755, true)) throw new HttpError(500, 'The uploads folder could not be created on the server.');
  if (@file_put_contents($abs, $buf, LOCK_EX) === false) throw new HttpError(500, 'The server did not allow saving the file. Check the uploads folder permissions.');
  @chmod($abs, 0644);
  return ['path' => $rel, 'size' => strlen($buf), 'kind' => $kind];
}

// ------------------------------------------------------------------ routes
start_session();
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
$route = trim(isset($_GET['r']) ? (string)$_GET['r'] : '', '/');
if ($method !== 'GET' && $method !== 'POST') throw new HttpError(405, 'Method not allowed.');
$hasPw = setting('password') !== null;

if ($route === 'state' && $method === 'GET') send(200, ['setup' => !$hasPw, 'authed' => $hasPw && authed(), 'token' => $hasPw && authed() ? $_SESSION['csrf'] : null, 'online' => true]);

if ($route === 'setup' && $method === 'POST') {
  guard_post(false);
  if ($hasPw) throw new HttpError(403, 'A password is already set.');
  $in = body_json();
  $codeFile = CMS_DATA . '/setup-code.php';
  $code = is_file($codeFile) ? (string)(include $codeFile) : '';
  usleep(400000);
  if ($code === '' || !isset($in['code']) || !is_string($in['code']) || !hash_equals($code, trim($in['code']))) throw new HttpError(403, 'The setup code is not correct. It is in the file admin/data/setup-code.php on your computer.');
  if (!isset($in['password']) || !is_string($in['password']) || strlen($in['password']) < 10) throw new HttpError(422, 'Use a password of at least 10 characters.');
  setting('password', password_hash($in['password'], PASSWORD_DEFAULT));
  @unlink($codeFile);
  login_session();
  send(200, ['ok' => true, 'token' => $_SESSION['csrf']]);
}
if ($route === 'login' && $method === 'POST') {
  guard_post(false);
  $ip = client_ip(); $t = q('SELECT fails, until FROM throttle WHERE ip = ?', [$ip])->fetch();
  if ($t && (int)$t['until'] > time()) throw new HttpError(429, 'Too many wrong attempts. Wait a few minutes and try again.');
  $in = body_json();
  if (!$hasPw || !isset($in['password']) || !is_string($in['password']) || !password_verify($in['password'], setting('password'))) {
    usleep(600000);
    $fails = ($t ? (int)$t['fails'] : 0) + 1;
    q('INSERT OR REPLACE INTO throttle (ip, fails, until) VALUES (?, ?, ?)', [$ip, $fails >= 5 ? 0 : $fails, $fails >= 5 ? time() + 300 : 0]);
    throw new HttpError(401, 'Wrong password.');
  }
  q('DELETE FROM throttle WHERE ip = ?', [$ip]);
  login_session();
  send(200, ['ok' => true, 'token' => $_SESSION['csrf']]);
}
if (!authed()) throw new HttpError(401, 'Please log in.');
if ($method === 'POST') guard_post(true);
$_SESSION['exp'] = time() + CMS_SESSION_HOURS * 3600;

if ($route === 'logout' && $method === 'POST') { $_SESSION = []; session_destroy(); send(200, ['ok' => true]); }
if ($route === 'password' && $method === 'POST') {
  $in = body_json();
  if (!isset($in['current']) || !password_verify((string)$in['current'], setting('password'))) throw new HttpError(401, 'Current password is wrong.');
  if (!isset($in['password']) || !is_string($in['password']) || strlen($in['password']) < 10) throw new HttpError(422, 'Use a password of at least 10 characters.');
  setting('password', password_hash($in['password'], PASSWORD_DEFAULT));
  send(200, ['ok' => true]);
}
if ($route === 'meta' && $method === 'GET') {
  $used = function ($types) { $ph = implode(',', array_fill(0, count($types), '?')); return q("SELECT DISTINCT category FROM items WHERE category <> '' AND type IN ($ph)", $types)->fetchAll(PDO::FETCH_COLUMN); };
  $types = []; foreach (CMS_TYPE_LABELS as $k => $l) $types[] = ['key' => $k, 'label' => $l];
  $counts = []; foreach (q('SELECT status, COUNT(*) c FROM items GROUP BY status')->fetchAll() as $r) $counts[$r['status']] = (int)$r['c'];
  send(200, [
    'types' => $types,
    'blogCategories' => array_values(array_unique(array_merge(CMS_BLOG_CATEGORIES, $used(CMS_BLOG_TYPES)))),
    'newsCategories' => array_values(array_unique(array_merge(array_keys(CMS_NEWS_CATEGORIES), $used(CMS_NEWS_TYPES)))),
    'publishers' => q('SELECT name, logo FROM publishers ORDER BY name')->fetchAll(),
    'counts' => $counts, 'pending' => 0, 'online' => true,
  ]);
}
if ($route === 'items' && $method === 'GET') {
  $where = []; $args = []; $g = $_GET;
  $types = array_merge(CMS_BLOG_TYPES, CMS_NEWS_TYPES);
  if (isset($g['type']) && in_array($g['type'], $types, true)) { $where[] = 'type = ?'; $args[] = $g['type']; }
  if (isset($g['status']) && in_array($g['status'], CMS_STATUSES, true)) { $where[] = 'status = ?'; $args[] = $g['status']; }
  if (!empty($g['category'])) { $where[] = 'category = ?'; $args[] = (string)$g['category']; }
  if (isset($g['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $g['from'])) { $where[] = 'pub_date >= ?'; $args[] = $g['from']; }
  if (isset($g['to']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $g['to'])) { $where[] = 'pub_date <= ?'; $args[] = $g['to']; }
  if (!empty($g['q'])) { $like = '%' . str_replace(['%', '_'], '', (string)$g['q']) . '%'; $where[] = '(title LIKE ? OR description LIKE ? OR publisher LIKE ?)'; array_push($args, $like, $like, $like); }
  $w = $where ? 'WHERE ' . implode(' AND ', $where) : '';
  $size = 20; $page = max(1, isset($g['page']) ? (int)$g['page'] : 1);
  $total = (int)q("SELECT COUNT(*) FROM items $w", $args)->fetchColumn();
  $rows = q("SELECT * FROM items $w ORDER BY pub_date DESC, sort_key ASC, id DESC LIMIT $size OFFSET " . (($page - 1) * $size), $args)->fetchAll();
  send(200, ['total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $size)), 'items' => array_map(function ($r) { return public_item($r, false); }, $rows)]);
}
if ($route === 'items' && $method === 'POST') {
  $in = body_json(); $f = clean_item($in, null); $now = now_iso();
  $r = commit_change(function () use ($f, $in, $now) {
    upsert_publisher($f['publisher'], isset($in['publisher_logo']) ? $in['publisher_logo'] : null);
    q('INSERT INTO items (type, status, title, description, body_html, category, author, pub_date, publisher, image, image_alt, clip_files, external_url, seo_title, meta_description, slug, faqs, keywords, schema_json, sort_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, -1, ?, ?)',
      [$f['type'], $f['status'], $f['title'], $f['description'], $f['body_html'], $f['category'], $f['author'], $f['pub_date'], $f['publisher'], $f['image'], $f['image_alt'], $f['clip_files'], $f['external_url'], $f['seo_title'], $f['meta_description'], $f['slug'], $f['faqs'], $f['keywords'], $f['schema_json'], $now, $now]);
    return (int)db()->lastInsertId();
  });
  send(200, ['item' => public_item(get_item($r['out'])), 'site' => $r['site']]);
}
if (preg_match('/^items\/(\d+)(?:\/(update|delete|status))?$/', $route, $rm)) {
  $id = (int)$rm[1]; $act = isset($rm[2]) ? $rm[2] : ''; $existing = get_item($id);
  if (!$existing) throw new HttpError(404, 'That item no longer exists.');
  if ($method === 'GET' && $act === '') send(200, ['item' => public_item($existing)]);
  if ($method === 'POST' && $act === 'update') {
    $in = body_json(); $f = clean_item($in, $existing); $now = now_iso();
    $label = !empty($existing['date_label']) && $existing['pub_date'] === $f['pub_date'] ? $existing['date_label'] : null;
    $r = commit_change(function () use ($f, $in, $now, $id, $existing, $label) {
      upsert_publisher($f['publisher'], isset($in['publisher_logo']) ? $in['publisher_logo'] : null);
      q('UPDATE items SET status = ?, title = ?, description = ?, body_html = ?, category = ?, author = ?, pub_date = ?, date_label = ?, publisher = ?, image = ?, image_alt = ?, clip_files = ?, external_url = ?, seo_title = ?, meta_description = ?, slug = ?, faqs = ?, keywords = ?, schema_json = ?, updated_at = ? WHERE id = ?',
        [$f['status'], $f['title'], $f['description'], $f['body_html'], $f['category'], $f['author'], $f['pub_date'], $label, $f['publisher'], $f['image'], $f['image_alt'], $f['clip_files'], !empty($existing['legacy_url']) ? $existing['external_url'] : $f['external_url'], $f['seo_title'], $f['meta_description'], $f['slug'], $f['faqs'], $f['keywords'], $f['schema_json'], $now, $id]);
    });
    send(200, ['item' => public_item(get_item($id)), 'site' => $r['site']]);
  }
  if ($method === 'POST' && $act === 'status') {
    $in = body_json(); $status = isset($in['status']) ? $in['status'] : '';
    if (!in_array($status, CMS_STATUSES, true)) throw new HttpError(400, 'Unknown status.');
    if ($status === 'published') clean_item(array_merge($existing, ['clip_files' => cms_json($existing['clip_files'], []), 'faqs' => cms_json(isset($existing['faqs']) ? $existing['faqs'] : '', []), 'status' => $status]), $existing);   // must be complete to publish
    $r = commit_change(function () use ($status, $id) { q('UPDATE items SET status = ?, updated_at = ? WHERE id = ?', [$status, now_iso(), $id]); });
    send(200, ['item' => public_item(get_item($id)), 'site' => $r['site']]);
  }
  if ($method === 'POST' && $act === 'delete') {
    backup_db('before-delete');
    $r = commit_change(function () use ($id) { q('DELETE FROM items WHERE id = ?', [$id]); });
    send(200, ['ok' => true, 'site' => $r['site']]);
  }
}
if ($route === 'upload' && $method === 'POST') send(200, handle_upload());
if ($route === 'regenerate' && $method === 'POST') { $r = commit_change(function () { return null; }); send(200, ['site' => $r['site']]); }
if ($route === 'backup' && $method === 'POST') {
  $dbFile = backup_db('manual');
  $dir = CMS_BACKUPS . '/uploads-' . gmdate('Y-m-d-H-i-s') . '-' . bin2hex(random_bytes(6));
  if (is_dir(cms_path('uploads'))) copy_dir(cms_path('uploads'), $dir);
  send(200, ['ok' => true, 'database' => 'admin/data/backups/' . basename($dbFile), 'uploads' => 'admin/data/backups/' . basename($dir)]);
}
if ($route === 'pending' && $method === 'GET') send(200, ['files' => []]);
throw new HttpError(404, 'Not found.');
