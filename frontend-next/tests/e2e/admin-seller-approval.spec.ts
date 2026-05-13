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

  const sellerLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: sellerEmail,
      password: "password123",
    },
  });
  expect(sellerLoginResponse.ok()).toBeTruthy();
  const sellerLogin = (await sellerLoginResponse.json()) as { accessToken: string };

  const profileResponse = await request.put(`${backendBaseUrl}/api/seller/onboarding/profile`, {
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Admin UI Pending Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Admin UI Street 1",
      contactName: "Admin UI Pending Seller",
      contactPhone: "+79990000003",
      contactEmail: sellerEmail,
    },
  });
  expect(profileResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% admin approval e2e\n"),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const document = (await uploadResponse.json()) as { id: string };

  const adminLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
  expect(adminLoginResponse.ok()).toBeTruthy();
  const adminLogin = (await adminLoginResponse.json()) as { accessToken: string };
  const approveDocumentResponse = await request.post(
    `${backendBaseUrl}/api/admin/sellers/${seller.userId}/documents/${document.id}/approve`,
    {
      headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
      data: {},
    },
  );
  expect(approveDocumentResponse.ok()).toBeTruthy();

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
