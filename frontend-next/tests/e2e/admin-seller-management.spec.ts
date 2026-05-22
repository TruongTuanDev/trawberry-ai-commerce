import { expect, test } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

test("admin seller management filters and search stay in sync", async ({ page, request }) => {
  const stamp = Date.now();
  const pendingEmail = `admin-seller-pending-${stamp}@example.com`;
  const pendingPassword = "password123";
  const rejectedEmail = `admin-seller-rejected-${stamp}@example.com`;

  const registerPending = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email: pendingEmail,
      password: pendingPassword,
      fullName: "Pending Seller Sync",
      role: "SELLER",
    },
  });
  expect(registerPending.ok()).toBeTruthy();
  const pendingSeller = (await registerPending.json()) as { userId: string };

  const registerRejected = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email: rejectedEmail,
      password: "password123",
      fullName: "Rejected Seller Sync",
      role: "SELLER",
    },
  });
  expect(registerRejected.ok()).toBeTruthy();
  const rejectedSeller = (await registerRejected.json()) as { userId: string };

  const adminLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
  expect(adminLoginResponse.ok()).toBeTruthy();
  const admin = (await adminLoginResponse.json()) as { accessToken: string };

  const pendingSellerLogin = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: pendingEmail,
      password: pendingPassword,
    },
  });
  expect(pendingSellerLogin.ok()).toBeTruthy();
  const pendingSellerAuth = (await pendingSellerLogin.json()) as { accessToken: string };

  const onboardingProfile = await request.put(`${backendBaseUrl}/api/seller/onboarding/profile`, {
    headers: { Authorization: `Bearer ${pendingSellerAuth.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Pending Seller Sync IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Pending Seller Sync",
      contactPhone: "+79990000081",
      contactEmail: pendingEmail,
    },
  });
  expect(onboardingProfile.ok()).toBeTruthy();

  const pendingDocument = await request.post(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    headers: { Authorization: `Bearer ${pendingSellerAuth.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "pending-seller.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n"),
      },
    },
  });
  expect(pendingDocument.ok()).toBeTruthy();
  const pendingDocumentBody = (await pendingDocument.json()) as { id: string };

  const approvePendingDocument = await request.post(
    `${backendBaseUrl}/api/admin/sellers/${pendingSeller.userId}/documents/${pendingDocumentBody.id}/approve`,
    {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {},
    },
  );
  expect(approvePendingDocument.ok()).toBeTruthy();

  await request.post(`${backendBaseUrl}/api/admin/sellers/${rejectedSeller.userId}/reject`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
    data: { reason: "Admin seller management E2E rejection." },
  });

  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");

  await page.goto("/admin/sellers");
  await expect(page.getByTestId("admin-sellers-page")).toBeVisible();
  await expect(page.getByText(pendingEmail)).toBeVisible();

  await page.getByPlaceholder("Search seller by name, email, phone, or shop").fill(pendingEmail);
  await expect(page.getByText(pendingEmail)).toBeVisible();
  await expect(page.getByText(rejectedEmail)).toHaveCount(0);

  await page.getByPlaceholder("Search seller by name, email, phone, or shop").fill("");
  await page.getByTestId("seller-status-tab-REJECTED").click();
  await expect(page.getByText(rejectedEmail)).toBeVisible();

  await page.getByTestId("seller-status-tab-PENDING").click();
  await expect(page.getByText(pendingEmail)).toBeVisible();
  await page.getByTestId(`approve-seller-${pendingSeller.userId}`).click();
  await expect(page.getByText(`${pendingEmail} approved.`)).toBeVisible({ timeout: 10000 });

  await page.getByTestId("seller-status-tab-APPROVED").click();
  await expect(page.getByText(pendingEmail)).toBeVisible();
});
