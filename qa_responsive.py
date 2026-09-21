#!/usr/bin/env python3
"""Responsive QA: capture screenshots + detect horizontal overflow at key widths."""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
WIDTHS = [320, 360, 375, 390, 414, 430, 480, 600, 768, 820, 834, 1024, 1280, 1366, 1440, 1600]
PAGES = ["index.html", "about.html", "projects.html", "contact.html",
         "projects/ghatkopar-mixed-use.html", "insights.html", "redevelopment.html",
         "faqs.html", "404.html", "privacy-policy.html"]
OUT = "qa_shots"
os.makedirs(OUT, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        issues = []
        for pg in PAGES:
            for w in WIDTHS:
                await page.set_viewport_size({"width": w, "height": 900})
                await page.goto(f"{BASE}/{pg}", wait_until="networkidle")
                await page.wait_for_timeout(400)
                # horizontal overflow check
                res = await page.evaluate("""() => {
                    const de = document.documentElement;
                    const over = de.scrollWidth - de.clientWidth;
                    let worst = null, max = 0;
                    document.querySelectorAll('*').forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.right > de.clientWidth + 2 && r.width > 0) {
                            const o = r.right - de.clientWidth;
                            if (o > max) { max = o; worst = el.tagName + '.' + (el.className||'').toString().slice(0,40); }
                        }
                    });
                    return {over, worst, max};
                }""")
                if res["over"] > 2:
                    issues.append((pg, w, res["over"], res["worst"]))
                if w in (320, 390, 768, 1440):
                    await page.screenshot(path=f"{OUT}/{pg.replace('/','_')}_{w}.png", full_page=False)
        await browser.close()
        print("HORIZONTAL OVERFLOW ISSUES:", len(issues))
        for i in issues:
            print(f"  {i[0]:38s} w={i[1]:5d} overflow={i[2]:4d}px  worst={i[3]}")


asyncio.run(main())
