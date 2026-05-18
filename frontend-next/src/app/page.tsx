import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";

const highlights = [
  {
    title: "Browse a real catalog",
    description: "Public products come from the new NestJS stack with safe marketplace fields, responsive cards, and search-ready listing.",
  },
  {
    title: "Checkout without account friction",
    description: "Customers can place an order quickly, while totals and order state remain trusted only on the backend.",
  },
  {
    title: "Track and prove payment",
    description: "Manual transfer orders can be tracked later with phone verification and payment proof upload from the public UI.",
  },
];

const sellerValueProps = [
  "Seller workspace already supports product CRUD, images, AI tasks, orders, and manual payment review.",
  "AI image generation stays inside the same runtime, ready for product marketing workflows and future try-on expansion.",
  "Customer and seller flows now meet on one shared platform for a stronger end-to-end demo.",
];

export default function HomePage() {
  return (
    <PublicShell tone="hero">
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="card-panel overflow-hidden rounded-[2.25rem]">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
                <p className="inline-flex rounded-full border border-[var(--border)] bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Public marketplace demo
                </p>
                <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
                  Strawberry AI Commerce now feels like a real storefront, not only a migration sandbox.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                  Browse customer-facing products, place a manual-transfer order, track the order later, and upload payment proof
                  through the same polished frontend that now complements the seller workspace.
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                  <Link href="/products" className="public-button-primary inline-flex items-center justify-center px-6 py-3 text-sm shadow-[0_18px_34px_rgba(182,49,75,0.23)]">
                    Explore products
                  </Link>
                  <Link href="/orders/track" className="public-button-secondary inline-flex items-center justify-center px-6 py-3 text-sm">
                    Track an order
                  </Link>
                  <Link href="/seller/register" className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3a2923]">
                    Sell on marketplace
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden border-t border-[var(--border)] bg-[linear-gradient(180deg,#f0e4d1_0%,#ead8bf_100%)] px-6 py-10 lg:border-t-0 lg:border-l lg:px-8">
                <div className="absolute -right-10 top-8 h-48 w-48 rounded-full bg-[rgba(182,49,75,0.16)] blur-3xl" />
                <div className="absolute left-4 top-28 h-36 w-36 rounded-full bg-[rgba(47,107,73,0.16)] blur-3xl" />
                <div className="relative grid gap-4">
                  <div className="public-muted-card rounded-[1.75rem] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Included now</p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
                      <li>Marketplace listing and product detail</li>
                      <li>Anonymous checkout with backend-calculated totals</li>
                      <li>Public order tracking and payment proof upload</li>
                      <li>Seller-side manual payment review after proof submission</li>
                    </ul>
                  </div>
                  <div className="rounded-[1.75rem] bg-[var(--foreground)] p-6 text-white shadow-[0_22px_48px_rgba(35,24,20,0.22)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Why this matters</p>
                    <p className="mt-4 text-lg font-semibold leading-8">
                      The new stack can now demo the whole customer loop, not just the seller back office.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="card-panel rounded-[1.75rem] px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Demo-ready</p>
                <h2 className="mt-4 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer flow</p>
              <h2 className="mt-4 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                A clean path from browse to proof upload.
              </h2>
              <ol className="mt-6 space-y-4 text-sm leading-7 text-[var(--muted)]">
                <li>1. Discover products in the marketplace grid.</li>
                <li>2. Open a product, choose quantity, and continue to checkout.</li>
                <li>3. Receive an order code, payment instructions, and direct tracking link.</li>
                <li>4. Return later with phone verification to track and upload payment proof.</li>
              </ol>
            </article>

            <article className="card-panel rounded-[2rem] bg-[linear-gradient(180deg,rgba(182,49,75,0.04),rgba(47,107,73,0.08))] px-6 py-8 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Seller + AI value</p>
              <h2 className="mt-4 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                Public storefront polish now matches the seller-side platform story.
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[var(--muted)]">
                {sellerValueProps.map((item) => (
                  <li key={item} className="rounded-[1.35rem] border border-[var(--border)] bg-white px-4 py-4">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
