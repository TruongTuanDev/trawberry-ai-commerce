import { expect, test } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

test("seller submits onboarding and admin approves documents and seller", async ({ page, request }) => {
  test.setTimeout(90000);

  const stamp = Date.now();
  const sellerEmail = `seller-onboarding-${stamp}@example.com`;
  const password = "password123";

  const registerResponse = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email: sellerEmail,
      password,
      fullName: "Seller Onboarding E2E",
      role: "SELLER",
    },
  });
  expect(registerResponse.status()).toBe(201);
  const seller = (await registerResponse.json()) as { userId: string; approvalStatus: string };
  expect(seller.approvalStatus).toBe("PENDING");

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
  await expect(page.getByTestId("seller-approval-banner")).toBeVisible();
  await page.getByTestId("language-switcher-seller").click();
  await page.getByTestId("language-option-seller-en").click();

  await page.goto("/seller/onboarding");
  await expect(page.getByTestId("seller-onboarding-page")).toBeVisible();
  await expect(page.getByTestId("seller-onboarding-status")).toHaveText("PENDING");
  await expect(page.getByTestId("seller-contact-name")).toHaveValue("Seller Onboarding E2E");
  await expect(page.getByTestId("seller-contact-email")).toHaveValue(sellerEmail);
  await page.getByTestId("seller-legal-type").selectOption("LLC");
  await page.getByTestId("seller-legal-name").fill("Seller Onboarding E2E LLC");
  await page.getByTestId("seller-inn").fill("7700000000");
  await page.getByTestId("seller-ogrn").fill("1027700000000");
  await page.getByTestId("seller-kpp").fill("770001001");
  await page.getByTestId("seller-legal-address").fill("Moscow, E2E Street 10");
  await page.getByTestId("seller-contact-phone").fill("+79990000004");
  await page.getByTestId("seller-onboarding-save").click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.getByTestId("seller-document-type").selectOption("COMPANY_REGISTRATION");
  await page.getByTestId("seller-document-input").setInputFiles({
    name: "company-registration.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% seller onboarding e2e\n"),
  });
  await page.getByTestId("seller-document-upload").click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  await expect(page.getByTestId("seller-document-row")).toHaveCount(1);

  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/seller-login");
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");

  await page.goto(`/admin/sellers/${seller.userId}`);
  await expect(page.getByTestId("admin-seller-detail-page")).toBeVisible();
  await expect(page.getByText("Seller Onboarding E2E LLC")).toBeVisible();
  const documentRow = page.getByTestId("admin-document-row").first();
  await expect(documentRow).toBeVisible();
  await documentRow.getByRole("button", { name: "Approve document" }).click();
  await expect(documentRow.getByText("Approved")).toBeVisible();

  await page.getByTestId("admin-approve-seller").click();
  await expect(page.getByTestId("admin-seller-status")).toHaveText("Approved");
  await expect(page.getByTestId("admin-audit-row").filter({ hasText: "SELLER_APPROVED" })).toBeVisible();
});
