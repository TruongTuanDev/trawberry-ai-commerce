import { expect, test, type Page, type Route } from "@playwright/test";

const presetV1 = buildPreset("10000000-0000-0000-0000-000000000001", 1, "archived");
const presetV2 = buildPreset("10000000-0000-0000-0000-000000000002", 2, "active");

async function loginAsAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL(/\/admin\/dashboard/);
}

test("admin tuning workflow supports guarded draft, preview, confirmation, and rollback controls", async ({
  page,
}) => {
  await loginAsAdmin(page);
  const workflowEnabled =
    (await page.locator("body").getAttribute("data-recommendation-tuning-workflow-enabled")) ===
    "true";
  test.skip(!workflowEnabled, "Recommendation tuning workflow flag is disabled.");

  let presets = [presetV2, presetV1];
  let activationRequested = false;
  await page.route("**/api/admin/recommendations/tuning-presets**", async (route) => {
    await handleTuningApi(route, presets, {
      onCreate: (created) => {
        presets = [created, ...presets];
      },
      onActivate: () => {
        activationRequested = true;
      },
    });
  });

  await page.goto("/admin/recommendations/tuning");
  await expect(page.getByTestId("admin-recommendation-tuning-page")).toBeVisible();
  await expect(page.getByTestId("tuning-rollback")).toBeVisible();

  await page.getByTestId("tuning-new-preset").click();
  const sponsoredInput = page.getByRole("spinbutton", {
    name: "sponsoredBoost",
    exact: true,
  });
  await sponsoredInput.fill("1.1");
  await expect(page.getByTestId("tuning-guardrail-warning")).toBeVisible();
  await expect(page.getByTestId("tuning-save-preset")).toBeDisabled();

  await sponsoredInput.fill("1");
  await page.getByTestId("tuning-preset-name").fill("Playwright safe draft");
  await page.getByTestId("tuning-save-preset").click();
  await expect(page.getByTestId("tuning-guardrail-warning")).toHaveCount(0);
  await expect(page.getByTestId("tuning-preset-name")).toHaveValue("Controlled preset v1");

  await page.getByTestId(`tuning-preset-${presetV2.id}`).click();
  await page.getByTestId("tuning-preview").click();
  await expect(page.getByTestId("tuning-preview-results")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page.getByTestId("tuning-activate").click();
  await expect.poll(() => activationRequested).toBe(true);

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  }
});

test("seller cannot open the admin recommendation tuning page", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("demo-seller@trawberry.local");
  await page.getByTestId("login-password").fill("DemoSeller123!");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/seller\/dashboard/);
  const workflowEnabled =
    (await page.locator("body").getAttribute("data-recommendation-tuning-workflow-enabled")) ===
    "true";
  test.skip(!workflowEnabled, "Recommendation tuning workflow flag is disabled.");

  await page.goto("/admin/recommendations/tuning");
  await page.waitForURL(/\/admin-login\?next=/);
  await expect(page.getByTestId("admin-recommendation-tuning-page")).toHaveCount(0);
});

async function handleTuningApi(
  route: Route,
  presets: ReturnType<typeof buildPreset>[],
  callbacks: {
    onCreate: (created: ReturnType<typeof buildPreset>) => void;
    onActivate: () => void;
  },
) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  const base = "/api/admin/recommendations/tuning-presets";
  const id = path.slice(base.length + 1).split("/")[0];
  const selected = presets.find((preset) => preset.id === id) ?? presetV2;

  if (path === base && method === "GET") {
    return fulfill(route, { flags: flags(), presets });
  }
  if (path === base && method === "POST") {
    const created = buildPreset("10000000-0000-0000-0000-000000000003", 1, "draft");
    callbacks.onCreate(created);
    return fulfill(route, created, 201);
  }
  if (path.endsWith("/preview") && method === "POST") {
    return fulfill(
      route,
      {
        placement: "home",
        preset: { id: selected.id, presetKey: selected.presetKey, version: selected.version },
        guardrailViolations: [],
        items: [
          {
            productId: "product-1",
            productName: "Preview product",
            rankMovement: 1,
            scoreDelta: 2,
            sponsoredMarkerChanged: false,
            currentSponsored: false,
            tunedSponsored: false,
            current: { rank: 2, finalScore: 10, reasons: [], scoreBreakdown: {} },
            tuned: { rank: 1, finalScore: 12, reasons: [], scoreBreakdown: {} },
          },
        ],
      },
      201,
    );
  }
  if (path.endsWith("/activate") && method === "POST") {
    callbacks.onActivate();
    return fulfill(route, selected, 201);
  }
  if (path === `${base}/${id}` && method === "GET") {
    return fulfill(route, {
      flags: flags(),
      preset: selected,
      versions: presets.filter((preset) => preset.presetKey === selected.presetKey),
      auditLogs: [],
    });
  }

  return fulfill(route, selected);
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function flags() {
  return {
    workflowEnabled: true,
    presetsEnabled: true,
    activePresetEnabled: false,
  };
}

function buildPreset(id: string, version: number, status: "draft" | "active" | "archived") {
  return {
    id,
    presetKey: "20000000-0000-0000-0000-000000000001",
    name: `Controlled preset v${version}`,
    description: "Playwright fixture",
    status,
    version,
    weights: {
      categoryScore: 1,
      textScore: 1,
      popularityScore: 1,
      freshnessScore: 1,
      ratingScore: 1,
      stockScore: 1,
      shopScore: 1,
      personalizationScore: 1,
      analyticsPerformanceScore: 1,
      sponsoredBoost: 1,
    },
    guardrails: {
      maxSponsoredBoostScore: 5,
      maxBusinessBoostScore: 2,
      maxAnalyticsPerformanceScore: 6,
      maxPersonalizationScore: 18,
    },
    createdByAdminId: "admin-1",
    activatedAt: status === "active" ? "2026-06-11T00:00:00.000Z" : null,
    archivedAt: status === "archived" ? "2026-06-11T00:00:00.000Z" : null,
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
  };
}
