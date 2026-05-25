import { expect, test } from "@playwright/test";

test("customer manages account profile, addresses, password, and guarded access", async ({
  browser,
  page,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const email = `customer-account-${stamp}@example.com`;
  const phone = `+7999${String(stamp).slice(-7)}`;
  const password = "password123";
  const newPassword = "newPassword456";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Customer Account");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");

  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto("/products");
  const publicCustomerLink = page.getByTestId("public-customer-link").first();
  await expect(publicCustomerLink).toBeVisible();
  await publicCustomerLink.click();
  await page.waitForURL("**/customer/account");
  await expect(page.getByTestId("customer-account-nav")).toBeVisible();

  await page.goto("/customer/account/profile");
  await page.getByTestId("customer-profile-name").fill("Customer Account Prime");
  await page.getByTestId("customer-profile-phone").fill(phone);
  await page.getByTestId("customer-profile-save").click();
  await page.reload();
  await expect(page.getByTestId("customer-profile-name")).toHaveValue("Customer Account Prime");
  await expect(page.getByTestId("customer-profile-phone")).toHaveValue(phone);

  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Customer Account Prime");
  await page.getByTestId("customer-address-phone").fill(phone);
  await page.getByTestId("customer-address-city").fill("Moscow");
  await page.getByTestId("customer-address-region").fill("Moscow");
  await page.getByTestId("customer-address-street").fill("Tverskaya 12");
  await page.getByTestId("customer-address-building").fill("12");
  await page.getByTestId("customer-address-entrance").fill("1");
  await page.getByTestId("customer-address-floor").fill("3");
  await page.getByTestId("customer-address-apartment").fill("14");
  await page.getByTestId("customer-address-postalCode").fill("101000");
  await page.getByTestId("customer-address-comment").fill("Call before delivery");
  await page.getByTestId("customer-address-latitude").fill("55.7558");
  await page.getByTestId("customer-address-longitude").fill("37.6173");
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toHaveCount(1);
  await expect(page.getByTestId("customer-address-default-badge")).toHaveCount(1);

  await page.getByTestId("customer-address-fullName").fill("Customer Account Prime");
  await page.getByTestId("customer-address-phone").fill(phone);
  await page.getByTestId("customer-address-city").fill("Saint Petersburg");
  await page.getByTestId("customer-address-region").fill("Leningrad");
  await page.getByTestId("customer-address-street").fill("Nevsky");
  await page.getByTestId("customer-address-building").fill("20");
  await page.getByTestId("customer-address-no-entrance").check();
  await page.getByTestId("customer-address-no-floor").check();
  await page.getByTestId("customer-address-no-apartment").check();
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toHaveCount(2);

  const saintPetersburgCard = page
    .getByTestId("customer-address-card")
    .filter({ hasText: "Saint Petersburg" });
  await saintPetersburgCard.getByTestId(/customer-address-default-/).click();
  const defaultCard = page
    .getByTestId("customer-address-card")
    .filter({ hasText: "Saint Petersburg" });
  await expect(defaultCard.getByTestId("customer-address-default-badge")).toBeVisible();

  await defaultCard.getByTestId(/customer-address-edit-/).click();
  await page.getByTestId("customer-address-city").fill("Kazan");
  await page.getByTestId("customer-address-street").fill("Bauman 5");
  await page.getByTestId("customer-address-save").click();
  const updatedCard = page.getByTestId("customer-address-card").filter({ hasText: "Kazan" });
  await expect(updatedCard).toContainText("Bauman 5");

  page.once("dialog", (dialog) => void dialog.accept());
  const firstCard = page.getByTestId("customer-address-card").nth(0);
  await firstCard.getByTestId(/customer-address-delete-/).click();
  await expect(page.getByTestId("customer-address-card")).toHaveCount(1);

  await page.goto("/customer/account/security");
  await page.getByTestId("customer-security-current-password").fill(password);
  await page.getByTestId("customer-security-new-password").fill(newPassword);
  await page.getByTestId("customer-security-confirm-password").fill(newPassword);
  await page.getByTestId("customer-security-submit").click();
  await expect(page.getByTestId("customer-security-current-password")).toHaveValue("");

  await page.getByTestId("customer-account-logout").click();
  await page.waitForURL(/\/customer\/login/);

  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await expect(page.locator("text=/invalid|неверн|không chính xác/i").first()).toBeVisible();

  await page.getByTestId("customer-login-password").fill(newPassword);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/account/security");

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  const sellerEmail = `customer-account-seller-${stamp}@example.com`;
  await sellerPage.goto("/seller/register");
  await sellerPage.getByTestId("seller-register-name").fill("Account Guard Seller");
  await sellerPage.getByTestId("seller-register-email").fill(sellerEmail);
  await sellerPage.getByTestId("seller-register-password").fill(password);
  await sellerPage.getByTestId("seller-register-confirm-password").fill(password);
  await sellerPage.getByTestId("seller-register-submit").click();
  await sellerPage.waitForURL("**/seller/login?registered=1");
  await sellerPage.getByTestId("seller-login-email").fill(sellerEmail);
  await sellerPage.getByTestId("seller-login-password").fill(password);
  await sellerPage.getByTestId("seller-login-submit").click();
  await sellerPage.waitForURL("**/seller/onboarding");
  await sellerPage.goto("/customer/account");
  await sellerPage.waitForURL(/\/customer\/login\?next=/);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin-login");
  await adminPage.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await adminPage.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("admin-login-submit").click();
  await adminPage.waitForURL("**/admin/dashboard");
  await adminPage.goto("/customer/account");
  await adminPage.waitForURL(/\/customer\/login\?next=/);
});
