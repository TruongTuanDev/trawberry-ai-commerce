import { expect, test } from "@playwright/test";

test("action feedback: verify loading states, toast notifications, confirm dialogs, and refresh policies", async ({ page }) => {
  test.setTimeout(90000);

  const stamp = Date.now();
  const email = `action-feedback-${stamp}@example.com`;
  const phone = `+7999${String(stamp).slice(-7)}`;
  const password = "password123";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Feedback Tester");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);

  const registerSubmit = page.getByTestId("customer-register-submit");
  await expect(registerSubmit).toBeVisible();
  await registerSubmit.click();
  await expect(registerSubmit).toContainText("Đang đăng ký...");
  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Đăng ký thành công. Vui lòng đăng nhập." }),
  ).toBeVisible();
  await page.waitForURL("**/customer/login?registered=1");
  await expect(page.getByText("Unauthorized")).toHaveCount(0);
  await expect(page.getByText("Phiên đăng nhập đã hết hạn")).toHaveCount(0);

  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto("/customer/account/profile");
  await page.getByTestId("customer-profile-name").fill("Feedback Tester Edited");
  await page.getByTestId("customer-profile-phone").fill(phone);

  const profileSaveButton = page.getByTestId("customer-profile-save");
  await expect(profileSaveButton).toBeVisible();
  await profileSaveButton.click();

  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Thông tin cá nhân đã được cập nhật." }),
  ).toBeVisible();

  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Feedback Tester Address");
  await page.getByTestId("customer-address-phone").fill(phone);
  await page.getByTestId("customer-address-city").fill("Hanoi");
  await page.getByTestId("customer-address-region").fill("Hanoi");
  await page.getByTestId("customer-address-street").fill("Trang Tien 12");

  const addressSaveButton = page.getByTestId("customer-address-save");
  await expect(addressSaveButton).toBeVisible();
  await addressSaveButton.click();

  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Đã tạo địa chỉ thành công." }),
  ).toBeVisible();

  const addressCard = page.getByTestId("customer-address-card");
  await expect(addressCard).toHaveCount(1);
  await expect(addressCard).toContainText("Trang Tien, 12");

  let dialogTriggered = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Bạn có chắc chắn muốn xóa địa chỉ này?");
    dialogTriggered = true;
    await dialog.accept();
  });

  const deleteBtn = addressCard.getByTestId(/customer-address-delete-/);
  await deleteBtn.click();
  expect(dialogTriggered).toBe(true);

  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Đã xóa địa chỉ thành công." }),
  ).toBeVisible();
  await expect(addressCard).toHaveCount(0);
});
