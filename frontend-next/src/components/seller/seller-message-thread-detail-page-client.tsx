"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageThreadView } from "@/components/messages/message-thread-view";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  closeSellerMessageThread,
  getSellerMessageThread,
  markSellerThreadRead,
  sendSellerMessage,
  type MessageThreadDetail,
} from "@/lib/messages-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerMessageThreadDetailPageClient({ threadId }: { threadId: string }) {
  const { locale, t } = useI18n("seller");
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [thread, setThread] = useState<MessageThreadDetail | null>(null);
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
    if (!currentShopId) return;
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await getSellerMessageThread(currentShopId, threadId);
        if (!active) return;
        setThread(response);
        setError(null);
        await markSellerThreadRead(currentShopId, threadId);
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
  }, [currentShopId, hydrated, loadShops, threadId]);

  return (
    <div className="space-y-4" data-testid="seller-message-thread-page">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/seller/messages"
          className="public-button-secondary inline-flex px-4 py-2 text-sm"
        >
          {t("seller.messages.backToList")}
        </Link>
        {thread?.canClose && currentShopId ? (
          <button
            type="button"
            onClick={() =>
              void closeSellerMessageThread(currentShopId, thread.id).then((updated) => {
                setThread(updated);
                toast.success(t("seller.messages.closedSuccess"));
              }).catch((issue) => {
                toast.error(
                  getLocalizedErrorMessage({
                    role: "seller",
                    error: issue,
                    fallbackKey: "seller.messages.closeFailed",
                  }),
                );
              })
            }
            className="public-button-secondary px-4 py-2 text-sm"
            data-testid="seller-close-thread"
          >
            {t("seller.messages.closeConversation")}
          </button>
        ) : null}
      </div>
      {loading ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.messages.loading")}
        </div>
      ) : error || !thread ? (
        <div className="rounded-[1rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? t("seller.messages.loadFailed")}
        </div>
      ) : (
        <>
          <MessageThreadView
            thread={thread}
            locale={locale}
            currentRole="SELLER"
            labels={{
              product: t("seller.messages.productContext"),
              order: t("seller.messages.orderContext"),
              reported: t("seller.messages.filters.reported"),
              closed: t("seller.messages.filters.closed"),
              customer: t("seller.messages.customer"),
              seller: t("seller.messages.seller"),
            }}
          />
          <MessageComposer
            placeholder={t("seller.messages.typeMessage")}
            submitLabel={t("seller.messages.sendMessage")}
            submittingLabel={t("seller.messages.sending")}
            disabled={!thread.canReply || !currentShopId}
            testIdPrefix="seller-message-composer"
            onSubmit={async (message) => {
              if (!currentShopId) return;
              const updated = await sendSellerMessage(currentShopId, thread.id, message);
              setThread(updated);
            }}
          />
        </>
      )}
    </div>
  );
}
