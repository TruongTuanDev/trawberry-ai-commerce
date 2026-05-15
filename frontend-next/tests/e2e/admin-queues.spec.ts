import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: { method?: "GET" | "POST"; token?: string; data?: unknown } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
  });
  if (!response.ok()) {
    expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  }
  return (await response.json()) as T;
}

async function login(page: Page, email: string, password: string, next = "/admin/dashboard") {
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

async function createPendingSeller(request: APIRequestContext) {
  const stamp = Date.now();
  const password = "password123";
  const email = `admin-queues-pending-${stamp}@example.com`;
  await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "Admin Queues Pending Seller", role: "SELLER" },
  });
  return { email, password };
}

test("admin opens operational queues from dashboard", async ({ page, request }) => {
  test.setTimeout(120000);
  await createPendingSeller(request);
  await login(page, "demo-admin@trawberry.local", "DemoAdmin123!");

  await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
  await page.getByTestId("admin-dashboard-attention-pending-seller-approvals").click();
  await page.waitForURL("**/admin/queues?tab=sellers&status=PENDING");
  await expect(page.getByTestId("admin-queues-page")).toBeVisible();
  await expect(page.getByTestId("admin-queue-tab-sellers")).toBeVisible();
  await expect(page.getByTestId("admin-queue-row").first()).toBeVisible();
  await expect(page.getByTestId("admin-queue-sla").first()).toContainText(/OK|WARNING|BREACHED/);
});

test("non-admin cannot view operational queues", async ({ page, request }) => {
  test.setTimeout(120000);
  const seller = await createPendingSeller(request);
  await login(page, seller.email, seller.password, "/seller/dashboard");
  await page.goto("/admin/queues");
  await page.waitForURL("**/seller/dashboard");
});
