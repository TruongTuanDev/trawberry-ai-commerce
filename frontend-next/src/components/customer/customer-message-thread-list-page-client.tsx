"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import { listCustomerMessageThreads, type MessageThreadSummary } from "@/lib/messages-api";

export function CustomerMessageThreadListPageClient() {
  const { t } = useI18n("customer");
  const [items, setItems] = useState<MessageThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listCustomerMessageThreads();
        if (!active) return;
        setItems(response.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(
          getLocalizedErrorMessage({
            role: "customer",
            error: issue,
            fallbackKey: "customer.messages.loadFailed",
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <CustomerAccountShell
      title={t("customer.messages.title")}
      description={t("customer.messages.subtitle")}
    >
      <section className="space-y-4" data-testid="customer-messages-page">
        {loading ? (
          <div className="card-panel rounded-[1.5rem] px-5 py-5 text-sm text-[var(--muted)]">
            {t("customer.messages.loading")}
          </div>
        ) : error ? (
          <div className="rounded-[1rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="card-panel rounded-[1.5rem] px-5 py-5 text-sm text-[var(--muted)]">
            {t("customer.messages.empty")}
          </div>
        ) : (
          items.map((thread) => (
            <Link
              key={thread.id}
              href={`/customer/messages/${thread.id}`}
              className="card-panel block rounded-[1.5rem] px-5 py-5 transition hover:shadow-md"
              data-testid="customer-message-thread-row"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {thread.shop.name}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                    {thread.subject ?? thread.product?.name ?? thread.shop.name}
                  </h2>
                  {thread.latestMessage ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {thread.latestMessage.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {thread.unread ? (
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                      {t("customer.messages.unread")}
                    </span>
                  ) : null}
                  {thread.status === "REPORTED" ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {t("customer.messages.reported")}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </CustomerAccountShell>
  );
}
