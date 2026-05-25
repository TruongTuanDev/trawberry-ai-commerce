"use client";

import Link from "next/link";
import { FallbackImage } from "@/components/ui/fallback-image";
import { toast } from "@/components/ui/use-toast";
import { useI18n } from "@/i18n/use-i18n";
import type { PublicShopProfile } from "@/lib/public-api";

function formatJoinedAt(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function PublicShopHeader({ shop }: { shop: PublicShopProfile }) {
  const { locale, t } = useI18n("customer");
  const joinedAt = formatJoinedAt(shop.joinedAt, locale);

  return (
    <section
      className="card-panel overflow-hidden rounded-[2rem] bg-white"
      data-testid="public-shop-header"
    >
      <div className="h-32 bg-[radial-gradient(circle_at_top_left,rgba(203,17,171,0.22),transparent_28%),linear-gradient(135deg,#f7ecff_0%,#ffffff_55%,#fff5fc_100%)] sm:h-40">
        {shop.bannerUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${shop.bannerUrl})` }}
          />
        ) : null}
      </div>
      <div className="px-6 pb-6 pt-5 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] border border-[var(--border)] bg-[var(--panel)] text-2xl font-black text-[var(--accent-strong)] shadow-[0_18px_36px_rgba(31,31,41,0.08)]">
              {shop.logoUrl ? (
                <FallbackImage
                  src={shop.logoUrl}
                  alt={shop.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                shop.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  {shop.displayName}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    shop.isVerified
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                  data-testid="public-shop-verified-badge"
                >
                  {shop.isVerified ? t("public.shop.verified") : t("public.shop.notVerified")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                  {t("public.shop.productCount", { count: shop.productCount })}
                </span>
                <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                  {shop.ratingAverage
                    ? t("public.shop.rating", {
                        rating: shop.ratingAverage,
                        count: shop.ratingCount,
                      })
                    : t("public.shop.noRatingYet")}
                </span>
                {joinedAt ? (
                  <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                    {t("public.shop.joinedAt", { date: joinedAt })}
                  </span>
                ) : null}
                {shop.locationLabel ? (
                  <span className="rounded-full bg-[var(--panel)] px-3 py-1">
                    {shop.locationLabel}
                  </span>
                ) : null}
              </div>
              <div className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
                {shop.description?.trim() ? shop.description : t("public.shop.noDescription")}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="public-button-secondary px-5 py-3 text-sm"
              data-testid="public-shop-message-button"
              onClick={() => toast.info(t("public.shop.messagingComingSoon"))}
            >
              {t("public.shop.messageShop")}
            </button>
            <Link
              href="/products"
              className="public-button-primary inline-flex px-5 py-3 text-sm"
            >
              {t("public.shop.backToCatalog")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
