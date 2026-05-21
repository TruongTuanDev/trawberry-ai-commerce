"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import {
  getCustomerAddresses,
  getCustomerOrderHistory,
  getCustomerProfile,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customer-api";

export function CustomerAccountDashboardPageClient() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [profileResponse, addressesResponse, ordersResponse] =
          await Promise.all([
            getCustomerProfile(),
            getCustomerAddresses(),
            getCustomerOrderHistory(),
          ]);

        if (!mounted) {
          return;
        }

        setProfile(profileResponse);
        setAddresses(addressesResponse.items);
        setOrdersCount(ordersResponse.items.length);
        setError(null);
      } catch (issue) {
        if (!mounted) {
          return;
        }
        setError(issue instanceof Error ? issue.message : "Unable to load account dashboard.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CustomerAccountShell
      title="Tài khoản của tôi"
      description="Khu vực riêng cho customer để kiểm soát hồ sơ cá nhân, sổ địa chỉ, lịch sử mua hàng và bảo mật phiên đăng nhập."
    >
      {error ? (
        <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Tên hiển thị" value={profile?.name || "Chưa cập nhật"} />
        <MetricCard label="Địa chỉ đã lưu" value={loading ? "..." : String(addresses.length)} />
        <MetricCard label="Đơn checkout" value={loading ? "..." : String(ordersCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card-panel rounded-[1.75rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Hồ sơ nhanh
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                Thông tin customer hiện tại
              </h2>
            </div>
            <Link href="/customer/account/profile" className="public-button-secondary inline-flex px-4 py-2 text-sm">
              Chỉnh sửa hồ sơ
            </Link>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoRow label="Họ tên" value={profile?.name || "Chưa cập nhật"} />
            <InfoRow label="Email" value={profile?.email || "Chưa cập nhật"} />
            <InfoRow label="Số điện thoại" value={profile?.phone || "Chưa cập nhật"} />
            <InfoRow
              label="Ngày tạo"
              value={
                profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleString()
                  : "Chưa có dữ liệu"
              }
            />
          </dl>
        </section>

        <section className="card-panel rounded-[1.75rem] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Hành động nhanh
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                Tác vụ thường dùng
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <QuickAction href="/customer/account/addresses" title="Quản lý địa chỉ">
              Thêm hoặc chỉnh sửa điểm giao hàng mặc định cho checkout.
            </QuickAction>
            <QuickAction href="/customer/orders" title="Xem đơn hàng">
              Theo dõi parent receipt đa shop và đi vào từng receipt chi tiết.
            </QuickAction>
            <QuickAction href="/customer/account/security" title="Đổi mật khẩu">
              Cập nhật mật khẩu mà không tác động đến seller/admin session.
            </QuickAction>
          </div>
        </section>
      </div>
    </CustomerAccountShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-panel rounded-[1.6rem] bg-[linear-gradient(180deg,#ffffff_0%,#fcf8ff_100%)] px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function QuickAction({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[1.35rem] border border-[var(--border)] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_16px_36px_rgba(203,17,171,0.12)]"
    >
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</p>
    </Link>
  );
}
