# Tat:vm Website — Audit & Fix Plan

## Phase 1 — Critical Structural Fixes
- [x] Create assets/ tree (css, js, img, vid) and move all asset files into it
- [x] Fix root-level ./leadership.jpeg refs (index.html, leadership.html)
- [x] Move ghatkopar-*.html into projects/ (matches ../assets + canonical URLs)
- [x] Fix logo path in svg.js (assets/img/tatvm_logo.png)
- [x] Verify all asset references resolve after move (0 broken)

## Phase 2 — Data & Encoding Integrity
- [x] Fix mojibake (UTF-8 double-encoding) across all affected HTML files (0 remaining)
- [x] Fix malformed JSON-LD BreadcrumbList (9 files) — all 21 blocks valid
- [x] Fix malformed og:image path (ghatkopar-mixed-use.html + residential)

## Phase 3 — Consistency & Structure
- [x] Standardize header/footer slot markup + script placement across pages
- [x] Verify nav links / internal links resolve (no dead links)
- [x] Verify section container system consistency
- [x] Fix nav parent links (About/Insights now navigate; # parents don't jump)
- [x] Fix invisible header nav on light-hero pages (404/legal) — solid header
- [x] Fix contact.html email overflow at 414/430px

## Phase 4 — UI/UX, Responsive & Interaction
- [x] Header (all pages) — sticky, dropdowns, mega menu, mobile nav
- [x] Footer (all pages) — columns, contrast, links
- [x] Hover effects / stability, cards, images, contrast, typography
- [x] Responsive breakpoints (320→1600+px) & mobile experience (0 overflow)
- [x] Sliders/carousels, animations, z-index/overflow
- [x] Buttons/links, forms (field labels fixed)
- [x] Mobile menu click-through fix (z-index/pointer-events)
- [x] Carousel controls hide when nothing to scroll

## Phase 5 — Final QA & Report
- [ ] Final QA pass across all 21 pages
- [ ] Produce 11-section final report + confirmation statement
