"use client";

import type { MessageThreadDetail } from "@/lib/messages-api";

function formatMessageDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : locale === "vi" ? "vi-VN" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

export function MessageThreadView({
  thread,
  locale,
  currentRole,
  labels,
}: {
  thread: MessageThreadDetail;
  locale: string;
  currentRole: "CUSTOMER" | "SELLER" | "ADMIN";
  labels: {
    product: string;
    order: string;
    reported: string;
    closed: string;
    customer: string;
    seller: string;
  };
}) {
  return (
    <section className="space-y-4" data-testid="message-thread-view">
      <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {thread.shop.name}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {thread.subject ?? thread.product?.name ?? thread.shop.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              {thread.product ? (
                <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                  {labels.product}: {thread.product.name}
                </span>
              ) : null}
              {thread.order ? (
                <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                  {labels.order}: {thread.order.orderCode}
                </span>
              ) : null}
              {thread.status === "REPORTED" ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                  {labels.reported}
                </span>
              ) : null}
              {thread.status === "CLOSED" ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {labels.closed}
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            <p>
              {labels.customer}: {thread.customer.fullName}
            </p>
            <p className="mt-1">
              {labels.seller}: {thread.seller.fullName}
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5"
        data-testid="message-thread-messages"
      >
        <div className="space-y-4">
          {thread.messages.map((message) => {
            const own =
              (currentRole === "CUSTOMER" && message.senderRole === "CUSTOMER") ||
              (currentRole === "SELLER" && message.senderRole === "SELLER") ||
              (currentRole === "ADMIN" && message.senderRole === "ADMIN");

            return (
              <div
                key={message.id}
                className={`flex ${own ? "justify-end" : "justify-start"}`}
                data-testid="message-thread-message"
              >
                <div
                  className={`max-w-[85%] rounded-[1.35rem] px-4 py-3 text-sm shadow-sm ${
                    own
                      ? "bg-gradient-primary text-white"
                      : "border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${own ? "text-white/80" : "text-[var(--muted)]"}`}>
                    {message.senderName}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-6">{message.message}</p>
                  <p className={`mt-2 text-[11px] ${own ? "text-white/80" : "text-[var(--muted)]"}`}>
                    {formatMessageDate(message.createdAt, locale)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
