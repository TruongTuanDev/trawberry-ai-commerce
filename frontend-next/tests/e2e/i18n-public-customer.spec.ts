import { expect, test, type Browser, type Page } from "@playwright/test";

const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

async function newCleanPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: frontendBaseUrl,
  });
  await context.clearCookies();
  const page = await context.newPage();
  page.on("console", (msg) => {
    console.log(`[Browser Console] ${msg.text()}`);
  });
  return page;
}

test("public customer flow languages: default to RU and supports RU/EN/VI", async ({
  browser,
}) => {
  const page = await newCleanPage(browser);

  await page.goto("/products");
  await expect(page.locator("h2").first()).toBeVisible();

  console.log("--- Headings on initial load (RU) ---");
  const h2s = await page.locator("h2").all();
  for (const h of h2s) {
    console.log("Heading text:", await h.innerText());
  }

  await expect(
    page.locator("h2").filter({ hasText: "Все товары" }).first(),
  ).toBeVisible();

  const switcher = page.getByTestId("language-switcher-customer");
  await expect(switcher).toBeVisible();
  await switcher.getByTestId("language-switcher-trigger").click();

  const ruOption = page.getByTestId("language-option-customer-ru");
  const enOption = page.getByTestId("language-option-customer-en");
  const viOption = page.getByTestId("language-option-customer-vi");

  await expect(ruOption).toBeVisible();
  await expect(enOption).toBeVisible();
  await expect(viOption).toBeVisible();

  console.log("Clicking EN option...");
  await enOption.click();
  await page.waitForTimeout(1000);

  console.log("--- Headings after switching to EN ---");
  const h2sEn = await page.locator("h2").all();
  for (const h of h2sEn) {
    console.log("Heading text:", await h.innerText());
  }

  await expect(
    page.locator("h2").filter({ hasText: "All products" }).first(),
  ).toBeVisible();

  await page.goto("/cart");
  await expect(page.locator("h2").first()).toBeVisible();
  await expect(
    page.locator("h2").filter({ hasText: "Cart is empty" }).first(),
  ).toBeVisible();

  await page
    .getByTestId("language-switcher-customer")
    .getByTestId("language-switcher-trigger")
    .click();
  await page.getByTestId("language-option-customer-ru").click();
  await page.waitForTimeout(500);
  await expect(
    page.locator("h2").filter({ hasText: "Корзина пуста" }).first(),
  ).toBeVisible();

  await page.goto("/orders/track");
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(
    page.getByText("Отследить публичный заказ").first(),
  ).toBeVisible();

  await page
    .getByTestId("language-switcher-customer")
    .getByTestId("language-switcher-trigger")
    .click();
  await page.getByTestId("language-option-customer-en").click();
  await page.waitForTimeout(500);
  await expect(
    page.getByText("Track a public order").first(),
  ).toBeVisible();

  await page
    .getByTestId("language-switcher-customer")
    .getByTestId("language-switcher-trigger")
    .click();
  await page.getByTestId("language-option-customer-vi").click();
  await page.goto("/products");
  await expect(
    page.locator("h2").filter({ hasText: "Tất cả sản phẩm" }).first(),
  ).toBeVisible();
});
