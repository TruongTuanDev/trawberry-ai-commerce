import { expect, test, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function chooseCustomerLocale(page: Page, locale: "ru" | "en") {
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

  test("homepage shows slider, supports EN/RU translation, navigation, responsive images, CTA, and falls back gracefully", async ({ page, request }) => {
    // 1. Visit homepage (should default to RU)
    await page.goto("/");

    // 2. Slider element should be visible
    const slider = page.getByTestId("public-homepage-slider");
    await expect(slider).toBeVisible();

    // Verify there is no document horizontal overflow on desktop
    const hasOverflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflowDesktop).toBeFalsy();

    // 3. Navigation controls should exist
    const prevBtn = page.getByTestId("slider-prev-btn");
    const nextBtn = page.getByTestId("slider-next-btn");
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Verify dots indicator exist
    await expect(page.getByTestId("slider-dot-0")).toBeVisible();

    // 4. Slide content should load. The seed has "Распродажа платьев" in RU.
    await expect(page.getByTestId("slide-item-0").getByRole("heading", { name: "Распродажа платьев" })).toBeVisible();
    
    // Check that desktop image visual is visible
    const desktopImg = page.getByTestId("slide-desktop-image-0");
    await expect(desktopImg).toBeVisible();

    // Check CTA link exists and has the correct seeded URL
    const ctaLink = page.getByTestId("slide-cta-link-0");
    await expect(ctaLink).toBeVisible();
    const href = await ctaLink.getAttribute("href");
    expect(href).toContain("/products?category=dresses");

    // 5. Test switching language to English
    await chooseCustomerLocale(page, "en");
    await page.waitForTimeout(500);

    // Ru text should be gone, En text should appear: "Summer Dresses Sale"
    await expect(page.getByTestId("slide-item-0").getByRole("heading", { name: "Summer Dresses Sale" })).toBeVisible();
    await expect(page.getByTestId("slide-item-0").getByRole("heading", { name: "Распродажа платьев" })).not.toBeVisible();

    // Ensure Vietnamese is not exposed in the selector
    await page.getByTestId("language-switcher-customer").first().click();
    const viOption = page.getByTestId("language-option-customer-vi");
    await expect(viOption).toHaveCount(0); // No VI option
    // Close switcher dropdown
    await page.keyboard.press("Escape");

    // 6. Test slide navigation (clicking next)
    // The second slide has title "New Arrivals" in EN.
    await nextBtn.click();
    // Use exact role/heading locator to prevent strict mode violation on footer link "New arrivals"
    const slideHeading = page.getByTestId("slide-item-1").getByRole("heading", { name: "New Arrivals", exact: true });
    await expect(slideHeading).toBeVisible();

    // 7. Verify responsive layout on mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // Mobile image visual should be visible, and there should be no document horizontal overflow
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

    // Restore viewport size
    await page.setViewportSize({ width: 1280, height: 800 });

    // ========================================================
    // 8. FALLBACK TEST (sequential execution)
    // ========================================================
    const token = await getAdminToken(request);

    // Fetch existing slides to back them up
    const listRes = await request.get(`${backendBaseUrl}/api/admin/homepage-slides`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const backedUpSlides = await listRes.json();

    // Delete all slides
    for (const slide of backedUpSlides) {
      const delRes = await request.delete(`${backendBaseUrl}/api/admin/homepage-slides/${slide.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(delRes.ok()).toBeTruthy();
    }

    try {
      // Reload homepage
      await page.goto("/");

      // Homepage should load safely and show the fallback banner
      const fallbackBanner = page.getByTestId("hero-slider-fallback");
      await expect(fallbackBanner).toBeVisible();

      // Explicitly switch back to RU to assert RU translation
      await chooseCustomerLocale(page, "ru");
      await page.waitForTimeout(500);

      // Fallback banner should show RU translation
      await expect(page.getByText("Находите скидки и новинки в одном месте")).toBeVisible();

      // Switch to English and check
      await chooseCustomerLocale(page, "en");
      await page.waitForTimeout(500);
      await expect(page.getByText("Find deals and new arrivals in one place")).toBeVisible();
      await expect(page.getByText("Находите скидки и новинки в одном месте")).not.toBeVisible();
    } finally {
      // Restore slides to avoid breaking other tests/runs
      for (const slide of backedUpSlides) {
        // Strip out read-only fields
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
});
