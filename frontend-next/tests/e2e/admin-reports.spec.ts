import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendPost<T>(request: APIRequestContext, path: string, data?: unknown, token?: string) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data,
  });
  expect(response.ok(), `POST ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

async function apiLogin(request: APIRequestContext, email: string, password: string) {
  return backendPost<{ accessToken: string; userId: string }>(request, "/api/auth/login", { email, password });
}

async function login(page: Page, email: string, password: string, next = "/admin/reports") {
  await page.goto("/");
  const user = await page.evaluate(
    async ({ apiUrl, loginEmail, loginPassword }) => {
      const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
      const meResponse = await fetch(`${apiUrl}/api/auth/me`, { credentials: "include" });
      if (!meResponse.ok) throw new Error(`Session check failed: ${meResponse.status}`);
      return (await meResponse.json()) as unknown;
    },
    { apiUrl: backendBaseUrl, loginEmail: email, loginPassword: password },
  );
  await page.evaluate((currentUser) => {
    window.localStorage.setItem("strawberry-next-auth", JSON.stringify({ user: currentUser }));
  }, user);
  await page.goto(next);
}

test("admin views reports and exports CSV", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const seller = await backendPost<{ userId: string }>(request, "/api/auth/register", {
    email: `admin-reports-${stamp}@example.com`,
    password: "password123",
    fullName: "Admin Reports Seller",
    role: "SELLER",
  });
  const admin = await apiLogin(request, "demo-admin@trawberry.local", "DemoAdmin123!");
  const task = await backendPost<{ id: string }>(
    request,
    "/api/admin/queue-tasks",
    {
      entityType: "SELLER",
      entityId: seller.userId,
      sellerId: seller.userId,
      title: `Admin reports breached task ${stamp}`,
      slaStatus: "BREACHED",
      priority: "HIGH",
    },
    admin.accessToken,
  );
  await backendPost(request, `/api/admin/queue-tasks/${task.id}/assign`, { assignedToUserId: "me" }, admin.accessToken);

  await login(page, "demo-admin@trawberry.local", "DemoAdmin123!");
  await expect(page.getByTestId("admin-reports-page")).toBeVisible();
  await expect(page.getByTestId("admin-reports-summary")).toBeVisible();
  await expect(page.getByTestId("admin-reports-summary")).toContainText(/Total tasks|Breached/);

  await page.getByTestId("admin-report-tab-sla").click();
  await expect(page.getByTestId("admin-report-sla")).toBeVisible();
  await expect(page.getByTestId("admin-report-row").first()).toBeVisible();

  await page.getByTestId("admin-report-tab-workload").click();
  await expect(page.getByTestId("admin-report-workload")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("admin-report-csv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("workload");
});

test("non-admin cannot view reports", async ({ page, request }) => {
  const stamp = Date.now();
  const sellerEmail = `admin-reports-blocked-${stamp}@example.com`;
  await backendPost(request, "/api/auth/register", {
    email: sellerEmail,
    password: "password123",
    fullName: "Reports Blocked Seller",
    role: "SELLER",
  });
  await login(page, sellerEmail, "password123", "/admin/reports");
  await expect(page).toHaveURL(/\/seller\/dashboard/);
});
