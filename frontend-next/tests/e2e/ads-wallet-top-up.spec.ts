import { expect, test, type Page, type Route } from "@playwright/test";

const now = new Date("2026-06-11T10:00:00.000Z").toISOString();
const topUpId = "00000000-0000-0000-0000-000000000641";
const rejectedTopUpId = "00000000-0000-0000-0000-000000000642";

async function loginSeller(page: Page) {
  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill("demo-seller@trawberry.local");
  await page.getByTestId("seller-login-password").fill("DemoSeller123!");
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL(/\/seller\/dashboard/);
}

async function loginAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL(/\/admin\/dashboard/);
}

async function loginCustomer(page: Page) {
  await page.goto("/customer/login");
  await page.getByTestId("customer-login-email").fill("demo-customer@trawberry.local");
  await page.getByTestId("customer-login-password").fill("DemoCustomer123!");
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL(/\/customer\/(account|orders)/);
}

test("seller requests a top-up and admin confirm credits wallet once", async ({ page }) => {
  test.setTimeout(90000);
  let walletBalance = "0";
  const ledger: Record<string, unknown>[] = [];
  const topUps: ReturnType<typeof buildTopUp>[] = [];

  await page.route("**/api/seller/shops/*/billing/wallet", (route) =>
    fulfill(route, buildWallet(walletBalance)),
  );
  await page.route("**/api/seller/shops/*/billing/ledger", (route) => fulfill(route, ledger));
  await page.route("**/api/seller/shops/*/billing/top-ups**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST" && path.endsWith("/top-ups")) {
      const payload = route.request().postDataJSON() as { amount: number; transferReference?: string };
      const created = buildTopUp(topUpId, "pending", String(payload.amount), payload.transferReference);
      topUps.unshift(created);
      return fulfill(route, created, 201);
    }
    return fulfill(route, sellerList(topUps));
  });
  await page.route("**/api/admin/ads-wallet/top-ups**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/${topUpId}/confirm`)) {
      const item = topUps.find((entry) => entry.id === topUpId)!;
      item.status = "confirmed";
      item.confirmedLedgerId = "ledger-manual-1";
      item.confirmedLedger = {
        id: "ledger-manual-1",
        type: "credit",
        amount: item.amount,
        currency: item.currency,
        balanceBefore: "0",
        balanceAfter: item.amount,
        description: "Manual ads wallet top-up confirmed",
        createdAt: now,
      };
      walletBalance = item.amount;
      ledger.unshift({
        id: "ledger-manual-1",
        walletId: "wallet-1",
        shopId: "shop-1",
        type: "credit",
        amount: item.amount,
        currency: "RUB",
        balanceBefore: "0",
        balanceAfter: item.amount,
        reservedBefore: "0",
        reservedAfter: "0",
        referenceType: "manual_top_up",
        referenceId: item.id,
        description: "Manual ads wallet top-up confirmed",
        campaign: null,
        createdAt: now,
      });
      return fulfill(route, item, 201);
    }
    const match = path.match(/\/top-ups\/([^/]+)$/);
    if (match) return fulfill(route, topUps.find((entry) => entry.id === match[1]));
    return fulfill(route, { flags: { manualTopUpEnabled: true }, items: topUps });
  });

  await loginSeller(page);
  await page.goto("/seller/billing");
  await page.getByTestId("seller-top-up-amount").fill("750");
  await page.getByTestId("seller-top-up-reference").fill("TRANSFER-750");
  await page.getByTestId("seller-top-up-submit").click();
  await expect(page.getByTestId("seller-top-up-row")).toContainText("pending");

  await page.goto("/admin/ads-wallet/top-ups");
  await page.waitForURL(/\/admin-login\?next=/);
  await loginAdmin(page);
  await page.goto("/admin/ads-wallet/top-ups");
  await page.getByTestId("admin-top-up-row").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("admin-top-up-confirm").click();
  await expect(page.getByTestId("admin-top-up-detail")).toContainText("confirmed");
  await expect(page.getByTestId("admin-top-up-detail")).toContainText("ledger-manual-1");

  await page.goto("/seller/billing");
  await expect(page.getByTestId("seller-billing-page")).toContainText("750");
  await expect(page.getByTestId("seller-billing-page")).toContainText("Manual ads wallet top-up confirmed");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  }
  expect(ledger).toHaveLength(1);
});

test("admin rejects a request and seller sees the reason", async ({ page }) => {
  const rejected = buildTopUp(rejectedTopUpId, "pending", "300", "TRANSFER-REJECT");
  await page.route("**/api/admin/ads-wallet/top-ups**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/${rejectedTopUpId}/reject`)) {
      rejected.status = "rejected";
      rejected.rejectionReason = "Transfer reference could not be matched.";
      return fulfill(route, rejected, 201);
    }
    if (path.endsWith(`/${rejectedTopUpId}`)) return fulfill(route, rejected);
    return fulfill(route, { flags: { manualTopUpEnabled: true }, items: [rejected] });
  });
  await page.route("**/api/seller/shops/*/billing/wallet", (route) =>
    fulfill(route, buildWallet("0")),
  );
  await page.route("**/api/seller/shops/*/billing/ledger", (route) => fulfill(route, []));
  await page.route("**/api/seller/shops/*/billing/top-ups**", (route) =>
    fulfill(route, sellerList([rejected])),
  );

  await loginAdmin(page);
  await page.goto("/admin/ads-wallet/top-ups");
  await page.getByTestId("admin-top-up-row").click();
  await page.getByTestId("admin-top-up-rejection-reason").fill("Transfer reference could not be matched.");
  await page.getByTestId("admin-top-up-reject").click();
  await expect(page.getByTestId("admin-top-up-detail")).toContainText("rejected");

  await page.goto("/seller/login");
  await loginSeller(page);
  await page.goto("/seller/billing");
  await expect(page.getByTestId("seller-top-up-history")).toContainText(
    "Transfer reference could not be matched.",
  );
});

test("customer cannot access seller or admin ads wallet top-up pages", async ({ page }) => {
  await loginCustomer(page);
  await page.goto("/seller/billing");
  await page.waitForURL(/\/seller-login\?next=/);
  await expect(page.getByTestId("seller-top-up-form")).toHaveCount(0);

  await page.goto("/admin/ads-wallet/top-ups");
  await page.waitForURL(/\/admin-login\?next=/);
  await expect(page.getByTestId("admin-ads-wallet-top-ups-page")).toHaveCount(0);
});

function buildWallet(balance: string) {
  return {
    id: "wallet-1",
    shopId: "shop-1",
    balance,
    reservedBalance: "0",
    availableBalance: balance,
    currency: "RUB",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function sellerList(items: ReturnType<typeof buildTopUp>[]) {
  return {
    flags: { manualTopUpEnabled: true },
    transferInstructions: {
      configured: true,
      recipient: "Marketplace Ads",
      bank: "Demo Bank",
      account: "Configured outside source control",
      instructions: "Use the request id in the transfer comment.",
    },
    pendingTotal: items
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + Number(item.amount), 0)
      .toString(),
    items,
  };
}

function buildTopUp(id: string, status: string, amount: string, transferReference = "TRANSFER-1") {
  return {
    id,
    sellerId: "seller-1",
    shopId: "shop-1",
    amount,
    currency: "RUB",
    status,
    transferReference,
    proofUrl: null,
    sellerNote: "Seller transfer note",
    adminNote: null,
    rejectionReason: null as string | null,
    reviewedByAdminId: null,
    confirmedLedgerId: null as string | null,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    confirmedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    seller: { id: "seller-1", email: "demo-seller@trawberry.local", fullName: "Demo Seller" },
    shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop" },
    reviewedByAdmin: null,
    confirmedLedger: null as Record<string, unknown> | null,
  };
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
