import puppeteer from "puppeteer-core";

const out = "/opt/cursor/artifacts";
const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.setDefaultTimeout(45000);
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.log("CONSOLE", message.text());
});

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("shot", name, page.url());
}

const base = process.env.APP_URL ?? "http://127.0.0.1:43124";
await page.goto(base, { waitUntil: "networkidle0" });
await shot("01-landing");

await page.click("a[href='/signup']");
await page.waitForSelector("input[name=email]");
await page.type("input[name=displayName]", "Rowan");
await page.type("input[name=email]", `rowan.${Date.now()}@example.com`);
await page.type("input[name=password]", "flower-bed-2026");
await shot("02-signup");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click("button[type=submit]"),
]);
await shot("03-after-signup");

if (!page.url().includes("/farms/new")) {
  await page.goto(`${base}/app/farms/new`, { waitUntil: "networkidle0" });
}
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((item) => item.textContent?.trim() === "Edinburgh"));
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Edinburgh");
  button?.click();
});
await page.waitForFunction(
  () => (document.querySelector("input[name=lastSpring]")?.value || "").length > 0,
  { timeout: 30000 },
);
await shot("04-frost-estimate");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Save this farm"));
    button?.click();
  }),
]);
await shot("05-farm-overview");

await page.goto(page.url().replace(/\/$/, "") + "/flowers", { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Starter mix"), { timeout: 20000 });
await shot("06-flowers");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Add this mix"));
  button?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Take off the plan"), { timeout: 20000 });

await page.goto(page.url().replace(/\/flowers$/, "/beds"), { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Add a bed"), { timeout: 20000 });
await page.evaluate(() => {
  const preset = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("1.2 × 4"));
  preset?.click();
});
await page.type("input[name=name]", "Annual bed");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Add bed");
  button?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("rows") || document.querySelectorAll("h3").length > 0, {
  timeout: 20000,
});
await page.evaluate(() => {
  const flower = [...document.querySelectorAll("button")].find((item) =>
    ["Sweet pea", "Cosmos", "Zinnia", "Calendula"].includes(item.textContent?.trim() ?? ""),
  );
  flower?.click();
});
await new Promise((resolve) => setTimeout(resolve, 300));
await page.evaluate(() => {
  const bed = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Tap to"));
  bed?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("plants") || document.body.innerText.includes("rows"), {
  timeout: 20000,
});
await shot("07-beds");

await page.goto(page.url().replace(/\/beds$/, "/week"), { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("season") || document.body.innerText.includes("Sow"), {
  timeout: 20000,
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Whole season"));
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 400));
await shot("08-calendar");

await page.setViewport({ width: 390, height: 844 });
await shot("09-calendar-mobile");

const text = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("CALENDAR TEXT\n", text);
await browser.close();
