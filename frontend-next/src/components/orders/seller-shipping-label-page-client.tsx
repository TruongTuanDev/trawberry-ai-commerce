"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ShippingLabelPrintView } from "@/components/orders/shipping-label-print-view";
import {
  getDeliverySettings,
  getOrderDelivery,
  getSellerOrderById,
  type DeliveryDetail,
  type DeliverySettings,
  type SellerOrderListItem,
} from "@/lib/seller-api";
import { useI18n } from "@/i18n/use-i18n";

type SellerShippingLabelPageClientProps = {
  orderId: string;
  autoPrint?: boolean;
};

export function SellerShippingLabelPageClient({
  orderId,
  autoPrint = false,
}: SellerShippingLabelPageClientProps) {
  const { t } = useI18n("seller");
  const [order, setOrder] = useState<SellerOrderListItem | null>(null);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const orderResult = await getSellerOrderById(orderId, "");
        const [deliveryResult, settingsResult] = await Promise.all([
          getOrderDelivery(orderResult.shopId, orderId, "").catch(() => null),
          getDeliverySettings(orderResult.shopId, "").catch(() => null),
        ]);

        if (!mounted) {
          return;
        }

        setOrder(orderResult);
        setDelivery(deliveryResult);
        setDeliverySettings(settingsResult);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : t("seller.shippingLabel.loadFailed"),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [orderId, t]);

  useEffect(() => {
    if (!autoPrint || !order || loading || error) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [autoPrint, error, loading, order]);

  const trackingLookupUrl = useMemo(() => {
    if (!order || typeof window === "undefined" || !order.orderNumber) {
      return null;
    }

    return `${window.location.origin}/orders/track?orderCode=${encodeURIComponent(
      order.orderNumber,
    )}`;
  }, [order]);

  return (
    <ProtectedShell
      role="seller"
      allowedRoles={["SELLER"]}
      loginPath="/seller/login"
      redirectByRole={{
        ADMIN: "/admin/dashboard",
        CUSTOMER: "/customer/account",
      }}
    >
      <>
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(203,17,171,0.08),transparent_38%),linear-gradient(180deg,#f8f5fb_0%,#ffffff_62%)] px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <header className="no-print flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  {t("seller.shippingLabel.kicker")}
                </p>
                <h1 className="mt-2 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                  {t("seller.shippingLabel.pageTitle")}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LanguageSwitcher role="seller" compact />
                <Link
                  href={`/seller/orders/${orderId}`}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                >
                  {t("seller.shippingLabel.backToOrder")}
                </Link>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                  data-testid="shipping-label-print-button"
                >
                  {t("seller.shippingLabel.print")}
                </button>
              </div>
            </header>

            {loading ? (
              <div className="rounded-[2rem] border border-[var(--border)] bg-white px-6 py-10 text-sm text-[var(--muted)]">
                {t("common.loading")}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {order ? (
              <ShippingLabelPrintView
                order={order}
                delivery={delivery}
                deliverySettings={deliverySettings}
                trackingLookupUrl={trackingLookupUrl}
              />
            ) : null}
          </div>
        </main>

        <style jsx global>{`
          [data-testid="seller-shell"] > div {
            min-height: 100vh;
            max-width: none;
            border: none;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
          }

          [data-testid="seller-shell"] aside,
          [data-testid="seller-shell"] > div > div > header {
            display: none !important;
          }

          [data-testid="seller-shell"] > div > div {
            width: 100%;
          }

          [data-testid="seller-shell"] > div > div > main {
            overflow: visible;
            padding: 0;
          }
        `}</style>
      </>
    </ProtectedShell>
  );
}
