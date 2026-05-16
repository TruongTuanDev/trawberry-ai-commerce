import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border)]/80 bg-[rgba(255,250,243,0.84)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Customer demo flow</p>
          <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
            Browse, checkout, track, and upload proof in one stack.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
            This public marketplace runs on the new Next.js and NestJS stack, while seller operations and AI-assisted
            image workflows stay connected to the same runtime.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Explore</p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-[var(--foreground)]">
            <Link href="/products">Marketplace</Link>
            <Link href="/orders/track">Track an order</Link>
            <Link href="/seller-login">Seller login</Link>
            <Link href="/admin-login">Admin login</Link>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Manual payment note</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Manual transfer orders can be reviewed by the seller after the customer uploads payment proof through the
            public tracking page.
          </p>
        </div>
      </div>
    </footer>
  );
}
