"use client";

import { useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { changeCustomerPassword } from "@/lib/customer-api";

export function CustomerAccountSecurityPageClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { run, isRunning } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    await run({
      action: async () => {
        if (newPassword !== confirmPassword) {
          throw new Error("Mật khẩu xác nhận không khớp.");
        }

        return changeCustomerPassword({
          currentPassword,
          newPassword,
        });
      },
      successMessage: "Mật khẩu customer đã được cập nhật.",
      onSuccess: () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("Mật khẩu customer đã được cập nhật.");
      },
      errorMessage: "Đổi mật khẩu thất bại.",
    }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : "Unable to change password.");
    });
  };

  return (
    <CustomerAccountShell
      title="Bảo mật"
      description="Đổi mật khẩu customer hiện tại. Việc đổi mật khẩu không đăng xuất seller/admin session nếu bạn đang dùng multi-role sessions song song."
    >
      <section className="card-panel max-w-3xl rounded-[1.8rem] px-6 py-6 sm:px-7">
        {error ? (
          <div className="mb-4 rounded-[1.25rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-4">
          <Field label="Mật khẩu hiện tại">
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="public-input" data-testid="customer-security-current-password" />
          </Field>
          <Field label="Mật khẩu mới">
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="public-input" data-testid="customer-security-new-password" />
          </Field>
          <Field label="Xác nhận mật khẩu mới">
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="public-input" data-testid="customer-security-confirm-password" />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isRunning}
          className="public-button-primary mt-6 px-5 py-3 text-sm disabled:opacity-60"
          data-testid="customer-security-submit"
        >
          {isRunning ? "Đang lưu..." : "Đổi mật khẩu"}
        </button>
      </section>
    </CustomerAccountShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
