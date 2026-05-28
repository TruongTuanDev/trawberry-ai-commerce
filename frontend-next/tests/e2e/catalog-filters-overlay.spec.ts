import { expect, test } from "@playwright/test";

test("catalog filter dropdown stays above the product grid", async ({ page }) => {
  await page.goto("/products?q=%D0%A8%D0%BE%D1%80%D1%82%D1%8B");

  const colorTrigger = page.getByTestId("catalog-filter-color-trigger");
  await expect(colorTrigger).toBeVisible();
  await colorTrigger.click();

  const colorPanel = page.getByTestId("catalog-filter-color-panel");
  await expect(colorPanel).toBeVisible();

  const panelBox = await colorPanel.boundingBox();
  expect(panelBox).not.toBeNull();

  if (panelBox) {
    const probe = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        tagName: element?.tagName ?? null,
        testId: element?.getAttribute("data-testid") ?? null,
        insidePanel: Boolean(element?.closest("[data-testid='catalog-filter-color-panel']")),
      };
    }, {
      x: Math.round(panelBox.x + panelBox.width / 2),
      y: Math.round(panelBox.y + Math.min(panelBox.height - 12, 120)),
    });

    expect(probe.insidePanel).toBeTruthy();
  }

  await page.keyboard.press("Escape");
  await expect(colorPanel).toBeHidden();

  await colorTrigger.click();
  await expect(colorPanel).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(colorPanel).toBeHidden();
});
