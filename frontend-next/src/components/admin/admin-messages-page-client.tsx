"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listAdminMessageThreads, type MessageThreadSummary } from "@/lib/messages-api";

export function AdminMessagesPageClient() {
  const [status, setStatus] = useState("REPORTED");
  const [items, setItems] = useState<MessageThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listAdminMessageThreads({ status });
        if (!active) return;
        setItems(response.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load conversations.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <div className="space-y-6" data-testid="admin-messages-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Admin queue
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          Buyer-seller messages
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Review reported conversations and close or reopen threads when moderation is required.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["REPORTED", "OPEN", "CLOSED"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                status === value
                  ? "bg-indigo-100 text-indigo-700"
                  : "border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          Loading conversations...
        </div>
      ) : error ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          No conversations found.
        </div>
      ) : (
        items.map((thread) => (
          <Link
            key={thread.id}
            href={`/admin/messages/${thread.id}`}
            className="block rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 transition hover:shadow-md"
            data-testid="admin-message-thread-row"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {thread.shop.name}
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
                <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                  {thread.status}
                </span>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
