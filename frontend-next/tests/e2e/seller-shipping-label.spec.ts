import fs from "fs";
import path from "path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

const enDict = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src/i18n/dictionaries/en.json"),
    "utf-8",
  ),
);
const ruDict = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src/i18n/dictionaries/ru.json"),
    "utf-8",
  ),
);
const viDict = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../src/i18n/dictionaries/vi.json"),
    "utf-8",
  ),
);

async function backendJson<T>(
  request: APIRequestContext,
  pathName: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH";
    token?: string;
    data?: unknown;
    multipart?: Record<
      string,
      string | { name: string; mimeType: string; buffer: Buffer }
    >;
  } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${pathName}`, {
    method: options.method ?? "GET",
    headers: options.token
      ? { Authorization: `Bearer ${options.token}`, Cookie: "" }
      : undefined,
    data: options.data,
    multipart: options.multipart,
  });

  expect(
    response.ok(),
    `${options.method ?? "GET"} ${pathName} -> ${response.status()} ${await response.text()}`,
  ).toBeTruthy();

  return (await response.json()) as T;
}

async function createApprovedSeller(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const seller = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: { email, password, fullName: "Shipping Label Seller", role: "SELLER" },
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
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Shipping Label Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Shipping Label Seller",
      contactPhone: "+79990000018",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(
    request,
    "/api/seller/onboarding/documents",
    {
      method: "POST",
      token: sellerLogin.accessToken,
      multipart: {
        documentType: "INN",
        file: {
          name: "shipping-label.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
    },
  );
  await backendJson(
    request,
    `/api/admin/sellers/${seller.userId}/documents/${document.id}/approve`,
    {
      method: "POST",
      token: adminLogin.accessToken,
      data: {},
    },
  );
  await backendJson(request, `/api/admin/sellers/${seller.userId}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });

  return {
    sellerToken: (
      await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
        method: "POST",
        data: { email, password },
      })
    ).accessToken,
  };
}

async function createPaidOrder(
  request: APIRequestContext,
  sellerToken: string,
  stamp: number,
  phone: string,
) {
  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: {
      name: `Shipping Label Shop ${stamp}`,
      slug: `shipping-label-shop-${stamp}`,
      paymentInstructions: "Manual transfer.",
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    token: sellerToken,
    data: {
      pickupAddress: "Tverskaya 1, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "101000",
      pickupContactPhone: "+74950000000",
      pickupContactName: "Seller Ops",
      pickupLatitude: 55.7558,
      pickupLongitude: 37.6176,
      enabledCarriers: ["CDEK", "YANDEX"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 1200,
      defaultLengthCm: 36,
      defaultWidthCm: 24,
      defaultHeightCm: 12,
    },
  });
  const product = await backendJson<{ id: string }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      token: sellerToken,
      data: {
        wbNmId: 7800000 + (stamp % 100000),
        wbTitle: `Shipping Label Product ${stamp}`,
        localTitle: `Shipping Label Product ${stamp}`,
        localDescription: "Seller shipping label E2E product",
        categoryName: "Shipping Label Category",
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: 8800000 + (stamp % 100000),
            basePrice: 199,
            discountPrice: 199,
            stockQuantity: 5,
          },
        ],
        images: [
          {
            wbUrl: "https://example.com/shipping-label.jpg",
            localUrl: "https://example.com/shipping-label.jpg",
            isMain: true,
            sortOrder: 0,
          },
        ],
      },
    },
  );
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerToken,
    data: {},
  });
  const checkout = await backendJson<{
    orderId: string;
    orderCode: string;
    trackingPath: string;
  }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Shipping Label Customer",
        phone,
        email: `shipping-label-customer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
        country: "Russia",
        city: "Moscow",
        region: "Moscow",
        street: "Lenina",
        building: "10",
        entrance: "64",
        intercom: "66",
        floor: "646",
        apartment: "464",
        noEntrance: false,
        noFloor: false,
        noApartment: false,
        postalCode: "101000",
        latitude: 55.751244,
        longitude: 37.618423,
        note: `Shipping label order ${stamp}`,
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });
  await backendJson<{ paymentStatus: string; status: string }>(
    request,
    `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`,
    {
      method: "POST",
      token: sellerToken,
      data: { note: "Paid for shipping label E2E." },
    },
  );
  return { shop, checkout };
}

async function loginSeller(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

async function switchSellerLocale(page: Page, locale: "ru" | "en" | "vi") {
  const responsePromise = page.waitForResponse("**/api/users/locale");
  await page.locator('[data-testid="language-switcher-seller"]:visible').click();
  await page.getByTestId(`language-option-seller-${locale}`).click();
  await responsePromise;
}

async function expectLabelStructure(
  page: Page,
  expectedSize: "75x120" | "100x150" | "a6",
) {
  const label = page.getByTestId("shipping-label-print-view");
  await expect(label).toBeVisible({ timeout: 15000 });
  await expect(label).toHaveAttribute("data-label-size", expectedSize);
  await expect(page.getByTestId("shipping-label-header")).toBeVisible();
  await expect(page.getByTestId("shipping-label-barcode")).toBeVisible();
  await expect(page.getByTestId("shipping-label-delivery")).toBeVisible();
  await expect(page.getByTestId("shipping-label-recipient")).toBeVisible();
  await expect(page.getByTestId("shipping-label-sender")).toBeVisible();
  await expect(page.getByTestId("shipping-label-items")).toBeVisible();
  await expect(page.getByTestId("shipping-label-payment")).toBeVisible();
  await expect(page.getByTestId("shipping-label-sorting")).toBeVisible();
  await expect(page.getByTestId("shipping-label-footer")).toBeVisible();
  await expect(page.getByTestId("shipping-label-tracking-number")).toBeVisible();
  await expect(page.getByTestId("shipping-label-recipient-phone")).toBeVisible();
  await expect(page.getByTestId("shipping-label-postal-code")).toBeVisible();
  await expect(page.getByTestId("shipping-label-sender-name")).toBeVisible();
  await expect(page.getByTestId("shipping-label-sender-phone")).toBeVisible();
  await expect(page.getByTestId("shipping-label-provider")).toBeVisible();
  await expect(page.getByTestId("shipping-label-delivery-type")).toBeVisible();
  await expect(page.getByTestId("shipping-label-created-at")).toBeVisible();
  await expect(page.getByTestId("shipping-label-qr")).toBeVisible();
  await expect(page.getByTestId("shipping-label-barcode")).toBeVisible();
  await expect(page.locator("[data-testid='shipping-label-print-view']")).toHaveCount(1);

  const metrics = await label.evaluate((element) => {
    const labelRect = element.getBoundingClientRect();
    const sectionIds = [
      "shipping-label-header",
      "shipping-label-barcode",
      "shipping-label-delivery",
      "shipping-label-recipient",
      "shipping-label-sender",
      "shipping-label-items",
      "shipping-label-payment",
      "shipping-label-sorting",
      "shipping-label-footer",
      "shipping-label-tracking-number",
      "shipping-label-postal-code",
      "shipping-label-sender-phone",
      "shipping-label-delivery-type",
      "shipping-label-created-at",
    ];

    return {
      width: labelRect.width,
      height: labelRect.height,
      sections: sectionIds.map((id) => {
        const section = element.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
        return {
          id,
          width: section?.getBoundingClientRect().width ?? 0,
          height: section?.getBoundingClientRect().height ?? 0,
        };
      }),
    };
  });

  expect(metrics.width).toBeGreaterThan(200);
  expect(metrics.height).toBeGreaterThan(300);
  for (const section of metrics.sections) {
    expect(section.width, `${section.id} width`).toBeGreaterThan(0);
    expect(section.height, `${section.id} height`).toBeGreaterThan(0);
  }
}

test("seller can open and print a localized shipping label from order detail", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `shipping-label-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7996${String(stamp).slice(-7)}`;
  const { sellerToken } = await createApprovedSeller(request, email, password);
  const { checkout } = await createPaidOrder(request, sellerToken, stamp, phone);

  await loginSeller(page, email, password);
  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByTestId("seller-print-shipping-label")).toBeVisible();
  await expect(page.getByTestId("seller-open-shipping-label")).toBeVisible();
  await expect(page.getByTestId("seller-shipping-label-size-select")).toHaveValue(
    "100x150",
  );

  await page.getByTestId("manual-yandex-order-id").fill(`YANDEX-${stamp}`);
  await page.getByTestId("manual-delivery-tracking-url").fill(
    `https://track.example/yandex/${stamp}`,
  );
  await page.getByTestId("delivery-order-pickup-address").fill(
    "Seller-managed pickup",
  );
  await page.getByTestId("manual-delivery-save").click();
  await expect(page.getByTestId("delivery-action-message")).toHaveAttribute(
    "data-raw-status",
    /saved|updated/i,
  );
  await page.getByTestId("manual-delivery-mark-in-transit").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("IN_TRANSIT");
  await page.getByTestId("manual-delivery-mark-delivered").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("DELIVERED");

  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("seller-open-shipping-label").click();
  const labelPage = await popupPromise;
  await labelPage.waitForURL(
    /\/seller\/orders\/.+\/shipping-label\?size=100x150/,
  );
  const expectedRuTitle = ruDict.seller.shippingLabel.documentTitle.replace(
    "{{orderCode}}",
    checkout.orderCode,
  );
  await expect(labelPage).toHaveTitle(expectedRuTitle);

  await expect(labelPage.getByTestId("shipping-label-size-select")).toHaveValue(
    "100x150",
  );
  await expectLabelStructure(labelPage, "100x150");
  await expect(labelPage.getByTestId("shipping-label-print-view")).toHaveAttribute(
    "style",
    /--label-width:\s*100mm/i,
  );
  await expect(labelPage.getByTestId("shipping-label-order-code")).toHaveText(
    checkout.orderCode,
  );
  await expect(labelPage.getByTestId("shipping-label-tracking-number")).toContainText(
    `YANDEX-${stamp}`,
  );
  await expect(labelPage.getByTestId("shipping-label-provider")).toHaveText(
    "Yandex Delivery",
  );
  await expect(labelPage.getByTestId("shipping-label-provider")).not.toContainText(
    "Yandex thủ công",
  );
  await expect(labelPage.getByTestId("shipping-label-delivery-type")).not.toHaveText("");
  await expect(labelPage.getByTestId("shipping-label-created-at")).not.toHaveText("");
  await expect(labelPage.getByTestId("shipping-label-postal-code")).toContainText(
    "101000",
  );
  await expect(labelPage.getByTestId("shipping-label-sender-phone")).toContainText(
    "+74950000000",
  );
  await expect(labelPage.getByTestId("shipping-label-shipment-status")).toHaveText(
    "Доставлено",
  );
  await expect(labelPage.getByTestId("shipping-label-recipient-name")).toHaveText(
    "Shipping Label Customer",
  );
  await expect(labelPage.getByTestId("shipping-label-recipient-phone")).toHaveText(phone);
  await expect(labelPage.getByTestId("shipping-label-sender-name")).toContainText(
    "Shipping Label Shop",
  );
  await expect(labelPage.getByTestId("shipping-label-pickup-address")).toContainText(
    "Забор у продавца",
  );
  await expect(labelPage.getByTestId("shipping-label-yandex-id")).toContainText(
    `YANDEX-${stamp}`,
  );
  await expect(
    labelPage.getByTestId("shipping-label-payment-status"),
  ).toHaveAttribute("data-status", "PAID");
  await expect(labelPage.locator("[data-testid='seller-shell'] aside")).toBeHidden();
  await expect(labelPage.locator("[data-testid='shipping-label-print-view']")).toHaveCount(
    1,
  );
  await expect(labelPage.locator("[data-print-toolbar='true']")).toHaveCount(3);
  const ruLabelText = await labelPage
    .getByTestId("shipping-label-print-view")
    .innerText();
  expect(ruLabelText).toContain("Подъезд");
  expect(ruLabelText).toContain("Домофон");
  expect(ruLabelText).toContain("Этаж");
  expect(ruLabelText).toContain("Квартира");
  expect(ruLabelText).toContain("Доставлено");
  expect(ruLabelText).toContain("Оплачено");
  expect(ruLabelText).toContain("Экспресс");
  expect(ruLabelText).toContain("Яндекс Доставка");
  expect(ruLabelText).toContain("Забор у продавца");

  expect(ruLabelText).not.toContain("Entrance");
  expect(ruLabelText).not.toContain("Intercom");
  expect(ruLabelText).not.toContain("Floor");
  expect(ruLabelText).not.toContain("Apartment");
  expect(ruLabelText).not.toContain("Seller-managed pickup");
  expect(ruLabelText).not.toContain("DELIVERED");
  expect(ruLabelText).not.toContain("Delivered");

  await labelPage.evaluate(() => {
    const state = window as typeof window & { __printTitleCalls?: string[] };
    state.__printTitleCalls = [];
    window.print = () => {
      state.__printTitleCalls?.push(document.title);
    };
  });
  await labelPage.getByTestId("shipping-label-print-button").click();
  await labelPage.waitForTimeout(1700);
  expect(
    await labelPage.evaluate(() => {
      const state = window as typeof window & { __printTitleCalls?: string[] };
      return state.__printTitleCalls ?? [];
    }),
  ).toEqual([`shipping-label-${checkout.orderCode}`]);
  await expect(labelPage).toHaveTitle(expectedRuTitle);

  await expect(
    labelPage.getByRole("heading", {
      name: ruDict.seller.shippingLabel.pageTitle,
      exact: true,
    }),
  ).toBeVisible();

  await switchSellerLocale(labelPage, "vi");
  await expect(
    labelPage.getByRole("heading", {
      name: viDict.seller.shippingLabel.pageTitle,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    labelPage.getByText(viDict.seller.shippingLabel.scanToTrack, { exact: true }),
  ).toBeVisible();

  await switchSellerLocale(labelPage, "en");
  await expect(
    labelPage.getByRole("heading", {
      name: enDict.seller.shippingLabel.pageTitle,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    labelPage.getByText(enDict.seller.shippingLabel.scanToTrack, { exact: true }),
  ).toBeVisible();
  await expect(labelPage).toHaveTitle(
    enDict.seller.shippingLabel.documentTitle.replace(
      "{{orderCode}}",
      checkout.orderCode,
    ),
  );
  const enLabelText = await labelPage
    .getByTestId("shipping-label-print-view")
    .innerText();

  expect(enLabelText).toContain("Delivered");
  expect(enLabelText).toContain("Entrance: 64");
  expect(enLabelText).toContain("Intercom: 66");
  expect(enLabelText).toContain("Floor: 646");
  expect(enLabelText).toContain("Apartment: 464");
  expect(enLabelText).toContain("Delivered");
  expect(enLabelText).toContain("Seller-managed pickup");


  await labelPage.close();

  await page.getByTestId("seller-shipping-label-size-select").selectOption("75x120");
  await expect(page.getByTestId("seller-shipping-label-size-select")).toHaveValue(
    "75x120",
  );

  const compactPopupPromise = page.waitForEvent("popup");
  await page.getByTestId("seller-open-shipping-label").click();
  const compactLabelPage = await compactPopupPromise;
  await compactLabelPage.waitForURL(
    /\/seller\/orders\/.+\/shipping-label\?size=75x120/,
  );
  await expect(compactLabelPage.getByTestId("shipping-label-size-select")).toHaveValue(
    "75x120",
  );
  await expectLabelStructure(compactLabelPage, "75x120");
  await expect(
    compactLabelPage.getByTestId("shipping-label-print-view"),
  ).toHaveAttribute("style", /--label-width:\s*75mm/i);

  await compactLabelPage.getByTestId("shipping-label-size-select").selectOption("a6");
  await compactLabelPage.waitForURL(
    /\/seller\/orders\/.+\/shipping-label\?size=a6/,
  );
  await expectLabelStructure(compactLabelPage, "a6");
  await expect(
    compactLabelPage.getByTestId("shipping-label-print-view"),
  ).toHaveAttribute("style", /--label-width:\s*105mm/i);

  await compactLabelPage.close();
});
