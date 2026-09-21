#!/usr/bin/env python3
"""Final QA sweep: console errors, broken images, missing header/footer, JS errors."""
import asyncio, glob
from playwright.async_api import async_playwright

PAGES = sorted(glob.glob('*.html')) + sorted(glob.glob('projects/*.html'))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errors = []
        for f in PAGES:
            msgs = []
            pg.on("console", lambda m: msgs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: msgs.append("PAGEERROR: " + str(e)))
            await pg.set_viewport_size({"width": 1440, "height": 900})
            await pg.goto(f"http://localhost:8080/{f}", wait_until="networkidle")
            await pg.wait_for_timeout(700)
            res = await pg.evaluate("""() => {
                const imgs = [...document.images];
                const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'));
                return {
                    header: !!document.querySelector('.site-header'),
                    footer: !!document.querySelector('.site-footer'),
                    navLinks: document.querySelectorAll('.nav-desktop .nav-item').length,
                    brokenImgs: broken,
                    title: document.title
                };
            }""")
            if msgs or res["brokenImgs"] or not res["header"] or not res["footer"]:
                errors.append((f, msgs, res))
        await b.close()
        print("PAGES WITH ISSUES:", len(errors))
        for f, msgs, res in errors:
            print(f"\n{f}")
            if msgs: print("  console:", msgs[:5])
            if res["brokenImgs"]: print("  broken imgs:", res["brokenImgs"])
            if not res["header"]: print("  MISSING HEADER")
            if not res["footer"]: print("  MISSING FOOTER")
        print("\nAll pages checked:", len(PAGES))


asyncio.run(main())
