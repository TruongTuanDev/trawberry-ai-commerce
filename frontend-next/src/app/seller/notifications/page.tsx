import { SellerShell } from "@/components/seller/seller-shell";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export default function SellerNotificationsPage() {
  return (
    <SellerShell>
      <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-[2rem] border border-[var(--border)] shadow-[var(--shadow)] overflow-hidden p-2">
        <NotificationsPageClient role="seller" />
      </div>
    </SellerShell>
  );
}
