import Link from "next/link";
import { cookies } from "next/headers";
import { PublicRecommendationSection } from "@/components/public/public-recommendation-section";
import { ProductCard } from "@/components/public/product-card";
import { PublicHomepageHeroSlider } from "@/components/public/public-homepage-hero-slider";
import { PromoSlider } from "@/components/public/promo-slider";
import { PublicShell } from "@/components/public/public-shell";
import {
  getHomeRecommendations,
  getPublicHomepageSlides,
  getPublicProducts,
  type RecommendationProductItem,
  type PublicHomepageSlide,
  type PublicProduct,
} from "@/lib/public-api";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

async function loadHomepageCatalog() {
  try {
    const firstPage = await getPublicProducts({ page: 1, size: 24, sort: "newest" });
    if (firstPage.meta.totalPages <= 1) {
      return {
        items: firstPage.items,
        total: firstPage.meta.total,
      };
    }

    const restPages = await Promise.all(
      Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
        getPublicProducts({
          page: index + 2,
          size: 24,
          sort: "newest",
        }),
      ),
    );

    return {
      items: [firstPage.items, ...restPages.map((page) => page.items)].flat(),
      total: firstPage.meta.total,
    };
  } catch {
    return {
      items: [] as PublicProduct[],
      total: 0,
    };
  }
}

async function loadHomepageSlides() {
  try {
    return await getPublicHomepageSlides();
  } catch {
    return [] as PublicHomepageSlide[];
  }
}

function buildHomepageCategories(items: PublicProduct[]) {
  const categoryMap = new Map<
    string,
    { label: string; href: string; count: number }
  >();

  items.forEach((item) => {
    const label = item.categoryName?.trim();
    if (!label) {
      return;
    }

    const key = item.categorySlug?.trim() || item.categoryId?.trim() || label;
    const href = item.categorySlug
      ? `/products?categorySlug=${encodeURIComponent(item.categorySlug)}`
      : item.categoryId
        ? `/products?categoryId=${encodeURIComponent(item.categoryId)}`
        : `/products?q=${encodeURIComponent(label)}`;

    const current = categoryMap.get(key);
    if (current) {
      current.count += 1;
      return;
    }

    categoryMap.set(key, {
      label,
      href,
      count: 1,
    });
  });

  return Array.from(categoryMap.values())
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 10);
}

async function loadHomepageRecommendations(enabled: boolean) {
  if (!enabled) {
    return {
      algorithm: null,
      items: [] as RecommendationProductItem[],
    };
  }

  try {
    const recommendationFlags = getRecommendationFlags();
    const response = await getHomeRecommendations(8, {
      debug: recommendationFlags.recommendationExplainabilityEnabled,
    });
    return {
      algorithm: response.algorithm,
      items: response.items,
    };
  } catch {
    return {
      algorithm: null,
      items: [] as RecommendationProductItem[],
    };
  }
}

export default async function HomePage() {
  const recommendationFlags = getRecommendationFlags();
  const { items, total } = await loadHomepageCatalog();
  const slides = await loadHomepageSlides();
  const recommendations = await loadHomepageRecommendations(
    recommendationFlags.publicRecommendationsEnabled,
  );
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value) ?? "ru";
  const categories = buildHomepageCategories(items);

  return (
    <PublicShell tone="hero">
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <PublicHomepageHeroSlider initialSlides={slides} />
          <PromoSlider />

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary-dark)]/70">
                  {translate(locale, "home.catalogTitle")}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  {translate(locale, "catalog.allCategories")}
                </h2>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--brand-primary-dark)] shadow-[0_14px_28px_rgba(203,17,171,0.08)] ring-1 ring-[var(--brand-primary)]/10 transition hover:-translate-y-0.5 hover:ring-[var(--brand-primary)]/20"
              >
                {translate(locale, "home.openFilters")}
              </Link>
            </div>

            {categories.length ? (
              <div
                className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
                data-testid="homepage-category-chips"
              >
                <Link
                  href="/products"
                  className="inline-flex shrink-0 items-center rounded-full bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(203,17,171,0.16)]"
                >
                  {translate(locale, "catalog.allCategories")}
                </Link>
                {categories.map((category) => (
                  <Link
                    key={`${category.label}-${category.href}`}
                    href={category.href}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--brand-primary)]/12 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/30 hover:text-[var(--brand-primary-dark)]"
                  >
                    <span>{category.label}</span>
                    <span className="rounded-full bg-[var(--brand-primary-soft)] px-2 py-0.5 text-xs text-[var(--brand-primary-dark)]">
                      {category.count}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--border)] bg-white px-5 py-4 text-sm text-[var(--muted)]">
                {translate(locale, "catalog.noCategoriesFound")}
              </div>
            )}
          </section>

          {recommendations.items.length ? (
            <PublicRecommendationSection
              titleKey="recommendedForYou"
              items={recommendations.items}
              placement="home"
              algorithm={recommendations.algorithm}
              showExplainability={
                recommendationFlags.recommendationExplainabilityEnabled
              }
              trackingEnabled={recommendationFlags.recommendationTrackingEnabled}
            />
          ) : null}

          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  {translate(locale, "home.catalogTitle")}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  {translate(locale, "home.allProducts")}
                </h2>
                <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                  {translate(locale, "home.availableProductsCount", { count: total })}
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center rounded-full border border-[var(--brand-primary)]/12 bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-[0_12px_26px_rgba(31,31,41,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/25 hover:text-[var(--brand-primary-dark)]"
              >
                {translate(locale, "home.openFilters")}
              </Link>
            </div>

            {items.length ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4" data-testid="products-grid">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </section>
            ) : (
              <section
                className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-8"
                data-testid="products-empty-state"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {translate(locale, "home.catalogTitle")}
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
                  {translate(locale, "home.noProductsTitle")}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  {translate(locale, "home.noProductsDesc")}
                </p>
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/products"
                    className="public-button-primary inline-flex px-5 py-3 text-sm"
                  >
                    {translate(locale, "home.browseCatalog")}
                  </Link>
                </div>
              </section>
            )}
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
