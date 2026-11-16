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
    await page.waitForFunction(() => document.querySelectorAll("[data-renders]").length > 5);
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

  it("keeps a dropped planting on that bed after reload, and a moved bar too", async () => {
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
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v7-header.png", clip: { x: 0, y: 0, width: 1440, height: 220 } });

    const card = await page.$("[data-testid='sow-sweet-pea']");
    const from = await card?.boundingBox();
    if (!from) throw new Error("No tray card");
    await page.mouse.move(from.x + 24, from.y + 16);
    await page.mouse.down();
    await page.mouse.move(from.x + 180, from.y + 10, { steps: 6 });
    const targetId = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".bed-row.bed-free");
      return row?.dataset.bedId ?? null;
    });
    if (!targetId) throw new Error("No free bed lit up");
    const target = await page.$(`[data-bed-id="${targetId}"]`);
    const to = await target?.boundingBox();
    if (!to) throw new Error("Free bed has no box");
    await page.mouse.move(to.x + Math.min(320, to.width * 0.45), to.y + to.height / 2, { steps: 12 });
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v7-drag.png" });
    await page.mouse.up();
    await page.waitForFunction(
      (bedId) => {
        const row = document.querySelector(`[data-bed-id="${bedId}"]`);
        const grid = document.querySelector("[data-testid='bed-grid']");
        return Boolean(row && /sweet pea/i.test(row.textContent ?? "") && grid?.getAttribute("data-settled-ms") && grid.getAttribute("data-save") === "ok");
      },
      { timeout: 15000 },
      targetId,
    );
    const settled = Number(await page.$eval("[data-testid='bed-grid']", (node) => node.getAttribute("data-settled-ms")));
    console.log(`drop-to-settled-ms ${settled}`);
    expect(settled).toBeLessThan(500);
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v7-gantt.png" });

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(`[data-bed-id="${targetId}"]`);
    const afterReload = await page.$eval(`[data-bed-id="${targetId}"]`, (node) => node.textContent ?? "");
    expect(afterReload.toLowerCase()).toContain("sweet pea");
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v7-reloaded.png" });

    await page.$eval(`[data-bed-id="${targetId}"]`, (element) => element.scrollIntoView({ block: "center" }));
    const bar = await page.$(`[data-bed-id="${targetId}"] [data-testid^='gantt-bar-']`);
    const barBox = await bar?.boundingBox();
    if (!barBox) throw new Error("Placed bar missing after reload");
    await page.mouse.move(barBox.x + Math.min(80, barBox.width / 3), barBox.y + barBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(barBox.x + 40, barBox.y + barBox.height + 24, { steps: 6 });
    await page.waitForSelector(".bed-row.bed-free", { timeout: 3000 });
    const nextId = await page.evaluate((current) => {
      const row = [...document.querySelectorAll<HTMLElement>(".bed-row.bed-free")].find((item) => item.dataset.bedId !== current);
      return row?.dataset.bedId ?? null;
    }, targetId);
    if (!nextId) throw new Error("No other free bed while moving the bar");
    const next = await page.$(`[data-bed-id="${nextId}"]`);
    const nextBox = await next?.boundingBox();
    if (!nextBox) throw new Error("Next bed missing");
    await page.mouse.move(nextBox.x + 300, nextBox.y + nextBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(
      (bedId) => {
        const row = document.querySelector(`[data-bed-id="${bedId}"]`);
        return /sweet pea/i.test(row?.textContent ?? "") && document.querySelector("[data-testid='bed-grid']")?.getAttribute("data-save") === "ok";
      },
      { timeout: 15000 },
      nextId,
    );
    await page.reload({ waitUntil: "networkidle0" });
    const moved = await page.$eval(`[data-bed-id="${nextId}"]`, (node) => node.textContent ?? "");
    expect(moved.toLowerCase()).toContain("sweet pea");
    await browser.close();
  }, 60_000);

  it("takes a one-bed planting out of the tray and does not duplicate it", async () => {
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
    await page.goto(`${base}/app/farms/cb0b0301-5cac-45f1-9621-07c49dbb575f/plants`, { waitUntil: "networkidle0" });
    await page.click("[data-testid='open-planting-dialog']");
    await page.waitForSelector("[data-testid='planting-flower-search']");
    await page.type("[data-testid='planting-flower-search']", "Cornflower");
    await page.waitForFunction(() => [...document.querySelectorAll("[data-testid='planting-dialog'] button")].some((node) => node.textContent?.trim().startsWith("Cornflower")));
    await page.evaluate(() => [...document.querySelectorAll("[data-testid='planting-dialog'] button")].find((node) => node.textContent?.trim().startsWith("Cornflower"))?.click());
    await page.waitForSelector("[data-testid='succession-count']");
    await page.$eval("[data-testid='succession-count']", (element) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "1");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.$eval("[data-testid='planting-variety']", (element) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Once");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("[data-testid='save-planting']");
    await page.waitForFunction(() => !document.querySelector("[data-testid='planting-dialog']") && document.body.innerText.includes("Once"), { timeout: 15000 });
    await page.goto(`${base}/app/farms/cb0b0301-5cac-45f1-9621-07c49dbb575f/timeline`, { waitUntil: "networkidle0" });
    const picked = await page.evaluate(() => {
      const card = [...document.querySelectorAll<HTMLElement>("[data-testid^='unassigned-']")].find((node) => {
        const label = node.querySelector("span")?.textContent?.trim() ?? "";
        return /1 bed/.test(node.textContent ?? "") && !/^\d/.test(label);
      });
      return { testId: card?.getAttribute("data-testid") ?? null, flower: card?.querySelector("span")?.textContent?.trim() ?? "" };
    });
    const testId = picked.testId;
    const flower = picked.flower;
    if (!testId || !flower) throw new Error("No one-bed planting in the tray");
    const card = await page.$(`[data-testid='${testId}']`);
    const from = await card?.boundingBox();
    if (!from) throw new Error("Tray card missing");
    const beforeBars = await page.$$eval("[data-testid^='gantt-bar-']", (nodes) => nodes.filter((node) => /Once/.test(node.textContent ?? "")).length);
    await page.mouse.move(from.x + 20, from.y + 16);
    await page.mouse.down();
    await page.mouse.move(from.x + 160, from.y + 8, { steps: 5 });
    const targetId = await page.$eval(".bed-row.bed-free", (node) => (node as HTMLElement).dataset.bedId ?? "");
    const target = await page.$(`[data-bed-id="${targetId}"]`);
    const to = await target?.boundingBox();
    if (!to) throw new Error("No free bed");
    await page.mouse.move(to.x + 280, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(
      (id) => !document.querySelector(`[data-testid='${id}']`) && document.querySelector("[data-testid='bed-grid']")?.getAttribute("data-save") === "ok",
      { timeout: 15000 },
      testId,
    );
    expect(await page.$(`[data-testid='${testId}']`)).toBeNull();
    await page.reload({ waitUntil: "networkidle0" });
    expect(await page.$(`[data-testid='${testId}']`)).toBeNull();
    const bars = await page.$$eval("[data-testid^='gantt-bar-']", (nodes) => nodes.filter((node) => /Once/.test(node.textContent ?? "")).length);
    expect(bars).toBe(beforeBars + 1);
    expect(flower.length).toBeGreaterThan(0);
    await browser.close();
  }, 60_000);

  it("shows a succession group and places the sowings on the chart", async () => {
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
    await page.goto(`${base}/app/farms/cb0b0301-5cac-45f1-9621-07c49dbb575f/plants`, { waitUntil: "networkidle0" });
    await page.click("[data-testid='open-planting-dialog']");
    await page.type("[data-testid='planting-flower-search']", "Cosmos");
    await page.waitForFunction(() => [...document.querySelectorAll("[data-testid='planting-dialog'] button")].some((node) => node.textContent?.trim().startsWith("Cosmos")));
    await page.evaluate(() => [...document.querySelectorAll("[data-testid='planting-dialog'] button")].find((node) => node.textContent?.trim().startsWith("Cosmos"))?.click());
    await page.waitForSelector("[data-testid='succession-count']");
    await page.$eval("[data-testid='succession-count']", (element) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForSelector("[data-testid='succession-preview']");
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v9-dialog.png" });
    await page.click("[data-testid='save-planting']");
    await page.waitForFunction(() => /Cosmos/.test(document.body.innerText) && !document.querySelector("[data-testid='succession-preview']"), { timeout: 15000 });
    await page.goto(`${base}/app/farms/cb0b0301-5cac-45f1-9621-07c49dbb575f/timeline`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-testid^='succession-drag-']");
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v9-tray.png" });
    const card = await page.$("[data-testid^='succession-drag-']");
    const from = await card?.boundingBox();
    if (!from) throw new Error("No succession group");
    await page.mouse.move(from.x + 30, from.y + 16);
    await page.mouse.down();
    await page.mouse.move(from.x + 200, from.y + 10, { steps: 6 });
    const targetId = await page.$eval(".bed-row.bed-free", (node) => (node as HTMLElement).dataset.bedId ?? "");
    const target = await page.$(`[data-bed-id="${targetId}"]`);
    const to = await target?.boundingBox();
    if (!to) throw new Error("No free bed for the succession");
    await page.mouse.move(to.x + 300, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='bed-grid']")?.getAttribute("data-save") === "ok" && /Cosmos/.test(document.body.innerText),
      { timeout: 15000 },
    );
    await page.screenshot({ path: "/opt/cursor/artifacts/rooted-v9-gantt.png" });
    const onChart = await page.$$eval("[data-testid^='gantt-bar-']", (bars) => bars.filter((bar) => /Cosmos/i.test(bar.textContent ?? "")).length);
    expect(onChart).toBeGreaterThan(0);
    await browser.close();
  }, 60_000);
});
