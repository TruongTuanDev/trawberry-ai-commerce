import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export default function AdminNotificationsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden p-2">
      <NotificationsPageClient role="admin" />
    </div>
  );
}
