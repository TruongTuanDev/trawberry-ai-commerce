import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border)]/80 bg-[rgba(255,250,243,0.84)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Easier shopping
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
            Find products, place orders, track delivery, and confirm payment in one place.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
            trawberry brings shoppers and sellers together in one smooth marketplace experience.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Explore
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-[var(--foreground)]">
            <Link href="/products">Shop</Link>
            <Link href="/orders/track">Track order</Link>
            <Link href="/customer/login">Login</Link>
            <Link href="/customer/register">Register</Link>
            <Link href="/seller/register">Sell with trawberry</Link>
            <Link href="/seller/login">Seller login</Link>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Manual payment
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            For bank transfer orders, customers can upload payment confirmation from the order
            tracking page so sellers can review it quickly.
          </p>
        </div>
      </div>
    </footer>
  );
}
