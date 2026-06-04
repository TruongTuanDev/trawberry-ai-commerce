"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { PublicShopHeader } from "@/components/public/public-shop-header";
import { PublicShopProductGrid } from "@/components/public/public-shop-product-grid";
import { useI18n } from "@/i18n/use-i18n";
import { getPublicShopProfile, type PublicShopProfile } from "@/lib/public-api";

export function PublicShopProfilePageClient({ shopSlug }: { shopSlug: string }) {
  const { t } = useI18n("customer");
  const [shop, setShop] = useState<PublicShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicShopProfile(shopSlug);
        if (!mounted) {
          return;
        }
        setShop(response.shop);
        setNotFound(false);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : t("public.shop.loadFailed");
        setShop(null);
        setError(message);
        setNotFound(message.toLowerCase().includes("not found"));
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
  }, [shopSlug, t]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-sm text-[var(--muted)]">
              {t("public.shop.loading")}
            </section>
          ) : notFound ? (
            <section
              className="card-panel rounded-[2rem] px-6 py-10 text-center"
              data-testid="public-shop-not-found"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("public.shop.title")}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
                {t("public.shop.notFoundTitle")}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {t("public.shop.notFoundSubtitle")}
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/products"
                  className="public-button-primary inline-flex px-5 py-3 text-sm"
                >
                  {t("public.shop.backToCatalog")}
                </Link>
              </div>
            </section>
          ) : error || !shop ? (
            <section className="card-panel rounded-[2rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-6 py-10 text-sm text-[var(--accent-strong)]">
              {error ?? t("public.shop.loadFailed")}
            </section>
          ) : (
            <>
              <PublicShopHeader shop={shop} />
              <PublicShopProductGrid shopSlug={shop.slug} shopName={shop.displayName} />
            </>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
