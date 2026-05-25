"use client";

import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { useI18n } from "@/i18n/use-i18n";

export function CustomerAccountNotificationsPageClient() {
  const { t } = useI18n("customer");

  return (
    <CustomerAccountShell
      title={t("customer.notifications.title")}
      description={t("customer.notifications.description")}
    >
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-2 shadow-xl backdrop-blur dark:bg-slate-900/80">
        <NotificationsPageClient role="customer" />
      </div>
    </CustomerAccountShell>
  );
}
