"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageThreadView } from "@/components/messages/message-thread-view";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  getCustomerMessageThread,
  markCustomerThreadRead,
  reportCustomerThread,
  sendCustomerMessage,
  type MessageThreadDetail,
} from "@/lib/messages-api";

export function CustomerMessageThreadDetailPageClient({ threadId }: { threadId: string }) {
  const { locale, t } = useI18n("customer");
  const [thread, setThread] = useState<MessageThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await getCustomerMessageThread(threadId);
        if (!active) return;
        setThread(response);
        setError(null);
        await markCustomerThreadRead(threadId);
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
  }, [threadId]);

  return (
    <CustomerAccountShell
      title={t("customer.messages.title")}
      description={t("customer.messages.subtitle")}
    >
      <section className="space-y-4" data-testid="customer-message-thread-page">
        {loading ? (
          <div className="card-panel rounded-[1.5rem] px-5 py-5 text-sm text-[var(--muted)]">
            {t("customer.messages.loading")}
          </div>
        ) : error || !thread ? (
          <div className="rounded-[1rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error ?? t("customer.messages.loadFailed")}
          </div>
        ) : (
          <>
            <MessageThreadView
              thread={thread}
              locale={locale}
              currentRole="CUSTOMER"
              labels={{
                product: t("customer.messages.productContext"),
                order: t("customer.messages.orderContext"),
                reported: t("customer.messages.reported"),
                closed: t("customer.messages.closed"),
                customer: t("customer.messages.customer"),
                seller: t("customer.messages.seller"),
              }}
            />
            <div className="flex flex-wrap gap-3">
              {thread.canReport ? (
                <button
                  type="button"
                  onClick={() =>
                    void reportCustomerThread(thread.id).then((updated) => {
                      setThread(updated);
                      toast.success(t("customer.messages.reportedSuccess"));
                    }).catch((issue) => {
                      toast.error(
                        getLocalizedErrorMessage({
                          role: "customer",
                          error: issue,
                          fallbackKey: "customer.messages.reportFailed",
                        }),
                      );
                    })
                  }
                  className="public-button-secondary px-4 py-2 text-sm"
                  data-testid="customer-report-thread"
                >
                  {t("customer.messages.reportConversation")}
                </button>
              ) : null}
            </div>
            <MessageComposer
              placeholder={t("customer.messages.typeMessage")}
              submitLabel={t("customer.messages.sendMessage")}
              submittingLabel={t("customer.messages.sending")}
              disabled={!thread.canReply}
              testIdPrefix="customer-message-composer"
              onSubmit={async (message) => {
                const updated = await sendCustomerMessage(thread.id, message);
                setThread(updated);
              }}
            />
          </>
        )}
      </section>
    </CustomerAccountShell>
  );
}
