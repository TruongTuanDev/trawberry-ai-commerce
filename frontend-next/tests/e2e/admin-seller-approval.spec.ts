import { expect, test } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

test("admin approves a pending seller from the admin UI", async ({ page, request }) => {
  const stamp = Date.now();
  const sellerEmail = `admin-ui-pending-${stamp}@example.com`;

  const registerResponse = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email: sellerEmail,
      password: "password123",
      fullName: "Admin UI Pending Seller",
      role: "SELLER",
    },
  });
  expect(registerResponse.status()).toBe(201);
  const seller = (await registerResponse.json()) as { userId: string; approvalStatus: string };
  expect(seller.approvalStatus).toBe("PENDING");

  await page.goto("/login");
  await page.getByTestId("login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("login-password").fill("DemoAdmin123!");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/admin/sellers");
  await expect(page.getByTestId("admin-sellers-page")).toBeVisible();
  await expect(page.getByText(sellerEmail)).toBeVisible();

  await page.getByTestId(`approve-seller-${seller.userId}`).click();
  await expect(page.getByText(`${sellerEmail} approved.`)).toBeVisible();
  await expect(page.getByTestId("admin-seller-row").filter({ hasText: sellerEmail })).toHaveCount(0);

  await page.getByTestId("seller-status-tab-APPROVED").click();
  await expect(page.getByText(sellerEmail)).toBeVisible();
});
