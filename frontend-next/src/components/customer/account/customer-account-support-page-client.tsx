"use client";

import Link from "next/link";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";

export function CustomerAccountSupportPageClient() {
  return (
    <CustomerAccountShell
      title="Hỗ trợ"
      description="Customer support hiện bám theo receipt checkout và order tracking. Từ đây bạn có thể đi vào lịch sử đơn mua hoặc trang tra cứu public để tiếp tục xử lý."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SupportCard
          href="/customer/orders"
          title="Hỗ trợ theo đơn mua"
          description="Mở receipt customer để gửi support case theo toàn checkout hoặc theo từng order con."
        />
        <SupportCard
          href="/orders/track"
          title="Tra cứu công khai"
          description="Dùng cho các checkout công khai khi bạn chỉ có mã đơn và số điện thoại đã dùng lúc checkout."
        />
      </div>
    </CustomerAccountShell>
  );
}

function SupportCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card-panel rounded-[1.75rem] px-6 py-6 transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(203,17,171,0.12)]"
    >
      <p className="text-lg font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
