import { expect, test, type Page } from "@playwright/test";

async function expectOverlayProbe(page: Page, panelTestId: string) {
  const panel = page.getByTestId(panelTestId);
  await expect(panel).toBeVisible();

  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();

  if (!panelBox) {
    return panel;
  }

  const probe = await page.evaluate(({ x, y, panelTestId: currentPanelTestId }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tagName: element?.tagName ?? null,
      testId: element?.getAttribute("data-testid") ?? null,
      insidePanel: Boolean(element?.closest(`[data-testid='${currentPanelTestId}']`)),
    };
  }, {
    x: Math.round(panelBox.x + panelBox.width / 2),
    y: Math.round(panelBox.y + Math.min(panelBox.height - 12, 120)),
    panelTestId,
  });

  expect(probe.insidePanel).toBeTruthy();
  return panel;
}

test("catalog filter dropdown stays above the product grid", async ({ page }) => {
  await page.goto("/products?q=%D0%A8%D0%BE%D1%80%D1%82%D1%8B");

  const sortTrigger = page.getByTestId("catalog-filter-sort-trigger");
  await expect(sortTrigger).toBeVisible();
  await sortTrigger.click();
  await expectOverlayProbe(page, "catalog-filter-sort-panel");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("catalog-filter-sort-panel")).toBeHidden();

  const colorTrigger = page.getByTestId("catalog-filter-color-trigger");
  await expect(colorTrigger).toBeVisible();
  await colorTrigger.click();
  const colorPanel = await expectOverlayProbe(page, "catalog-filter-color-panel");

  const categoryTrigger = page.getByTestId("catalog-filter-category-trigger");
  await expect(categoryTrigger).toBeVisible();
  await categoryTrigger.click();
  await expectOverlayProbe(page, "catalog-filter-category-panel");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("catalog-filter-category-panel")).toBeHidden();

  await colorTrigger.click();
  await expectOverlayProbe(page, "catalog-filter-color-panel");

  await page.keyboard.press("Escape");
  await expect(colorPanel).toBeHidden();

  await colorTrigger.click();
  await expect(colorPanel).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(colorPanel).toBeHidden();
});
