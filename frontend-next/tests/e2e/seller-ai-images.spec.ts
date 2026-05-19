import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function loginSeller(request: APIRequestContext, email: string, password: string) {
  const sellerLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: { email, password },
  });
  expect(sellerLoginResponse.ok()).toBeTruthy();
  const sellerLogin = (await sellerLoginResponse.json()) as { accessToken: string };
  return sellerLogin.accessToken;
}

test("seller creates and attaches AI images from the dedicated seller AI page", async ({ page, request }) => {
  test.setTimeout(120000);

  const stamp = Date.now();
  const sellerEmail = "demo-seller@trawberry.local";
  const password = "DemoSeller123!";
  const shopName = `AI Shop ${stamp}`;
  const shopSlug = `ai-shop-${stamp}`;
  const productName = `AI Product ${stamp}`;

  const sellerToken = await loginSeller(request, sellerEmail, password);

  const shopResponse = await request.post(`${backendBaseUrl}/api/shops`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      name: shopName,
      slug: shopSlug,
    },
  });
  expect(shopResponse.ok()).toBeTruthy();
  const shop = (await shopResponse.json()) as { id: string };

  const productResponse = await request.post(`${backendBaseUrl}/api/shops/${shop.id}/products`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      wbNmId: 7000000 + (stamp % 100000),
      wbTitle: productName,
      localTitle: productName,
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: 8000000 + (stamp % 100000),
          basePrice: 199,
          stockQuantity: 5,
        },
      ],
    },
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = (await productResponse.json()) as { id: string };

  const uploadResponse = await request.post(`${backendBaseUrl}/api/shops/${shop.id}/products/${product.id}/images`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    multipart: {
      imageType: "FRONT",
      files: {
        name: "ai-product.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  await page.goto("/seller/login");
  await expect(page.getByTestId("seller-login-email")).toBeVisible();
  await page.getByTestId("seller-login-email").fill(sellerEmail);
  await page.getByTestId("seller-login-password").fill(password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");
  await page.locator("select").first().selectOption(shop.id);

  await page.goto("/seller/ai-images");
  await expect(page.getByTestId("seller-ai-images-page")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-badge")).toBeVisible();
  await expect(page.getByTestId("ai-runtime-badge")).toContainText("AI service mock mode");

  await page.getByTestId("seller-ai-product-search").fill(productName);
  const selectedCard = page.getByTestId("seller-ai-product-selected").filter({ hasText: productName });
  if ((await selectedCard.count()) === 0) {
    await page.getByTestId("seller-ai-product-option").filter({ hasText: productName }).first().click();
  }
  await expect(page.getByTestId("seller-ai-product-selected")).toContainText(productName);

  await page.getByTestId("seller-ai-prompt").fill(
    "Create a clean seller-facing mock-safe studio image for this marketplace product without changing the item.",
  );
  await page.getByTestId("seller-ai-generate-submit").click();

  await expect(page.getByText(/AI task .* created/)).toBeVisible();
  await expect(page.getByTestId("seller-ai-task-selected")).toContainText("COMPLETED", { timeout: 30000 });
  await expect(page.getByRole("button", { name: "Attach to product" }).first()).toBeVisible();
  await expect(page.getByTestId("seller-ai-tryon-card")).toHaveText(/Backend not ready for end-to-end try-on/);
  await expect(page.locator("[data-testid='seller-ai-tryon-card'] button")).toHaveCount(0);

  await page.getByRole("button", { name: "Attach to product" }).first().click();
  await expect(page.getByText("AI image attached to the product gallery.")).toBeVisible();

  await page.goto(`/seller/products/${product.id}/images`);
  await expect(page.getByTestId("seller-product-images-page")).toBeVisible();
  await expect(page.locator("article[data-testid='product-image-card'] span").filter({ hasText: "AI_GENERATED" }).first()).toBeVisible();
});
