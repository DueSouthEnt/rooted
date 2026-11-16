import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chrome = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((path) => existsSync(path));
const base = process.env.ROOTED_URL ?? "http://127.0.0.1:43123";

let live = false;
if (chrome) {
  try {
    live = (await fetch(`${base}/login`)).ok;
  } catch {
    live = false;
  }
}

describe.skipIf(!chrome || !live)("year plan drag highlight", () => {
  it("paints free beds green once, without re-rendering every row", async () => {
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.default.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${base}/login`, { waitUntil: "networkidle0" });
    await page.type('input[name="email"]', "rowan.1794762634221@example.com");
    await page.type('input[name="password"]', "flower-bed-2026");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
    await page.goto(`${base}/app/farms/cb0b0301-5cac-45f1-9621-07c49dbb575f/timeline`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-testid='sow-sweet-pea']");
    const before = await page.$$eval("[data-renders]", (rows) => rows.map((row) => row.getAttribute("data-renders")));
    expect(before.length).toBeGreaterThan(5);

    const card = await page.$("[data-testid='sow-sweet-pea']");
    const grid = await page.$("[data-testid='bed-grid']");
    const from = await card?.boundingBox();
    const gridBox = await grid?.boundingBox();
    if (!from || !gridBox) throw new Error("Missing drag handles");
    await page.mouse.move(from.x + 24, from.y + 16);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(gridBox.x + 280, gridBox.y + 80 + step * 12);
    }
    const mid = await page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>("[data-bed-id]")];
      const free = rows.filter((row) => row.classList.contains("bed-free"));
      const busy = rows.filter((row) => row.classList.contains("bed-busy"));
      const colour = free[0] ? getComputedStyle(free[0]).backgroundColor : "";
      return {
        free: free.length,
        busy: busy.length,
        colour,
        renders: rows.map((row) => row.getAttribute("data-renders")),
      };
    });
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v6-drag.png" });
    await page.mouse.up();
    await browser.close();

    expect(mid.free).toBeGreaterThan(0);
    expect(mid.busy).toBeGreaterThan(0);
    expect(mid.colour).toBe("rgb(183, 215, 168)");
    expect(mid.renders).toEqual(before);
  }, 40_000);
});
