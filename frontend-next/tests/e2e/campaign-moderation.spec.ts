import { expect, test, type Page, type Route } from "@playwright/test";

const campaignId = "00000000-0000-0000-0001-000000000001";

async function loginAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL(/\/admin\/dashboard/);
}

async function loginSeller(page: Page) {
  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill("demo-seller@trawberry.local");
  await page.getByTestId("seller-login-password").fill("DemoSeller123!");
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL(/\/seller\/dashboard/);
}

test("admin reviews and approves a pending sponsored campaign", async ({ page }) => {
  await loginAdmin(page);
  let status = "pending_review";
  const audits = [audit("submitted", null, "pending_review")];
  await page.route("**/api/admin/campaigns/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/approve")) {
      status = "approved";
      audits.unshift(audit("approved", "pending_review", "approved"));
      return fulfill(route, buildCampaign(status, audits), 201);
    }
    if (path === `/api/admin/campaigns/${campaignId}`) {
      return fulfill(route, buildCampaign(status, audits));
    }
    return fulfill(route, {
      flags: { moderationEnabled: true, moderationRequiredForServing: true },
      items: [buildCampaign(status, audits)],
    });
  });

  await page.goto("/admin/campaigns/moderation");
  await expect(page.getByTestId("admin-campaign-moderation-page")).toBeVisible();
  await page.getByTestId("campaign-moderation-row").click();
  await page.getByTestId("campaign-approve").click();
  await expect(page.getByTestId("campaign-moderation-detail")).toContainText("approved");

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  }
});

test("seller sees moderation reason and cannot open admin moderation", async ({ page }) => {
  await loginSeller(page);
  await page.route("**/api/seller/shops/*/campaigns", (route) =>
    fulfill(route, [
      {
        ...buildCampaign("changes_requested", []),
        moderationReason: "Clarify the promoted product description.",
      },
    ]),
  );

  await page.goto("/seller/campaigns");
  await expect(page.getByTestId("seller-campaign-moderation-status")).toContainText(
    "changes requested",
  );
  await expect(page.getByTestId("seller-campaign-moderation")).toContainText(
    "Clarify the promoted product description.",
  );

  await page.goto("/admin/campaigns/moderation");
  await page.waitForURL(/\/admin-login\?next=/);
  await expect(page.getByTestId("admin-campaign-moderation-page")).toHaveCount(0);
});

function buildCampaign(
  moderationStatus: string,
  moderationAuditLogs: ReturnType<typeof audit>[],
) {
  return {
    id: campaignId,
    shopId: "shop-1",
    name: "Playwright moderated campaign",
    description: "Safe campaign review fixture",
    status: "active",
    moderationStatus,
    moderationReason: null,
    reviewedByAdminId: moderationStatus === "approved" ? "admin-1" : null,
    reviewedAt: moderationStatus === "approved" ? new Date().toISOString() : null,
    submittedAt: new Date().toISOString(),
    moderationRequiredForServing: true,
    moderationServingEligible: moderationStatus === "approved",
    scenarioTypes: ["home"],
    startAt: null,
    endAt: null,
    budgetLimit: "100",
    billingMode: "cpc",
    maxBoost: "3",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shop: { id: "shop-1", name: "Demo shop", slug: "demo-shop" },
    billing: {
      mode: "cpc",
      budgetLimit: "100",
      chargingEnabled: true,
      spendTracked: true,
      spentAmount: "0",
      remainingBudget: "100",
      billableImpressions: 0,
      billableClicks: 0,
      chargedClicks: 0,
      totalChargedEvents: 0,
      servedAsSponsored: false,
      budgetExhausted: false,
      walletBlocked: false,
      cpcAmount: "1",
      notes: [],
    },
    summary: { totalTargets: 1, activeTargets: 1, pausedTargets: 0, removedTargets: 0 },
    targets: [],
    moderationAuditLogs,
  };
}

function audit(action: string, previousStatus: string | null, nextStatus: string) {
  return {
    id: `${action}-${nextStatus}`,
    campaignId,
    action,
    previousStatus,
    nextStatus,
    reason: null,
    adminId: action === "submitted" ? null : "admin-1",
    createdAt: new Date().toISOString(),
  };
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
