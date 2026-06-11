import { expect, test, type Page, type Route } from "@playwright/test";

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

test("admin opens Ads monitoring with config, metrics, and anomalies", async ({ page }) => {
  await loginAdmin(page);
  await page.route("**/api/admin/ads/monitoring/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/runtime-config")) return fulfill(route, runtimeConfig());
    if (path.endsWith("/anomalies")) {
      return fulfill(route, {
        window: "24h",
        since: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        thresholds: runtimeConfig().thresholds,
        items: [
          {
            id: "wallet_ledger_mismatch:wallet-1",
            severity: "critical",
            type: "wallet_ledger_mismatch",
            description: "Wallet wallet-1 does not match its ledger-derived balance.",
            suggestedAction: "Review the wallet ledger. Do not auto-correct financial records.",
            detectedAt: new Date().toISOString(),
            related: { walletId: "wallet-1", shopId: "shop-1" },
          },
        ],
      });
    }
    return fulfill(route, summary());
  });

  await page.goto("/admin/ads/monitoring");
  await expect(page.getByTestId("admin-ads-monitoring-page")).toBeVisible();
  await expect(page.getByTestId("ads-monitoring-runtime-config")).toContainText("Sponsored ranking");
  await expect(page.getByTestId("ads-monitoring-health-summary")).toContainText("Wallet balance");
  await expect(page.getByTestId("ads-monitoring-invalid-breakdown")).toContainText("duplicate token");
  await expect(page.getByTestId("ads-monitoring-anomalies")).toContainText("wallet ledger mismatch");
  await expect(page.getByTestId("ads-monitoring-anomaly-row")).toContainText("critical");

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  }
});

test("seller cannot access Ads monitoring", async ({ page }) => {
  await loginSeller(page);
  await page.goto("/admin/ads/monitoring");
  await page.waitForURL(/\/admin-login\?next=/);
  await expect(page.getByTestId("admin-ads-monitoring-page")).toHaveCount(0);
});

function summary() {
  return {
    window: "24h",
    since: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    health: {
      status: "critical",
      anomalyCount: 1,
      criticalCount: 1,
      highCount: 0,
      mediumCount: 0,
    },
    wallet: {
      walletCount: 4,
      totalBalance: "12500",
      totalReserved: "0",
      totalAvailable: "12500",
      negativeWalletCount: 0,
      ledgerMismatchCount: 1,
    },
    ledger: {
      creditsCount: 2,
      creditsAmount: "5000",
      debitsCount: 15,
      debitsAmount: "15",
      failedChargeAttempts: 3,
      debitWithoutCampaignCount: 0,
      orphanManualTopUpCreditCount: 0,
      duplicateReferenceCount: 0,
    },
    topUps: {
      pendingCount: 2,
      pendingAmount: "1500",
      confirmedCount: 1,
      confirmedAmount: "5000",
      rejectedCount: 1,
      confirmedWithoutLedgerCount: 0,
    },
    campaigns: {
      activeCount: 3,
      approvedCount: 4,
      pendingReviewCount: 2,
      suspendedCount: 1,
      budgetExhaustedCount: 1,
      walletInsufficientCount: 1,
      spendingAboveMinorThresholdCount: 0,
      spendAmount: "15",
    },
    clicks: {
      totalSponsoredClicks: 20,
      chargedClicks: 15,
      invalidClicks: 3,
      invalidClickRate: 0.15,
      invalidReasons: { duplicate_token: 2, invalid_token: 1 },
      chargeSuccessCount: 15,
      chargeFailureCount: 2,
      chargeFailureStatuses: { insufficient_wallet: 1, budget_exhausted: 1 },
    },
  };
}

function runtimeConfig() {
  return {
    monitoringEnabled: true,
    sponsoredRankingEnabled: false,
    sponsoredPreset: "balanced",
    sponsoredRollout: "internal",
    campaignModerationEnabled: true,
    moderationRequiredForServing: true,
    invalidClickProtectionEnabled: true,
    selfClickBlockEnabled: true,
    manualTopUpEnabled: true,
    demoFundingEnabled: false,
    environment: "production",
    cpcAmount: 1,
    thresholds: {
      invalidClickRate: 0.3,
      spendSpikeMinor: 5000,
      spendSpikeMajor: 20000,
    },
    privacy: {
      aggregatedOnly: true,
      rawTokensExposed: false,
      rawIpExposed: false,
      rawUserAgentExposed: false,
      secretsExposed: false,
    },
  };
}

function fulfill(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
