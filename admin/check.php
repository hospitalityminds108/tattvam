<?php
// Tat:vm Content Manager — server check. Open https://tatvmgroup.com/admin/check.php once after uploading.
// It only reports whether this hosting can run the admin. After a password is set it shows nothing.
define('CMS', 1);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
$root = dirname(__DIR__);
$data = __DIR__ . '/data';

$cfg = is_file($data . '/config.php') ? include $data . '/config.php' : [];
$dbFile = $data . '/' . (is_array($cfg) && !empty($cfg['db']) && preg_match('/^[A-Za-z0-9._-]+$/', $cfg['db']) ? $cfg['db'] : 'content.db');
$locked = false;
if (extension_loaded('pdo_sqlite') && is_file($dbFile)) {
  try { $db = new PDO('sqlite:' . $dbFile); $r = $db->query("SELECT value FROM settings WHERE key = 'password'"); $locked = $r && $r->fetch() ? true : false; } catch (Exception $e) {}
}
if ($locked) { echo '<p style="font-family:sans-serif">The Content Manager is already set up. <a href="./">Open the admin</a>.</p>'; exit; }

function writable_test($path) { if (!file_exists($path)) return false; if (is_dir($path)) { $t = $path . '/.cms-write-test'; $ok = @file_put_contents($t, 'x') !== false; @unlink($t); return $ok; } return is_writable($path); }
function bytes($v) { $v = trim((string)$v); $n = (float)$v; $u = strtolower(substr($v, -1)); if ($u === 'g') $n *= 1073741824; elseif ($u === 'm') $n *= 1048576; elseif ($u === 'k') $n *= 1024; return $n; }

$checks = [];
$checks[] = ['PHP 7.4 or newer', version_compare(PHP_VERSION, '7.4.0', '>='), 'This server runs PHP ' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . '.'];
$checks[] = ['SQLite database support (pdo_sqlite)', extension_loaded('pdo_sqlite'), 'Ask the hosting provider to enable the pdo_sqlite PHP extension.'];
$checks[] = ['JSON support', function_exists('json_encode'), 'Ask the hosting provider to enable the json PHP extension.'];
$checks[] = ['Sessions', function_exists('session_start'), 'Ask the hosting provider to enable PHP sessions.'];
$checks[] = ['Content database uploaded (in admin/data)', is_file($dbFile), 'Upload the whole admin folder, including every file in admin/data.'];
$checks[] = ['Setup code uploaded (admin/data/setup-code.php)', is_file($data . '/setup-code.php'), 'Upload admin/data/setup-code.php.'];
$checks[] = ['admin/data folder is writable', writable_test($data), 'Set the permissions of admin/data to 755 or 775.'];
$checks[] = ['Database file is writable', is_file($dbFile) && is_writable($dbFile), 'Set the permissions of the .db file in admin/data to 644 or 664.'];
foreach (['index.html', 'blogs.html', 'news.html', 'sitemap.xml'] as $f) $checks[] = [$f . ' can be updated', writable_test($root . '/' . $f), 'Set the permissions of ' . $f . ' to 644 or 664.'];
foreach (['blog', 'News'] as $d) $checks[] = [$d . '/ folder can receive new article pages', writable_test($root . '/' . $d), 'Set the permissions of the ' . $d . ' folder to 755 or 775.'];
foreach (['uploads/blogs', 'uploads/news', 'uploads/clippings', 'uploads/publishers'] as $d) $checks[] = [$d . '/ folder is writable', writable_test($root . '/' . $d), 'Upload the uploads folder and set ' . $d . ' to 755 or 775.'];
$limit = min(bytes(ini_get('post_max_size')) ?: PHP_INT_MAX, bytes(ini_get('memory_limit')) > 0 ? bytes(ini_get('memory_limit')) / 2 : PHP_INT_MAX);
$checks[] = ['Upload size limit is at least 8 MB', $limit >= 8 * 1048576, 'Files up to about ' . floor($limit / 1048576) . ' MB can be uploaded. Ask the host to raise post_max_size if you need larger clippings.'];
$pass = true; foreach ($checks as $c) if (!$c[1]) $pass = false;
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Content Manager — server check</title>
<style>body{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:#F4EEE4;color:#2B2420;margin:0;padding:24px}main{max-width:720px;margin:0 auto;background:#fff;border:1px solid #E5D9C6;border-radius:16px;padding:26px}h1{font-family:Georgia,serif;font-size:1.5rem;margin:0 0 6px}li{padding:.5rem 0;border-bottom:1px solid #f0e7d8;list-style:none}ul{padding:0}.ok{color:#2f7d32;font-weight:700}.no{color:#b3161c;font-weight:700}.hint{color:#7A6A60;font-size:.88rem;display:block;margin-left:1.6rem}.result{padding:14px;border-radius:12px;margin:16px 0;font-weight:700}.good{background:#e5f3e0;color:#2f7d32}.bad{background:#fdeaea;color:#a3161c}a.btn{display:inline-block;background:#8E1F24;color:#fff;padding:.7rem 1.2rem;border-radius:10px;text-decoration:none;font-weight:700}</style></head>
<body><main>
<h1>Content Manager — server check</h1>
<p>This page checks whether this hosting can run the Tat:vm Content Manager.</p>
<ul>
<?php foreach ($checks as $c): ?>
  <li><span class="<?= $c[1] ? 'ok' : 'no' ?>"><?= $c[1] ? '✔' : '✘' ?></span> <?= htmlspecialchars($c[0]) ?><?php if (!$c[1] || strpos($c[0], 'Upload size') === 0): ?><span class="hint"><?= htmlspecialchars($c[2]) ?></span><?php endif; ?></li>
<?php endforeach; ?>
  <li id="prot"><span id="protMark">…</span> Private files are blocked from visitors<span class="hint" id="protHint">Checking…</span></li>
</ul>
<div class="result <?= $pass ? 'good' : 'bad' ?>" id="result"><?= $pass ? 'The server checks passed.' : 'Some checks failed. Fix the items marked ✘ and reload this page.' ?></div>
<p><a class="btn" href="./" id="go" <?= $pass ? '' : 'style="display:none"' ?>>Open the Content Manager</a></p>
<script>
// the database, setup code and code library must NOT be downloadable
Promise.all(['data/probe.txt', 'data/setup-code.php', 'lib/generator.php'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text().then(t => ({ u, status: r.status, len: t.length }))).catch(() => ({ u, status: 0, len: 0 }))))
  .then(rs => {
    const open = rs.filter(r => r.status === 200 && r.len > 0);
    const ok = !open.length;
    document.getElementById('protMark').textContent = ok ? '✔' : '✘'; document.getElementById('protMark').className = ok ? 'ok' : 'no';
    document.getElementById('protHint').textContent = ok ? '' : 'Files inside admin/' + (open[0] || rs[0]).u.split('/')[0] + ' can be opened by anyone. Do NOT use the admin until this is fixed: the hosting is ignoring the .htaccess files in admin/data and admin/lib. Ask the host to allow .htaccess (AllowOverride) or to block those folders.';
    if (!ok) { const r = document.getElementById('result'); r.className = 'result bad'; r.textContent = 'Private files are exposed. Do not continue until this is fixed.'; document.getElementById('go').style.display = 'none'; }
  });
</script>
</main></body></html>
