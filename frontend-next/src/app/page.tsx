import Link from "next/link";
import { ProductCard } from "@/components/public/product-card";
import { PromoSlider } from "@/components/public/promo-slider";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProducts, type PublicProduct } from "@/lib/public-api";

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

export default async function HomePage() {
  const { items, total } = await loadHomepageCatalog();

  return (
    <PublicShell tone="hero">
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <PromoSlider />

          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Marketplace catalog
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  All published products
                </h2>
                <p className="mt-2 text-sm font-medium text-[var(--muted)]">
                  {total} {total === 1 ? "product" : "products"} available on the live storefront
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-[0_12px_26px_rgba(31,31,41,0.05)] transition hover:-translate-y-0.5"
              >
                Open filters
              </Link>
            </div>

            {items.length ? (
              <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="products-grid">
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
                  Marketplace catalog
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
                  No published products on the homepage yet
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  The homepage now uses the same public catalog feed as the storefront. Products will appear here once sellers publish items that are ready for sale.
                </p>
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/products"
                    className="public-button-primary inline-flex px-5 py-3 text-sm"
                  >
                    Browse catalog
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
