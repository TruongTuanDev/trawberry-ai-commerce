import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center px-6 py-12">
      <section className="card-panel relative w-full max-w-5xl overflow-hidden rounded-[2rem]">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-8 py-12 sm:px-12">
            <p className="mb-4 inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Parallel Next.js Frontend
            </p>
            <h1 className="max-w-2xl font-[family-name:var(--font-mono-app)] text-5xl font-bold tracking-tight text-[var(--foreground)] sm:text-6xl">
              Seller operations, rebuilt for the migration path.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
              This Next.js workspace runs alongside the current Angular frontend. It starts with seller login,
              dashboard, products, images, AI tasks, orders, and settings routes wired for the NestJS backend.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Browse marketplace
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                Open seller login
              </Link>
              <Link
                href="/seller/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
              >
                Preview seller center
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t border-[var(--border)] bg-[var(--panel-strong)] px-8 py-10 lg:border-t-0 lg:border-l">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Included routes
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[var(--foreground)]">
                <li>/products</li>
                <li>/products/[id]</li>
                <li>/checkout</li>
                <li>/login</li>
                <li>/seller/dashboard</li>
                <li>/seller/products</li>
                <li>/seller/products/[id]</li>
                <li>/seller/products/[id]/images</li>
                <li>/seller/ai-images</li>
                <li>/seller/orders</li>
                <li>/seller/payments</li>
                <li>/seller/settings</li>
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">Auth storage note</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Seller login now uses httpOnly cookies from NestJS. The frontend only caches lightweight user and shop
                context for hydration and revalidates the session from the backend on protected routes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
