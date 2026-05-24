import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export default function CustomerNotificationsPage() {
  return (
    <CustomerAccountShell
      title="Thông báo"
      description="Xem và quản lý tất cả các thông báo của bạn."
    >
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-[2rem] border border-white/70 shadow-xl overflow-hidden p-2">
        <NotificationsPageClient role="customer" />
      </div>
    </CustomerAccountShell>
  );
}
