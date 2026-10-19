# Tat:vm Content Manager — online version (tatvmgroup.com/admin/)

The online admin is the same dashboard as the local tool, rebuilt in PHP so it runs on the website's own hosting. Anyone with the password can log in from any computer at **https://tatvmgroup.com/admin/** (there is also an "Admin" link in the website footer). Publishing changes the live website straight away; there is no "files to upload" step.

It uses PHP 7.4+ and an SQLite database file on the hosting. No cloud service.

## One-time installation

Do these in order.

1. **Upload the current website first.** The live site must have the current versions of `index.html`, `blogs.html`, `news.html`, `sitemap.xml`, the `News/` and `blog/` folders, `assets/` (including `assets/js/components.js`, `assets/js/clip-viewer.js`, `assets/css/style.css`, `assets/img/news/`). The admin reads and rewrites these pages, so older copies on the server will make it stop with a "could not find…" message.
2. **Upload two folders** to the website root, keeping their structure, including the hidden `.htaccess` files:
   - `admin/` (everything inside, including `admin/data/` and `admin/lib/`)
   - `uploads/`
3. **Open `https://tatvmgroup.com/admin/check.php`.** Every line must show ✔.
   - ✘ on a "writable" line: set that file to permission 644/664 or that folder to 755/775 in the hosting file manager.
   - ✘ on "SQLite database support": ask the hosting provider to enable the `pdo_sqlite` PHP extension.
   - ✘ on "Private files are blocked from visitors": **stop.** The hosting is ignoring `.htaccess`. Ask the provider to allow `.htaccess` overrides, then check again.
4. **Open `https://tatvmgroup.com/admin/`** and complete "Create your password":
   - **Setup code:** open the file `admin/data/setup-code.php` on the office computer in Notepad and copy the code between the quotes.
   - **Password:** at least 10 characters. Use one that is not used anywhere else.
   Do this straight after uploading. The setup code works once; the file deletes itself from the server afterwards.

Do **not** upload the `cms/` folder. It is the local tool and the tests.

## After it is live

- **Stop using the local tool** (`Start Content Manager.bat`). From now on the server holds the content; the copy on the office computer is no longer current. Running both would make them overwrite each other.
- **The website folder on the office computer is no longer the master copy** of `index.html`, `blogs.html`, `news.html`, `sitemap.xml`, the CMS-made pages in `blog/` and `News/`, and `uploads/`. Before uploading any of those from the office computer again (for example after a design change), download the current versions from the server first, or the admin's changes will be lost.
- **Page caching:** the hosting caches pages for up to an hour, so visitors may see a change a little later. Use Ctrl+F5 to check immediately.
- **Backups:** the database is copied automatically before every delete. **Settings → Back up now** saves the database and all uploads into `admin/data/backups/` on the server; download that folder from the hosting file manager from time to time.
- **Forgot the password:** using the hosting file manager, download the `.db` file from `admin/data/`, or ask your developer to delete the `password` row from its `settings` table and to upload a new `admin/data/setup-code.php` (same format as the original, with a new code). The admin then asks for a new password. Content is not affected.

## What protects it

- Password login (stored hashed), sessions that expire after 8 hours without use, and a lockout after 5 wrong passwords.
- First-time setup needs the one-time setup code, so a stranger cannot claim the admin before you do.
- Every change request must carry a session token and come from the site itself.
- Uploads are checked by content, not by name: only real JPG, PNG, WEBP images (and PDF for clippings). They are saved under generated names that can never end in `.php`.
- Article text is cleaned of scripts and unsafe links before it is saved.
- `admin/data` and `admin/lib` are closed to visitors by `.htaccess`, the database file has a random name, and `uploads/` cannot run scripts.

## Tested

`node cms/test/php-workflow-test.js <copy-of-site> <php.exe>` runs 88 checks against PHP's built-in server on a copy of the site: security, uploads, and the full create → draft → publish → edit → unpublish → delete workflow for a blog, an external link, a clipping and a PR article. The PHP generator's output for the existing content is byte-identical to the current site files.

Not tested: your actual hosting. `check.php` exists to confirm it before first use.
