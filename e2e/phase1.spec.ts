import { expect, test } from "@playwright/test";

const artifacts = "/opt/cursor/artifacts";
const mock = process.env.MOCK_URL ?? "http://127.0.0.1:5499";

test("sign up, confirm, log in, and switch sections", async ({ page }) => {
  const hydration: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /hydration|did not match/i.test(text)) hydration.push(text);
  });
  page.on("pageerror", (error) => {
    if (/hydration|did not match/i.test(error.message)) hydration.push(error.message);
  });

  await page.goto("/flowers");
  await expect(page).toHaveURL(/\/login/);
  expect(page.url()).toContain("next=%2Fflowers");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan your growing year, from frost to harvest." })).toBeVisible();
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/landing-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/landing-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(page.getByTestId("signup-form")).toHaveAttribute("data-hydrated", "true");
  await page.getByTestId("section-flowers").click();
  await page.getByTestId("section-veg").click();
  await expect(page.getByTestId("section-flowers")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("section-veg")).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/signup-sections.png`, fullPage: true });

  const email = `rowan.${Date.now()}@example.com`;
  await page.getByLabel("Your name").fill("Rowan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("flower-bed-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("check-inbox")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/check-inbox.png`, fullPage: true });

  await page.getByRole("button", { name: "Send the link again" }).click();
  await expect(page.getByText("Another link is on its way.")).toBeVisible();

  const inbox = await fetch(`${mock}/__test/inbox?email=${encodeURIComponent(email)}`);
  const { code } = (await inbox.json()) as { code: string };
  expect(code).toBeTruthy();
  await page.goto(`/auth/callback?code=${code}`);
  await expect(page.getByTestId("flowers-shell")).toBeVisible();
  await expect(page.getByText("No farm yet")).toBeVisible();
  await expect(page.getByTestId("section-switch")).toBeVisible();
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/flowers-home.png`, fullPage: true });

  await page.getByRole("link", { name: "Veg" }).click();
  await expect(page.getByTestId("veg-home")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veg section coming soon" })).toBeVisible();
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${artifacts}/veg-home.png`, fullPage: true });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("flower-bed-2026");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("flowers-shell")).toBeVisible();

  await page.goto("/veg");
  await expect(page.getByTestId("veg-home")).toBeVisible();
  expect(hydration).toEqual([]);
});
