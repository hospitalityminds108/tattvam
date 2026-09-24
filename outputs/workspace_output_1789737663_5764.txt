# Tat:vm Website v2 — Handover Note

**Client:** Tat:vm Builders & Developers Pvt Ltd (CIN U43299MH2025PTC455088)
**Build:** Static site — 21 HTML pages, pure HTML/CSS/JS (no frameworks, no build step)
**Contact:** Unit 607, 6th Floor, Lodha Supremus, Powai — offices at Lower Parel (as configured) · +91-22-3500-6800 · info@tatvmgroup.com

---

## 1. What was delivered (per client feedback, all 14 points)

1. **Template inspiration** — houseofhiranandani.com / lodhagroup.com / apple.com / in.nothing.tech / sobha.com: clean typographic layout, generous whitespace, editorial section rhythm, calm premium feel.
2. **Human touch** — emotional, artistic copy ("Rooted in you"), earthy-vibrant palette (deep red #8E1F24, lime #9FB63D, cream backgrounds) with the requested **light-pink footer** (#F6D7DA).
3. **Primary nav** matches the deck: About · Projects · Redevelopment · **Opportunities (with "Work with us")** · Insights · Contact.
4. **Homepage hero** = stock-footage video (14.8s, 1080p, muted autoplay loop), small title, minimal copy. Poster fallback included.
5. **No cursor dot** — removed; standard cursor site-wide.
6. **Chatbot slot (bottom-right)** prepared for **Sell.do** — see §3 for the 5-minute integration.
7. **Email option** added to the bottom-right float stack (WhatsApp + Call unchanged).
8. **5 fundamentals section** sits AFTER the Raahul Maroo section, BEFORE project cards.
9. **5 tattvas shown ALL TOGETHER** — one interactive pentagon creative; tap any node; poem stays prominent above.
10. **HD imagery** — all photography audited and corrected; two off-brand US-house images replaced with on-brand Mumbai tower + retail interior (1536×1024).
11. **Organisations / eco-system section REMOVED** — rationale prepared for the client call (see §4).
12. **Insights** — Carousel 1: three blogs; Carousel 2: three news items directly beneath; specific CTAs on each.
13. **Visual SVG icons** throughout (hand-drawn inline set, ~40 icons in `assets/js/svg.js`).
14. **Short SEO/AEO/GEO-ready copy** — every page: unique title + meta description, JSON-LD (Org, BreadcrumbList, FAQPage on FAQs/NRI, BlogPosting/ItemList on Insights, Service on Redevelopment, ContactPage), robots.txt, sitemap.xml (20 URLs).

## 2. Site map (21 pages)

- **Home:** index.html (video hero → who we are → founder → 5 tattvas pentagon → poem → projects → insights 3+3 → CTA)
- **About cluster:** about · our-approach · vision-mission · brand-story · leadership · csr
- **Projects:** projects hub · projects/ghatkopar-mixed-use · projects/ghatkopar-residential
- **Redevelopment:** redevelopment (society journey, 5 steps, poem band, Service schema)
- **Opportunities:** work-with-us · network-partners · nri (FAQPage schema)
- **Insights:** insights (3 blogs + 3 news, deep-linked from homepage carousels) · faqs (FAQPage schema)
- **Contact:** contact (form, office card, Maps link, ContactPage schema)
- **Legal/other:** 404 · privacy-policy · terms-and-conditions · cookie-policy · robots.txt · sitemap.xml

## 3. Sell.do chatbot — 5-minute integration

The floating stack (WhatsApp / Call / Email / Chat) lives in `assets/js/components.js`, function `floatStack()`. The Chat button currently opens a small demo window (`tatvmOpenChat`).

**To go live with Sell.do:**
1. Open `assets/js/components.js` and find the block marked `/* === CHAT SLOT (Sell.do) === */`.
2. Replace the demo window code with the client's Sell.do embed snippet (script tag from their Sell.do dashboard → Settings → Chat Widget → Install).
3. Sell.do renders its own launcher bottom-right; if it overlaps the float stack, either remove our Chat button (one line) or set the Sell.do widget `bottom` offset (~90px).
4. Bump the cache-buster: change `?v=5` → `?v=6` on the four asset URLs in every HTML page (or use the bundled `bump-version.py`).

## 4. Organisations section — rationale for the client call

The "Our Organisations / Eco-system" strip was removed as requested. Suggested framing for the call: the eco-system section asked visitors to digest corporate structure before they had any emotional reason to care. It diluted the single most important idea — *a developer built on five fundamentals, rooted in you* — and pushed the founder's story and the pentagon below the fold. The information is preserved where it works harder: entity facts (CIN, office, contact) sit in the footer and About page; partner/channel relationships live under Opportunities (Work With Us / Network Partners). When the group has multiple consumer-facing brands worth showcasing, a dedicated "Group Companies" page can be added without disturbing the homepage flow — recommend revisiting after the first two projects are launched.

## 5. Known placeholders / next steps

- **Founder portrait** — `assets/img/founder-portrait.jpg` is an editorial back-view placeholder. Replace the file (same filename) with the official portrait of Raahul Maroo when available; no code change needed.
- **RERA numbers** — project pages state "Registration in progress". Add real RERA registration numbers in `projects/ghatkopar-*.html` (spec grid, 2 spots per page) when received.
- **Hero video** — `assets/vid/hero.mp4` is licensed stock footage. If the client wants project footage later, replace the file (same name) and swap `hero-poster.jpg` to match the first frame.
- **Contact form** — currently front-end validated with a success state; wire the `data-tatvm-form` handler in `assets/js/main.js` to the client's inbox/Sell.do form ID when provided.
- **Insights articles** — blog/news entries are written as full in-page articles; when a CMS is adopted they can be split into individual posts. Anchors (`#why-redevelopment` etc.) must be preserved if URLs change.

## 6. Maintenance cheat-sheet

- **Text edits:** each page is a standalone HTML file; shared header/footer inject via `#header-slot` / `#footer-slot` (`assets/js/components.js`).
- **Colours/spacing:** `assets/css/style.css` — CSS variables at the top (`--red`, `--green`, `--blush`…).
- **Icons:** `assets/js/svg.js` (`T.icon('name')`); the pentagon creative is `T.pentagon()`.
- **After any asset change:** bump `?v=N` on style.css / svg.js / components.js / main.js across pages.
- **QA quickly:** `python3 -m http.server 8080` and open any page; check `/projects/*` pages specifically (subdirectory depth handling).

## 7. QA summary (what was checked before delivery)

- All 21 pages parse as valid HTML; all internal links + anchors resolve (200); all images exist and load; JSON-LD validates as JSON.
- Subdirectory nav depth bug found and fixed (`components.js`): Projects/Redevelopment/Contact links now correctly prefix `../` on `/projects/` pages; verified all links 200 OK in-browser.
- No horizontal overflow at 375 / 768 / 1024 / 1920 px on all pages.
- Invalid duplicate `<meta property="description">` removed from 7 pages (kept the correct `og:description`).
- Image audit: every photo checked for brand fit; 8 replacements made across the build (skyline, city golden-hour, family moving-in, leafy lane, Ghatkopar street, residential tower, retail interior + poster).
- Cache-busted assets at `?v=5`.
