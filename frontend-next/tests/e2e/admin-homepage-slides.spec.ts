import { expect, test } from "@playwright/test";

async function loginAdmin(page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

test.describe("Admin Homepage Slides CRUD and Layout", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginAdmin(page);
  });

  test("admin can view, create, edit, toggle active, preview, and reorder homepage slides without document overflow", async ({ page }) => {
    const stamp = Date.now();
    const titleEn = `E2E Test Slide EN ${stamp}`;
    const titleRu = `E2E Тест Слайд RU ${stamp}`;
    const modifiedTitleEn = `E2E Test Slide EN Modified ${stamp}`;

    // 1. Go to homepage slides manager
    await page.goto("/admin/homepage-slides");
    await expect(page.getByTestId("admin-homepage-slides-page")).toBeVisible();

    // Verify layout has no horizontal overflow on desktop
    const hasOverflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflowDesktop).toBeFalsy();

    // 2. Open Add Slide Modal
    await page.getByTestId("add-slide-btn").click();
    await expect(page.getByTestId("slide-form-modal")).toBeVisible();

    // 3. Fill in slide details
    await page.getByTestId("input-desktop-url").fill("http://localhost:3000/demo/demo-product-3.svg");
    await page.getByTestId("input-title-en").fill(titleEn);
    await page.getByTestId("input-title-ru").fill(titleRu);
    await page.getByTestId("input-subtitle-en").fill("Premium marketplace demo");
    await page.getByTestId("input-subtitle-ru").fill("Премиум демо маркетплейса");
    await page.getByTestId("input-cta-label-en").fill("Shop Collection");
    await page.getByTestId("input-cta-label-ru").fill("Купить коллекцию");
    await page.getByTestId("input-cta-url").fill("/products?category=sets");
    await page.getByTestId("input-bg-color").fill("#0f172a");
    await page.getByTestId("input-is-active").check();

    // 4. Save Slide
    await page.getByTestId("save-slide-btn").click();
    await expect(page.getByText("Slide created successfully.")).toBeVisible();
    await expect(page.getByTestId("slide-form-modal")).not.toBeVisible();

    // Verify slide title appears in the list
    await expect(page.getByText(titleEn, { exact: true })).toBeVisible();

    // 5. Edit Slide
    // We edit the slide containing exactly titleEn
    const editBtn = page.getByTestId("slide-row")
      .filter({ has: page.getByText(titleEn, { exact: true }) })
      .getByTestId(/^slide-edit-/)
      .first();
    await editBtn.click();
    await expect(page.getByTestId("slide-form-modal")).toBeVisible();

    await page.getByTestId("input-title-en").fill(modifiedTitleEn);
    await page.getByTestId("save-slide-btn").click();
    await expect(page.getByText("Slide updated successfully.")).toBeVisible();
    await expect(page.getByText(modifiedTitleEn, { exact: true })).toBeVisible();

    // 6. Preview Slide
    const previewBtn = page.getByTestId("slide-row")
      .filter({ has: page.getByText(modifiedTitleEn, { exact: true }) })
      .getByTestId(/^slide-preview-/)
      .first();
    await previewBtn.click();
    await expect(page.getByTestId("slide-preview-modal")).toBeVisible();

    // Close preview modal
    await page.locator('[aria-label="Close preview"]').click();
    await expect(page.getByTestId("slide-preview-modal")).not.toBeVisible();

    // 7. Toggle Active Status
    const toggleBtn = page.getByTestId("slide-row")
      .filter({ has: page.getByText(modifiedTitleEn, { exact: true }) })
      .getByTestId(/^slide-toggle-active-/)
      .first();
    const currentStatusText = await toggleBtn.innerText();
    await toggleBtn.click();
    await expect(page.getByText("Toggle active status success.")).toBeVisible();
    const nextStatusText = await toggleBtn.innerText();
    expect(currentStatusText).not.toBe(nextStatusText);

    // 8. Reorder Slides
    const moveDownBtn = page.getByTestId("slide-row").first().getByTestId(/^slide-move-down-/).first();
    if (await moveDownBtn.isEnabled()) {
      await moveDownBtn.click();
      await expect(page.getByText("Reordered slides success.")).toBeVisible();
    }

    // 9. Resize viewport to mobile and check menu / overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const hasOverflowMobile = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflowMobile).toBeFalsy();

    // Cleanup by deleting the created slide
    await page.setViewportSize({ width: 1280, height: 800 });
    const deleteBtn = page.getByTestId("slide-row")
      .filter({ has: page.getByText(modifiedTitleEn, { exact: true }) })
      .getByTestId(/^slide-delete-/)
      .first();
    
    // Accept dialog handler for delete confirm
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();
    await expect(page.getByText("Slide deleted successfully.")).toBeVisible();
    await expect(page.getByText(modifiedTitleEn, { exact: true })).not.toBeVisible();
  });
});
