import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
let cachedAdminToken: string | null = null;

type AdminCategoryOption = {
  id: string;
  name: string;
  slug: string | null;
  productCount: number;
};

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  const response = await request.fetch(`${backendBaseUrl}${url}`, options);
  expect(
    response.ok(),
    `${options?.method ?? "GET"} ${url} -> ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

async function getAdminCategories(
  request: APIRequestContext,
  adminToken: string,
) {
  return backendJson<AdminCategoryOption[]>(
    request,
    "/api/admin/categories",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
}

function findCategoryIdByName(
  categories: AdminCategoryOption[],
  expectedName: string,
) {
  const match = categories.find(
    (category) => category.name.toLowerCase() === expectedName.toLowerCase(),
  );
  expect(match, `Category ${expectedName} should exist in admin categories`).toBeTruthy();
  return match!.id;
}

async function loginAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

async function approveSeller(request: APIRequestContext, email: string) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName: "AI Try-On Seller",
        role: "SELLER",
      },
    },
  );
  const sellerLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: { email, password },
    },
  );
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "AI Try-On Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Try On 1",
      contactName: "AI Try-On Seller",
      contactPhone: "+79990000010",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(
    request,
    "/api/seller/onboarding/documents",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
      multipart: {
        documentType: "INN",
        file: {
          name: "seller-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% ai try on e2e\n"),
        },
      },
    },
  );
  if (!cachedAdminToken) {
    const adminLogin = await backendJson<{ accessToken: string }>(
      request,
      "/api/auth/login",
      {
        method: "POST",
        data: {
          email: "demo-admin@trawberry.local",
          password: "DemoAdmin123!",
        },
      },
    );
    cachedAdminToken = adminLogin.accessToken;
  }
  await backendJson(
    request,
    `/api/admin/sellers/${register.userId}/documents/${document.id}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${cachedAdminToken}` },
      data: {},
    },
  );
  await backendJson(request, `/api/admin/sellers/${register.userId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cachedAdminToken}` },
    data: {},
  });

  return { token: sellerLogin.accessToken, adminToken: cachedAdminToken };
}

async function createProduct(
  request: APIRequestContext,
  token: string,
  stamp: number,
  options?: {
    title?: string;
    categoryName?: string;
  },
) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      name: `AI Try-On Shop ${stamp}`,
      slug: `ai-try-on-shop-${stamp}`,
      paymentInstructions: "Manual transfer for AI Try-On tests",
    },
  });
  const wbNmId = 7600000 + (stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: options?.title ?? `AI Try-On Jacket ${stamp}`,
      localTitle: options?.title ?? `AI Try-On Jacket ${stamp}`,
      localDescription: "AI try-on public product",
      categoryName: options?.categoryName ?? "jackets",
      visibility: "ACTIVE",
      aiTryOnEnabled: true,
      variants: [
        {
          chrtId: wbNmId + 10,
          techSize: "M",
          wbSize: "46",
          basePrice: 1890,
          stockQuantity: 5,
          trackInventory: true,
          isActive: true,
        },
        {
          chrtId: wbNmId + 20,
          techSize: "L",
          wbSize: "48",
          basePrice: 1920,
          stockQuantity: 3,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    multipart: {
      files: {
        name: `ai-try-on-product-${stamp}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return product;
}

async function fillTryOnForm(page: Page, modelId = "model-3") {
  await page.getByTestId("ai-try-on-height").fill("172");
  await page.getByTestId("ai-try-on-weight").fill("70");
  await page.getByTestId("ai-try-on-gender").selectOption("female");
  await page.getByTestId("ai-try-on-body-type").selectOption("regular");
  await page.getByTestId("ai-try-on-trait-wide_shoulders").click();
  await page.getByTestId("ai-try-on-source-model").click();
  await page.getByTestId(`ai-try-on-model-${modelId}`).click();
  await page.getByTestId("ai-try-on-consent").check();
}

test("AI Try-On mock flow works from disabled state to completed result", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const seller = await approveSeller(request, `ai-try-on-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp);

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: false,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: [],
    },
  });

  await page.goto(`/products/${product.id}`);
  await expect(page.getByTestId("product-ai-try-on-button")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("toast-warning").first()).toContainText(
    /AI try-on is currently under development\.|Режим AI-примерки находится в разработке\./,
  );

  await loginAdmin(page);
  await page.goto("/admin/ai-settings");
  await expect(page.getByTestId("admin-ai-settings-page")).toContainText("Marketplace AI try-on");
  const categories = await getAdminCategories(request, seller.adminToken);
  const jacketCategoryId = findCategoryIdByName(categories, "jackets");
  await page.getByTestId("admin-ai-settings-enabled").check();
  await page.getByTestId("admin-ai-settings-provider-mode").selectOption("mock");
  await page.getByTestId("admin-ai-settings-guest-limit").fill("3");
  await page.getByTestId("admin-ai-settings-customer-limit").fill("5");
  await page.getByTestId(`admin-ai-settings-supported-category-${jacketCategoryId}`).check();
  await page.getByTestId("admin-ai-settings-save").click();
  await expect(page.getByTestId("admin-ai-settings-success")).toContainText("AI settings saved.");

  await page.goto(`/products/${product.id}`);
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("toast-warning").first()).toContainText(
    /Please select a size first\.|Сначала выберите размер\./,
  );

  await page.getByTestId(`product-size-${product.variants[1].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();
  await page.getByTestId("ai-try-on-source-model").click();
  await expect(page.locator('[data-testid^="ai-try-on-model-"]')).toHaveCount(10);
  await expect(page.getByTestId("ai-try-on-model-model-1")).toBeVisible();
  await expect(page.getByTestId("ai-try-on-model-model-10")).toBeVisible();

  await fillTryOnForm(page);
  await page.getByTestId("ai-try-on-generate").click();

  await expect(page.getByTestId("ai-try-on-loading")).toContainText(
    /Creating your AI try-on|Создаём AI-примерку/,
  );
  await expect(page.getByTestId("ai-try-on-result-image")).toBeVisible();
  await expect(page.getByTestId("ai-try-on-suggested-size")).toContainText(/RU|M|L/);
});

test("AI Try-On demo flow works on mobile viewport without overflow", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });

  const stamp = Date.now() + 11;
  const seller = await approveSeller(request, `ai-try-on-mobile-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp);
  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "demo",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: [],
    },
  });

  await page.goto(`/products/${product.id}`);
  await page.getByTestId(`product-size-${product.variants[1].id}`).click();
  await page.getByTestId("mobile-product-ai-try-on").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  expect(hasOverflow).toBeFalsy();
});

test("AI Try-On openai mode surfaces provider configuration errors without exposing keys", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now() + 22;
  const seller = await approveSeller(request, `ai-try-on-openai-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp);

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "openai",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["jackets"],
    },
  });

  const adminSettings = await backendJson<Record<string, unknown>>(
    request,
    "/api/admin/ai-settings",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${seller.adminToken}` },
    },
  );
  expect(adminSettings.providerMode).toBe("openai");
  expect(adminSettings).not.toHaveProperty("openaiApiKey");
  expect(JSON.stringify(adminSettings)).not.toContain("sk-");
  const providerConfigured = adminSettings.providerConfigured === true;
  if (providerConfigured) {
    return;
  }

  await page.goto(`/products/${product.id}`);
  await page.getByTestId(`product-size-${product.variants[0].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();

  await fillTryOnForm(page);
  await page.getByTestId("ai-try-on-generate").click();

  await expect(page.getByTestId("ai-try-on-error")).toContainText(
    /AI provider is not configured\.|Провайдер ИИ не настроен\./,
  );
});

test("Admin AI settings category selector parses legacy values and saves category ids", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now() + 33;
  const seller = await approveSeller(request, `ai-try-on-admin-${stamp}@example.com`);
  await createProduct(request, seller.token, stamp + 1, { categoryName: "Jackets" });
  await createProduct(request, seller.token, stamp + 2, { categoryName: "Dresses" });
  await createProduct(request, seller.token, stamp + 3, { categoryName: "Pants" });

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["jackets", "dresses", "pants"],
    },
  });

  const categories = await getAdminCategories(request, seller.adminToken);
  const jacketCategoryId = findCategoryIdByName(categories, "Jackets");
  const dressesCategoryId = findCategoryIdByName(categories, "Dresses");
  const pantsCategoryId = findCategoryIdByName(categories, "Pants");

  await loginAdmin(page);
  await page.goto("/admin/ai-settings");
  await expect(page.getByTestId(`admin-ai-settings-supported-category-${jacketCategoryId}`)).toBeChecked();
  await expect(page.getByTestId(`admin-ai-settings-supported-category-${dressesCategoryId}`)).toBeChecked();
  await expect(page.getByTestId(`admin-ai-settings-supported-category-${pantsCategoryId}`)).toBeChecked();

  await page.getByTestId("admin-ai-settings-clear-all").click();
  await page.getByTestId("admin-ai-settings-select-recommended").click();
  await page.getByTestId("admin-ai-settings-save").click();
  await expect(page.getByTestId("admin-ai-settings-success")).toContainText("AI settings saved.");

  const updated = await backendJson<{ supportedCategories: string[] }>(
    request,
    "/api/admin/ai-settings",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${seller.adminToken}` },
    },
  );
  expect(updated.supportedCategories).toEqual(
    expect.arrayContaining([
      jacketCategoryId,
      dressesCategoryId,
      pantsCategoryId,
    ]),
  );
});

test("RU AI try-on keeps unsupported messaging localized and supports bermuda aliases", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now() + 44;
  const seller = await approveSeller(request, `ai-try-on-ru-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp, {
    title: "Шорты джинсовые бермуды",
    categoryName: "Шорты джинсовые бермуды",
  });

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["jackets"],
    },
  });

  await page.goto(`/products/${product.id}`);
  await page.getByTestId(`product-size-${product.variants[0].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();
  await fillTryOnForm(page);
  await page.getByTestId("ai-try-on-generate").click();
  await expect(page.getByTestId("ai-try-on-error")).toContainText("AI-примерка пока недоступна для этого товара.");

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["bermuda"],
    },
  });

  await page.reload();
  await page.getByTestId(`product-size-${product.variants[0].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();
  await fillTryOnForm(page);
  await page.getByTestId("ai-try-on-generate").click();
  await expect(page.getByTestId("ai-try-on-result-image")).toBeVisible();
});

test("AI Try-On photo upload preview and model switching UI flow works correctly", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now() + 55;
  const seller = await approveSeller(request, `ai-try-on-ui-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp);

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["jackets"],
    },
  });

  await page.goto(`/products/${product.id}`);
  await page.getByTestId(`product-size-${product.variants[0].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();
  await expect(page.getByText("Step 3: Choose your reference")).toBeVisible();
  await expect(
    page.getByText("Choose one option: your photo or a demo model."),
  ).toBeVisible();

  // 1. Verify body form and model cards are visible
  await page.getByTestId("ai-try-on-height").fill("165");
  await page.getByTestId("ai-try-on-weight").fill("55");
  await page.getByTestId("ai-try-on-gender").selectOption("female");
  await page.getByTestId("ai-try-on-body-type").selectOption("regular");
  await page.getByTestId("ai-try-on-consent").check();

  await expect(page.getByTestId("ai-try-on-generate")).toBeDisabled();
  await expect(page.getByText("Choose one option: upload your own photo or select a demo model.")).toBeVisible();

  // 2. Built-in model only should be allowed
  await page.getByTestId("ai-try-on-source-model").click();
  const model1Card = page.getByTestId("ai-try-on-model-model-1");
  await expect(model1Card).toBeVisible();
  await model1Card.click();
  await expect(page.getByTestId("ai-try-on-generate")).toBeEnabled();
  await expect(page.getByText(/Female, petite, 155 cm|Женщина, миниатюрная, 155 см/)).toBeVisible();
  await expect(page.getByTestId("ai-try-on-error")).toHaveCount(0);

  // 3. Upload photo clears the selected model
  await page.getByTestId("ai-try-on-source-photo").click();
  const uploadInput = page.getByTestId("ai-try-on-upload-input");
  await expect(uploadInput).toBeVisible();
  await uploadInput.setInputFiles({
    name: "test-person.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByText("Your uploaded photo will be used instead of the demo model.")).toBeVisible();

  // 4. Verify preview is visible and summary no longer shows old model
  const uploadPreview = page.getByTestId("ai-try-on-upload-preview");
  await expect(uploadPreview).toBeVisible();
  await expect(page.getByText("Your uploaded photo")).toBeVisible();

  // 5. Selecting a model again clears the uploaded preview
  await page.getByTestId("ai-try-on-source-model").click();
  const model2Card = page.getByTestId("ai-try-on-model-model-2");
  await model2Card.click();
  await expect(page.getByText("The demo model will be used instead of your uploaded photo.")).toBeVisible();
  await expect(uploadPreview).toHaveCount(0);
  await expect(page.getByTestId("ai-try-on-generate")).toBeEnabled();

  // 6. Generate try-on
  await page.getByTestId("ai-try-on-generate").click();
  await expect(page.getByTestId("ai-try-on-loading")).toBeVisible();
  await expect(page.getByTestId("ai-try-on-result-image")).toBeVisible({ timeout: 25000 });
});

test("RU AI Try-On reference selection messages stay localized", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now() + 66;
  const seller = await approveSeller(request, `ai-try-on-ru-reference-${stamp}@example.com`);
  const product = await createProduct(request, seller.token, stamp);

  await backendJson(request, "/api/admin/ai-settings", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.adminToken}` },
    data: {
      enabled: true,
      providerMode: "mock",
      guestDailyLimit: 3,
      customerDailyLimit: 5,
      requireConsent: true,
      supportedCategories: ["jackets"],
    },
  });

  await page.goto("/products");
  await page.getByTestId("language-switcher-trigger").click();
  await page.getByTestId("language-option-ru").click();
  await page.goto(`/products/${product.id}`);
  await page.getByTestId(`product-size-${product.variants[0].id}`).click();
  await page.getByTestId("product-ai-try-on-button").click();
  await expect(page.getByTestId("ai-try-on-modal")).toBeVisible();
  await expect(
    page.getByText("Шаг 3: Выберите источник для примерки"),
  ).toBeVisible();
  await expect(
    page.getByText("Выберите один вариант: своё фото или демонстрационная модель."),
  ).toBeVisible();
  await page.getByTestId("ai-try-on-consent").check();
  await expect(
    page.getByText(
      "Выберите один вариант: загрузите своё фото или выберите демонстрационную модель.",
    ),
  ).toBeVisible();
  await expect(page.locator("text=The uploaded image is not suitable for try-on.")).toHaveCount(0);
});
