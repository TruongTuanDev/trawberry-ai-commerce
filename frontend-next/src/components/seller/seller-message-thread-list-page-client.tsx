"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import { listSellerMessageThreads, type MessageThreadSummary } from "@/lib/messages-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerMessageThreadListPageClient() {
  const { t } = useI18n("seller");
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [filter, setFilter] = useState("ALL");
  const [items, setItems] = useState<MessageThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void loadShops();
  }, [hydrated, loadShops]);

  useEffect(() => {
    if (!currentShopId) {
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listSellerMessageThreads(currentShopId, {
          filter: filter === "ALL" ? undefined : filter,
        });
        if (!active) return;
        setItems(response.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(
          getLocalizedErrorMessage({
            role: "seller",
            error: issue,
            fallbackKey: "seller.messages.loadFailed",
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
  }, [currentShopId, filter]);

  const formatStatus = (status: string) => {
    const key = `seller.messages.filters.${status.toLowerCase()}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };

  return (
    <div className="space-y-6" data-testid="seller-messages-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {t("seller.messages.eyebrow")}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          {t("seller.messages.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {t("seller.messages.subtitle")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["ALL", "UNREAD", "OPEN", "CLOSED", "REPORTED"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === value
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]"
              }`}
              data-testid={`seller-messages-filter-${value.toLowerCase()}`}
            >
              {value === "ALL"
                ? t("seller.messages.filters.all")
                : value === "UNREAD"
                  ? t("seller.messages.filters.unread")
                  : value === "OPEN"
                    ? t("seller.messages.filters.open")
                    : value === "CLOSED"
                      ? t("seller.messages.filters.closed")
                      : t("seller.messages.filters.reported")}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-[1rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      {!currentShopId ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.messages.noShop")}
        </div>
      ) : loading ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.messages.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.messages.empty")}
        </div>
      ) : (
        items.map((thread) => (
          <Link
            key={thread.id}
            href={`/seller/messages/${thread.id}`}
            className="block rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 transition hover:shadow-md"
            data-testid="seller-message-thread-row"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {thread.customer.fullName}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {thread.subject ?? thread.product?.name ?? thread.shop.name}
                </h3>
                {thread.latestMessage ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                    {thread.latestMessage.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                {thread.unread ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    {t("seller.messages.filters.unread")}
                  </span>
                ) : null}
                <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                  {formatStatus(thread.status)}
                </span>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
