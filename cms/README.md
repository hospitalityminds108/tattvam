# Tat:vm Content Manager

A dashboard for adding and managing Blogs, Insights, Company News, PR Articles, External News links and Newspaper Clippings on the Tat:vm website, without editing HTML.

It runs **on this computer only**. It does not use any cloud service. It updates the website files in this folder; you then upload the changed files to the hosting as usual.

## Start it

1. Double-click **`Start Content Manager.bat`** in the website folder.
2. A black window opens (keep it open) and the dashboard opens in your browser at `http://localhost:4600/admin/`.
3. The first time, you are asked to create a password (8+ characters). After that, log in with it.

To stop it, close the black window. Node.js must be installed on the computer (it already is on this one).

## Everyday use

- **Add new content** → choose the content type, fill the form, upload the image, then **Save as draft** or **Publish to website**.
- **Drafts and unpublished items never appear on the website.**
- **Edit** changes a published item everywhere it appears. **Unpublish** removes it from the website but keeps it in the dashboard. **Delete** removes it for good (asks first).
- Use the search box and the Type / Category / Status / Date filters to find items.
- **View website** opens a preview of the site from this computer, so you can check a change before uploading.

### What each content type does

| Type | Where it appears | What opens when clicked |
|---|---|---|
| Blog, Insight | Blog page, homepage "Insights" cards | A new article page in `blog/` built from the site's article design |
| Company News, PR Article | News & Updates page, homepage news | A new article page in `News/` |
| External News | News & Updates page, homepage news | The original article address, in a new tab |
| Newspaper Clipping | News & Updates page, homepage news | The uploaded clipping pages in the zoom viewer |

The publisher logo you upload appears in the corner of the news card. Once added, a publisher can be picked from the list next time.

## Putting changes on the live website

Publishing changes the files **on this computer**. To show them on tatvmgroup.com:

1. Click **Files to upload** in the dashboard. It lists every file that changed (and any page to delete).
2. Upload those files to the hosting, into the same folders (for example `uploads/blogs/photo.jpg` goes into `uploads/blogs/`).
3. Click **I have uploaded them**.

Do **not** upload the `cms` folder. If it is uploaded by mistake, the `.htaccess` inside it blocks access.

## Where things are kept

- `cms/data/content.db` — the content database (SQLite).
- `uploads/blogs`, `uploads/news`, `uploads/clippings`, `uploads/publishers` — uploaded images and PDFs. These are part of the website and must be uploaded to the hosting.
- `cms/data/backups/` — automatic database copies (one each time the tool starts and before every delete; the newest 40 are kept), plus `site-before-cms/`, an untouched copy of the four pages the tool rewrites.
- **Settings → Back up now** saves the database and all uploads into `cms/data/backups/`. Copy that folder to another drive from time to time.

## Good to know

- The 26 blogs and 9 news items that existed before this tool are listed in the dashboard. Their card details (title, description, image, date, status) can be changed; the text on those older article pages is not edited from the dashboard.
- Older article pages keep their own "Latest posts" sidebars; new posts appear on the listing pages and homepage, and in the sidebars of other CMS-made pages.
- The tool rewrites these files when you publish: `index.html` (blog cards and news list), `blogs.html`, `news.html`, `sitemap.xml`, and the CMS-made pages in `blog/` and `News/`. It refuses to overwrite any article page it did not create.
- Do not run the old `.claude/blog-build.js` script any more; it would overwrite the blog listings.
- Forgot the password? Close the tool, delete the `password` row with any SQLite editor, or ask your developer to run:
  `node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('cms/data/content.db').exec(\"DELETE FROM settings WHERE key='password'\")"`
  The next start asks for a new password. Content is not affected.

## Testing (for developers)

`node cms/test/workflow-test.js <path-to-a-COPY-of-the-site>` runs the full create → draft → publish → edit → unpublish → delete workflow for a blog, an external link, a clipping and a PR article, plus security and upload checks. It refuses to run on the real site folder.
