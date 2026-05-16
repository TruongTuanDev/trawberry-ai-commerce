import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(request: APIRequestContext, path: string) {
  const response = await request.fetch(`${backendBaseUrl}${path}`);
  expect(response.ok(), `GET ${path} -> ${response.status()}`).toBeTruthy();
  return (await response.json()) as T;
}

test("customer can cart checkout multiple items and track them", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);

  const products = await backendJson<{
    items: Array<{
      id: string;
      shopId: string;
      name: string;
      availableQuantity: number;
    }>;
  }>(request, "/api/public/products?inStock=true&size=12");
  const first = products.items.find((item) => item.availableQuantity >= 2);
  expect(first?.id).toBeTruthy();
  const second = products.items.find(
    (item) => item.shopId === first?.shopId && item.id !== first.id,
  );
  const firstDetail = await backendJson<{
    variants: Array<{ id: string; inStock: boolean }>;
  }>(request, `/api/public/products/${first!.id}`);
  const secondVariant = firstDetail.variants.filter(
    (variant) => variant.inStock,
  )[1];
  expect(
    second?.id || secondVariant?.id,
    "Need two same-shop products or two in-stock variants on one product for cart checkout E2E",
  ).toBeTruthy();

  await page.goto(`/products/${first!.id}`);
  await expect(page.getByRole("heading")).toBeVisible();
  await page.getByTestId("product-quantity-input").fill("1");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByText("Item added to cart.")).toBeVisible();

  if (second) {
    await page.goto(`/products/${second.id}`);
    await page.getByTestId("product-quantity-input").fill("1");
    await page.getByTestId("add-to-cart").click();
  } else {
    await page
      .getByTestId("product-variant-select")
      .selectOption(secondVariant!.id);
    await page.getByTestId("product-quantity-input").fill("1");
    await page.getByTestId("add-to-cart").click();
  }

  await page.goto("/cart");
  await expect(page.getByTestId("cart-items")).toBeVisible();
  await page.getByTestId("cart-quantity-input").first().fill("2");
  await page.getByTestId("cart-checkout").click();

  await page.getByTestId("checkout-full-name").fill("Cart E2E Customer");
  const phone = `+7997${Date.now().toString().slice(-7)}`;
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-email").fill("cart-e2e@example.com");
  await page.getByTestId("checkout-address").fill("Cart E2E Address");
  await page.getByTestId("checkout-note").fill("Cart checkout E2E");
  await expect(
    page.getByTestId("checkout-order-items").locator("article"),
  ).toHaveCount(2);
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await page
    .getByTestId("checkout-confirmation")
    .innerText();
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderId).toBeTruthy();

  await page.getByTestId("confirmation-track-link").click();
  await expect(page.getByTestId("tracked-order-page")).toBeVisible();
  await expect(
    page.locator("section").filter({ hasText: "Items" }).locator("article"),
  ).toHaveCount(2);
});
