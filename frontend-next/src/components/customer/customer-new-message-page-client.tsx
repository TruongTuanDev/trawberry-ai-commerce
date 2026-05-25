"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { MessageComposer } from "@/components/messages/message-composer";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import { createCustomerMessageThread } from "@/lib/messages-api";
import { getPublicProduct, getPublicShopProfile, type PublicProduct, type PublicShopProfile } from "@/lib/public-api";

export function CustomerNewMessagePageClient() {
  const { t } = useI18n("customer");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shop, setShop] = useState<PublicShopProfile | null>(null);
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shopSlug = searchParams.get("shopSlug") ?? "";
  const productId = searchParams.get("productId") ?? "";
  const orderId = searchParams.get("orderId") ?? "";

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const [shopResponse, productResponse] = await Promise.all([
          shopSlug ? getPublicShopProfile(shopSlug) : Promise.resolve(null),
          productId ? getPublicProduct(productId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        setShop(shopResponse?.shop ?? null);
        setProduct(productResponse);
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
  }, [productId, shopSlug]);

  return (
    <CustomerAccountShell
      title={t("customer.messages.newMessage")}
      description={t("customer.messages.newSubtitle")}
    >
      <section className="space-y-4" data-testid="customer-new-message-page">
        {loading ? (
          <div className="card-panel rounded-[1.5rem] px-5 py-5 text-sm text-[var(--muted)]">
            {t("customer.messages.loading")}
          </div>
        ) : error || !shop ? (
          <div className="rounded-[1rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error ?? t("customer.messages.shopUnavailable")}
          </div>
        ) : (
          <>
            <div className="card-panel rounded-[1.5rem] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {shop.name}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                {product?.name ?? shop.displayName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                {product ? <span>{t("customer.messages.productContext")}: {product.name}</span> : null}
                {orderId ? <span>{t("customer.messages.orderContext")}: {orderId}</span> : null}
              </div>
              <div className="mt-4">
                <Link
                  href={`/shops/${shop.slug}`}
                  className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                >
                  {t("customer.messages.backToShop")}
                </Link>
              </div>
            </div>
            <MessageComposer
              placeholder={t("customer.messages.typeMessage")}
              submitLabel={t("customer.messages.sendMessage")}
              submittingLabel={t("customer.messages.sending")}
              testIdPrefix="customer-new-message"
              onSubmit={async (message) => {
                const created = await createCustomerMessageThread({
                  shopSlug,
                  productId: productId || undefined,
                  orderId: orderId || undefined,
                  message,
                });
                router.push(`/customer/messages/${created.id}`);
              }}
            />
          </>
        )}
      </section>
    </CustomerAccountShell>
  );
}
