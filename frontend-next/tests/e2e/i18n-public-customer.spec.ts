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

test("public customer flow languages: default to RU, only RU/EN, no VI, translates correctly", async ({
  browser,
}) => {
  const page = await newCleanPage(browser);

  // 1. Visit products catalog. Should default to Russian (RU).
  await page.goto("/products");
  
  // Wait for loading to finish
  await page.waitForLoadState("networkidle");
  
  console.log("--- Headings on initial load (RU) ---");
  const h2s = await page.locator("h2").all();
  for (const h of h2s) {
    console.log("Heading text:", await h.innerText());
  }

  // Verify heading / text is Russian
  const heading = page.locator("h2").filter({ hasText: "Все товары" }).first();
  await expect(heading).toBeVisible();

  // 2. Check supported language choices in customer switcher
  const switcher = page.getByTestId("language-switcher-customer");
  await expect(switcher).toBeVisible();

  // Verify only RU and EN exist, and VI does NOT exist
  const ruOption = page.getByTestId("language-option-customer-ru");
  const enOption = page.getByTestId("language-option-customer-en");
  const viOption = page.getByTestId("language-option-customer-vi");

  await expect(ruOption).toBeVisible();
  await expect(enOption).toBeVisible();
  await expect(viOption).toHaveCount(0); // VI should not exist in the DOM for customer role

  // 3. Switch to English (EN)
  console.log("Clicking EN option...");
  await enOption.click();

  // Wait a moment for locale state update to propagate
  await page.waitForTimeout(1000);

  console.log("--- Headings after switching to EN ---");
  const h2sEn = await page.locator("h2").all();
  for (const h of h2sEn) {
    console.log("Heading text:", await h.innerText());
  }

  // Verify the page updates to English
  const englishHeading = page.locator("h2").filter({ hasText: "All products" }).first();
  await expect(englishHeading).toBeVisible();

  // 4. Visit the cart page (empty state)
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  
  // In English, empty cart title should show
  await expect(page.locator("h2").filter({ hasText: "Cart is empty" }).first()).toBeVisible();

  // Switch back to Russian
  await page.getByTestId("language-option-customer-ru").click();
  await page.waitForTimeout(500);
  await expect(page.locator("h2").filter({ hasText: "Корзина пуста" }).first()).toBeVisible();

  // 5. Visit the order tracking page (lookup screen)
  await page.goto("/orders/track");
  await page.waitForLoadState("networkidle");

  // In Russian first
  await expect(page.getByText("Отследить публичный заказ").first()).toBeVisible();

  // Switch to English
  await page.getByTestId("language-option-customer-en").click();
  await page.waitForTimeout(500);
  await expect(page.getByText("Track a public order").first()).toBeVisible();
});
