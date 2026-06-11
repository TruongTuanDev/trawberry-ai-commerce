import { expect, test, type Browser, type Page } from "@playwright/test";

const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const shop = {
  id: "formela",
  slug: "formela-i18n",
  name: "FORMELA",
  displayName: "FORMELA",
  description: null,
  logoUrl: null,
  bannerUrl: null,
  isVerified: true,
  approvedAt: "2026-05-28T00:00:00.000Z",
  productCount: 0,
  ratingAverage: null,
  ratingCount: 0,
  joinedAt: "2026-05-28T00:00:00.000Z",
  locationLabel: "Moscow",
};

async function openMockedShop(
  browser: Browser,
  locale: "en" | "ru" | "vi",
  viewport: { width: number; height: number },
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: frontendBaseUrl,
    viewport,
  });
  await context.addCookies([
    {
      name: "trawberry-locale",
      value: locale,
      url: frontendBaseUrl,
    },
  ]);
  await context.addInitScript((nextLocale) => {
    window.localStorage.setItem("trawberry-locale", nextLocale);
    window.localStorage.setItem("trawberry-locale:customer", nextLocale);
  }, locale);
  await context.route("**/api/public/shops/formela-i18n", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { shop },
    });
  });
  await context.route("**/api/public/products?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        items: [],
        meta: { page: 1, size: 12, total: 0, totalPages: 0 },
        filters: {
          categories: [],
          brands: [],
          colors: [],
          genders: [],
          priceMin: null,
          priceMax: null,
        },
      },
    });
  });

  const page = await context.newPage();
  await page.goto("/shops/formela-i18n");
  await expect(page.getByTestId("public-shop-header")).toBeVisible();
  return page;
}

async function expectCleanLocalizedPage(page: Page) {
  await expect(page.locator("body")).not.toContainText("????");
  await expect(page.locator("body")).not.toContainText("�");
  await expect(page.locator("body")).not.toContainText("public.shop.");
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(hasOverflow).toBeFalsy();
}

test("public shop buyer copy stays localized and responsive in RU, VI, and EN", async ({
  browser,
}) => {
  const ruDesktop = await openMockedShop(browser, "ru", {
    width: 1440,
    height: 900,
  });
  await expectCleanLocalizedPage(ruDesktop);
  await expect(ruDesktop.getByTestId("public-shop-verified-badge")).toContainText(
    "Проверенный магазин",
  );
  await expect(ruDesktop.getByTestId("public-shop-message-button")).toContainText(
    "Написать магазину",
  );
  await expect(ruDesktop.getByTestId("public-shop-products-section")).toContainText(
    "Товары магазина FORMELA",
  );
  await expect(ruDesktop.getByTestId("public-shop-sort")).toHaveValue("newest");
  await expect(ruDesktop.getByTestId("public-shop-sort")).toContainText("Новинки");
  await expect(ruDesktop.getByTestId("public-shop-header")).toContainText("мая 2026");
  await ruDesktop.context().close();

  const ruMobile = await openMockedShop(browser, "ru", {
    width: 390,
    height: 844,
  });
  await expectCleanLocalizedPage(ruMobile);
  await expect(ruMobile.getByTestId("public-shop-header")).toContainText("FORMELA");
  await ruMobile.context().close();

  const viTablet = await openMockedShop(browser, "vi", {
    width: 768,
    height: 1024,
  });
  await expectCleanLocalizedPage(viTablet);
  await expect(viTablet.getByTestId("public-shop-verified-badge")).toContainText(
    "Cửa hàng đã xác minh",
  );
  await expect(viTablet.getByTestId("public-shop-message-button")).toContainText(
    "Nhắn tin cho cửa hàng",
  );
  await expect(viTablet.getByTestId("public-shop-products-section")).toContainText(
    "Sản phẩm từ FORMELA",
  );
  await expect(viTablet.getByTestId("public-shop-sort")).toContainText("Mới nhất");
  await expect(viTablet.getByTestId("public-shop-header")).toContainText("tháng 5");
  await viTablet.context().close();

  const enDesktop = await openMockedShop(browser, "en", {
    width: 1440,
    height: 900,
  });
  await expectCleanLocalizedPage(enDesktop);
  await expect(enDesktop.getByTestId("public-shop-verified-badge")).toContainText(
    "Verified shop",
  );
  await expect(enDesktop.getByTestId("public-shop-message-button")).toContainText(
    "Message shop",
  );
  await expect(enDesktop.getByTestId("public-shop-products-section")).toContainText(
    "Products from FORMELA",
  );
  await expect(enDesktop.getByTestId("public-shop-header")).not.toContainText(" ? ");
  await enDesktop.context().close();
});
