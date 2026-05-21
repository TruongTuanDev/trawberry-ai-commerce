import Link from "next/link";
import { ProductCard } from "@/components/public/product-card";
import { PromoSlider } from "@/components/public/promo-slider";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProducts, type PublicProduct } from "@/lib/public-api";

const quickLinks = [
  { title: "Women's fashion", href: "/products?gender=female" },
  { title: "Men's fashion", href: "/products?gender=male" },
  { title: "In stock now", href: "/products?inStock=true" },
  { title: "New seller picks", href: "/products?sort=newest" },
];

async function loadFeaturedProducts() {
  try {
    const response = await getPublicProducts({ page: 1, size: 8, sort: "newest" });
    return response.items;
  } catch {
    return [] as PublicProduct[];
  }
}

export default async function HomePage() {
  const items = await loadFeaturedProducts();

  return (
    <PublicShell tone="hero">
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <PromoSlider />

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="card-panel rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,244,255,0.96))] px-6 py-7 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Shopping made easy
              </p>
              <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">
                Discover standout deals and shop top products in one place.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                Large search, bold promotions, and live seller products put customers straight
                into the shopping flow without extra distractions.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="public-button-primary inline-flex items-center justify-center px-6 py-3 text-sm"
                >
                  Shop now
                </Link>
                <Link
                  href="/orders/track"
                  className="public-button-secondary inline-flex items-center justify-center px-6 py-3 text-sm"
                >
                  Track order
                </Link>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2">
              {quickLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-[1.8rem] border border-white/60 bg-white/88 px-5 py-5 shadow-[0_18px_40px_rgba(162,0,255,0.08)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(162,0,255,0.14)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    0{index + 1}
                  </p>
                  <p className="mt-4 text-2xl font-bold text-[var(--foreground)]">{link.title}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Open a focused shopping view so customers can jump into the right category
                    faster.
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Featured for you
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
                  Popular products
                </h2>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-[0_12px_26px_rgba(31,31,41,0.05)] transition hover:-translate-y-0.5"
              >
                View all products
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
                  No products available right now
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  Products will appear here once sellers publish items that are ready for sale.
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
