"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type PromoSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
  background: string;
};

const slides: PromoSlide[] = [
  {
    id: "heroes",
    eyebrow: "Deals",
    title: "Sale highlights",
    subtitle: "Standout products, popular brands, and high-visibility offers shoppers notice first.",
    badge: "-35%",
    accent: "From 999 RUB",
    background: "linear-gradient(135deg, #3b0764 0%, #701a75 50%, #cb11ab 100%)",
  },
  {
    id: "discounts",
    eyebrow: "Promo",
    title: "Up to 80% off",
    subtitle: "Big markdowns across top-selling categories to keep the storefront lively and clear.",
    badge: "Up to 80%",
    accent: "Shop today",
    background: "linear-gradient(135deg, #0f172a 0%, #581c87 50%, #b00f92 100%)",
  },
  {
    id: "new",
    eyebrow: "New this week",
    title: "New this week",
    subtitle: "Fresh arrivals from active sellers help customers discover what is new faster.",
    badge: "New",
    accent: "Weekly update",
    background: "linear-gradient(135deg, #4c0519 0%, #831843 45%, #cb11ab 100%)",
  },
  {
    id: "delivery",
    eyebrow: "Fast flow",
    title: "Fast delivery",
    subtitle: "From search to cart, the journey stays simple so shoppers move through the catalog smoothly.",
    badge: "24/7",
    accent: "Easy checkout",
    background: "linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #b00f92 100%)",
  },
  {
    id: "sellers",
    eyebrow: "Seller picks",
    title: "Products from sellers",
    subtitle: "Products from multiple sellers come together in one consistent marketplace view.",
    badge: "More choice",
    accent: "Many sellers",
    background: "linear-gradient(135deg, #09090b 0%, #2e1065 60%, #cb11ab 100%)",
  },
];

export function PromoSlider({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const activeSlide = slides[activeIndex];

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-[2rem] text-white shadow-[0_24px_60px_rgba(15,23,42,0.15)]",
        compact ? "min-h-[280px]" : "min-h-[320px] sm:min-h-[360px]",
      )}
      style={{ background: activeSlide.background }}
      data-testid="promo-slider"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,207,51,0.2),transparent_22%)]" />
      <div className="absolute -right-14 top-10 h-44 w-44 rounded-full bg-white/14 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#ffcf33]/22 blur-3xl" />

      <div className="relative grid h-full gap-8 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-8">
          <div className="promo-slide-enter space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/88">
                {activeSlide.eyebrow}
              </span>
              <span className="rounded-full bg-[#ffcf33] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-950">
                {activeSlide.badge}
              </span>
            </div>
            <div className="max-w-2xl space-y-3">
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                {activeSlide.title}
              </h2>
              <p className="max-w-xl text-sm leading-7 text-white/86 sm:text-base">
                {activeSlide.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold text-white/90">
              {activeSlide.accent}
            </span>
            <span className="text-sm font-medium text-white/74">Fresh highlights every day</span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.7rem] border border-white/14 bg-white/12 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Search faster
              </p>
              <p className="mt-3 text-xl font-bold">Large search bar</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Shoppers can type a keyword quickly and jump into the right products in seconds.
              </p>
            </div>
            <div className="rounded-[1.7rem] border border-purple-500/20 bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-5 text-white backdrop-blur shadow-[0_18px_36px_rgba(203,17,171,0.1)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary-soft)]">
                Shop with confidence
              </p>
              <p className="mt-3 text-xl font-black">Clear offers and discovery</p>
              <p className="mt-2 text-sm leading-6 text-white/86">
                Promotions, categories, and products stay visible in one strong marketplace layout.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={clsx(
                    "h-2.5 rounded-full transition-all",
                    index === activeIndex ? "w-10 bg-white" : "w-2.5 bg-white/38",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous promo slide"
                onClick={() =>
                  setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white/18"
              >
                <span aria-hidden="true">&larr;</span>
              </button>
              <button
                type="button"
                aria-label="Next promo slide"
                onClick={() => setActiveIndex((current) => (current + 1) % slides.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white/18"
              >
                <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
