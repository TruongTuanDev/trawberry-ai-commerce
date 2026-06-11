import { expect, test, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function chooseCustomerLocale(page: Page, locale: "ru" | "en" | "vi") {
  await page.getByTestId("language-switcher-customer").first().click();
  await expect(page.getByTestId(`locale-flag-${locale}`)).toBeVisible();
  await page.getByTestId(`language-option-customer-${locale}`).first().click();
}

async function getAdminToken(request) {
  const adminLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
  expect(adminLoginResponse.ok()).toBeTruthy();
  const adminLogin = await adminLoginResponse.json();
  return adminLogin.accessToken;
}

test.describe("Public Homepage Banner Slider", () => {
  test.beforeEach(async ({ context }) => {
    test.setTimeout(90000);
    await context.clearCookies();
  });

  test("homepage shows slider, supports EN/RU translation, navigation, responsive images, CTA, and falls back gracefully", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    const slider = page.getByTestId("public-homepage-slider");
    await expect(slider).toBeVisible();

    const hasOverflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflowDesktop).toBeFalsy();

    const prevBtn = page.getByTestId("slider-prev-btn");
    const nextBtn = page.getByTestId("slider-next-btn");
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    await expect(page.getByTestId("slider-dot-0")).toBeVisible();

    await expect(page.getByTestId("slide-item-0")).toBeVisible();

    const desktopImg = page.getByTestId("slide-desktop-image-0");
    await expect(desktopImg).toBeVisible();

    const ctaLink = page.getByTestId("slide-cta-link-0");
    await expect(ctaLink).toBeVisible();
    const href = await ctaLink.getAttribute("href");
    expect(href).toContain("/products?category=dresses");

    await chooseCustomerLocale(page, "en");
    await page.waitForTimeout(500);

    await expect(page.getByTestId("slide-item-0")).toBeVisible();

    await page.getByTestId("language-switcher-customer").first().click();
    const viOption = page.getByTestId("language-option-customer-vi");
    await expect(viOption).toBeVisible();
    await page.keyboard.press("Escape");

    await nextBtn.click();
    const slideHeading = page
      .getByTestId("slide-item-1")
      .getByRole("heading", { name: "New Arrivals", exact: true });
    await expect(slideHeading).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const mobileImg = page.getByTestId("slide-mobile-image-1");
    await expect(mobileImg).toBeVisible();

    const overflowElements = await page.evaluate(() => {
      const els = [];
      const clientWidth = document.documentElement.clientWidth;
      const all = document.getElementsByTagName("*");
      for (let i = 0; i < all.length; i++) {
        const rect = all[i].getBoundingClientRect();
        if (rect.right > clientWidth + 2) {
          els.push({
            tagName: all[i].tagName,
            id: all[i].id,
            className: all[i].className,
            width: rect.width,
            right: rect.right,
          });
        }
      }
      return els;
    });
    console.log("Overflowing Elements on Mobile:", JSON.stringify(overflowElements, null, 2));

    const hasOverflowMobile = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflowMobile).toBeFalsy();

    await page.setViewportSize({ width: 1280, height: 800 });

    const token = await getAdminToken(request);
    const listRes = await request.get(`${backendBaseUrl}/api/admin/homepage-slides`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const backedUpSlides = await listRes.json();

    for (const slide of backedUpSlides) {
      const delRes = await request.delete(`${backendBaseUrl}/api/admin/homepage-slides/${slide.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(delRes.ok()).toBeTruthy();
    }

    try {
      await page.goto("/");

      const fallbackBanner = page.getByTestId("hero-slider-fallback");
      await expect(fallbackBanner).toBeVisible();

      await chooseCustomerLocale(page, "ru");
      await page.waitForTimeout(500);
      await expect(fallbackBanner).toBeVisible();
      await expect(page.getByTestId("public-homepage-slider")).toHaveCount(0);
      await expect(fallbackBanner.getByRole("link")).toHaveAttribute("href", "/products");

      await chooseCustomerLocale(page, "en");
      await page.waitForTimeout(500);
      await expect(fallbackBanner).toBeVisible();
      await expect(page.getByTestId("public-homepage-slider")).toHaveCount(0);
    } finally {
      for (const slide of backedUpSlides) {
        const slideInput = { ...slide };
        delete slideInput.id;
        delete slideInput.createdAt;
        delete slideInput.updatedAt;
        await request.post(`${backendBaseUrl}/api/admin/homepage-slides`, {
          headers: { Authorization: `Bearer ${token}` },
          data: slideInput,
        });
      }
    }
  });

  test("mobile navigation to product detail and back keeps the admin banner active", async ({
    browser,
  }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();

    try {
      await mobilePage.goto("/");
      await expect(mobilePage.getByTestId("public-homepage-slider")).toBeVisible();
      await expect(mobilePage.getByTestId("hero-slider-fallback")).toHaveCount(0);

      const firstProductLink = mobilePage
        .locator('[data-testid="product-card"] a[href^="/products/"]')
        .first();
      await expect(firstProductLink).toBeVisible();
      await firstProductLink.click();

      await expect(mobilePage.getByTestId("product-detail-title")).toBeVisible();

      await mobilePage.goBack();
      await expect(mobilePage.getByTestId("public-homepage-slider")).toBeVisible();
      await expect(mobilePage.getByTestId("hero-slider-fallback")).toHaveCount(0);
    } finally {
      await mobileContext.close();
    }
  });
});
