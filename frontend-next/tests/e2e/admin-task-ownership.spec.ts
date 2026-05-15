import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(request: APIRequestContext, path: string, data?: unknown) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    data,
  });
  expect(response.ok(), `POST ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

async function login(page: Page, email: string, password: string, next = "/admin/queues") {
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

test("admin claims, escalates, and resolves a queue task", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const sellerEmail = `admin-task-owner-${stamp}@example.com`;
  await backendJson<{ userId: string }>(request, "/api/auth/register", {
    email: sellerEmail,
    password: "password123",
    fullName: "Admin Task Owner Seller",
    role: "SELLER",
  });

  await login(page, "demo-admin@trawberry.local", "DemoAdmin123!", `/admin/queues?tab=sellers&status=PENDING&q=${encodeURIComponent(sellerEmail)}`);
  await expect(page.getByTestId("admin-queues-page")).toBeVisible();
  await expect(page.getByTestId("admin-queue-search")).toHaveValue(sellerEmail);
  await expect(page.getByTestId("admin-queue-row").first()).toBeVisible();

  await page.getByTestId("admin-task-claim").first().click();
  await expect(page.getByTestId("admin-queue-assignee").first()).toContainText(/demo-admin|Admin/i);
  await expect(page.getByTestId("admin-task-status").first()).toContainText("IN_PROGRESS");

  await page.getByTestId("admin-task-escalate").first().click();
  await expect(page.getByTestId("admin-task-status").first()).toContainText("ESCALATED");
  await expect(page.getByTestId("admin-task-priority").first()).toContainText(/HIGH|URGENT/);

  await page.getByTestId("admin-task-resolve").first().click();
  await expect(page.getByText("Task updated.")).toBeVisible();
});
