"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { MessageThreadView } from "@/components/messages/message-thread-view";
import {
  closeAdminMessageThread,
  getAdminMessageThread,
  reopenAdminMessageThread,
  type MessageThreadDetail,
} from "@/lib/messages-api";

export function AdminMessageThreadDetailPageClient({ threadId }: { threadId: string }) {
  const [thread, setThread] = useState<MessageThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await getAdminMessageThread(threadId);
        if (!active) return;
        setThread(response);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load conversation.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [threadId]);

  return (
    <div className="space-y-4" data-testid="admin-message-thread-page">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/messages"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Back to messages
        </Link>
        {thread?.status === "CLOSED" ? (
          <button
            type="button"
            onClick={() =>
              void reopenAdminMessageThread(thread.id).then((updated) => {
                setThread(updated);
                toast.success("Conversation reopened.");
              }).catch((issue) => {
                toast.error(issue instanceof Error ? issue.message : "Unable to reopen conversation.");
              })
            }
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
            data-testid="admin-reopen-thread"
          >
            Reopen conversation
          </button>
        ) : thread ? (
          <button
            type="button"
            onClick={() =>
              void closeAdminMessageThread(thread.id).then((updated) => {
                setThread(updated);
                toast.success("Conversation closed.");
              }).catch((issue) => {
                toast.error(issue instanceof Error ? issue.message : "Unable to close conversation.");
              })
            }
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
            data-testid="admin-close-thread"
          >
            Close conversation
          </button>
        ) : null}
      </div>
      {loading ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          Loading conversation...
        </div>
      ) : error || !thread ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ?? "Unable to load conversation."}
        </div>
      ) : (
        <MessageThreadView
          thread={thread}
          locale="en"
          currentRole="ADMIN"
          labels={{
            product: "Product",
            order: "Order",
            reported: "Reported",
            closed: "Closed",
            customer: "Customer",
            seller: "Seller",
          }}
        />
      )}
    </div>
  );
}
