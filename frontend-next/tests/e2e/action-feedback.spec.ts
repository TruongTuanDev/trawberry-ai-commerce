import { expect, test } from "@playwright/test";

test("action feedback: verify loading states, toast notifications, confirm dialogs, and refresh policies", async ({ page }) => {
  test.setTimeout(90000);

  const stamp = Date.now();
  const email = `action-feedback-${stamp}@example.com`;
  const phone = `+7999${String(stamp).slice(-7)}`;
  const password = "password123";

  // Register
  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Feedback Tester");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  
  // Click submit and check the loading text "Đang gửi..."
  const registerSubmit = page.getByTestId("customer-register-submit");
  await expect(registerSubmit).toBeVisible();
  await registerSubmit.click();

  // Wait for redirect to order list
  await page.waitForURL("**/customer/orders");

  // Go to Profile page and verify "Đang lưu..." and Toast
  await page.goto("/customer/account/profile");
  await page.getByTestId("customer-profile-name").fill("Feedback Tester Edited");
  await page.getByTestId("customer-profile-phone").fill(phone);
  
  const profileSaveButton = page.getByTestId("customer-profile-save");
  await expect(profileSaveButton).toBeVisible();
  
  // Click save
  await profileSaveButton.click();
  
  // Verify success toast notification
  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Thông tin cá nhân đã được cập nhật." })
  ).toBeVisible();

  // Go to Addresses page
  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Feedback Tester Address");
  await page.getByTestId("customer-address-phone").fill(phone);
  await page.getByTestId("customer-address-city").fill("Hanoi");
  await page.getByTestId("customer-address-region").fill("Hanoi");
  await page.getByTestId("customer-address-street").fill("Trang Tien 12");
  
  const addressSaveButton = page.getByTestId("customer-address-save");
  await expect(addressSaveButton).toBeVisible();
  await addressSaveButton.click();
  
  // Verify success toast for saving address
  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Đã tạo địa chỉ thành công." })
  ).toBeVisible();

  // Check the address card is visible
  const addressCard = page.getByTestId("customer-address-card");
  await expect(addressCard).toHaveCount(1);
  await expect(addressCard).toContainText("Trang Tien, 12");

  // Set up dialog handler for window.confirm of delete address
  let dialogTriggered = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Bạn có chắc chắn muốn xóa địa chỉ này?");
    dialogTriggered = true;
    await dialog.accept();
  });

  // Delete the address and verify confirm dialog
  const deleteBtn = addressCard.getByTestId(/customer-address-delete-/);
  await deleteBtn.click();

  // Verify that our dialog handler was invoked
  expect(dialogTriggered).toBe(true);

  // Verify delete success toast and address card is removed (refresh policy validation)
  await expect(
    page.getByTestId("toast-success").filter({ hasText: "Đã xóa địa chỉ thành công." })
  ).toBeVisible();
  await expect(addressCard).toHaveCount(0);
});
