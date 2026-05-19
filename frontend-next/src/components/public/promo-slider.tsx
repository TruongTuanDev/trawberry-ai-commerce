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
    eyebrow: "Promo",
    title: "Герои распродажи",
    subtitle: "Новые дропы, заметные бренды и самые кликабельные позиции недели.",
    badge: "-35%",
    accent: "от 999 ₽",
    background:
      "linear-gradient(135deg, #cb11ab 0%, #8e1cff 48%, #5b34ff 100%)",
  },
  {
    id: "discounts",
    eyebrow: "Реклама",
    title: "Скидки до 80%",
    subtitle: "Лови маркетплейс-настроение с яркими предложениями и быстрым поиском.",
    badge: "до 80%",
    accent: "limited time",
    background:
      "linear-gradient(135deg, #f52ba7 0%, #c212dc 38%, #7e31ff 100%)",
  },
  {
    id: "new",
    eyebrow: "Новинки",
    title: "Новинки недели",
    subtitle: "Проверяй свежие товары от продавцов, уже готовые к публичной витрине.",
    badge: "new",
    accent: "drop every week",
    background:
      "linear-gradient(135deg, #9b2bff 0%, #cb11ab 45%, #ff5d85 100%)",
  },
  {
    id: "delivery",
    eyebrow: "Fast lane",
    title: "Быстрая доставка",
    subtitle: "Открывай карточки, выбирай вариант и отправляй в корзину без лишних экранов.",
    badge: "24/7",
    accent: "checkout ready",
    background:
      "linear-gradient(135deg, #6e2dff 0%, #a100ff 36%, #cb11ab 100%)",
  },
  {
    id: "sellers",
    eyebrow: "Marketplace",
    title: "Товары от продавцов",
    subtitle: "Каталог остаётся реальным: показываем только опубликованные товары из backend.",
    badge: "real data",
    accent: "safe frontend promo",
    background:
      "linear-gradient(135deg, #cb11ab 0%, #8f14d6 55%, #4f6dff 100%)",
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
        "relative overflow-hidden rounded-[2rem] text-white shadow-[0_24px_60px_rgba(132,17,146,0.24)]",
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
              <span className="rounded-full bg-[#ffcf33] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#5f0b67]">
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
            <span className="text-sm font-medium text-white/74">
              header + promo + grid layout
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.7rem] border border-white/14 bg-white/12 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Search-first
              </p>
              <p className="mt-3 text-xl font-bold">Big white search bar</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Giữ trải nghiệm giống marketplace thật, tập trung vào tìm kiếm và khám phá.
              </p>
            </div>
            <div className="rounded-[1.7rem] border border-white/14 bg-[#ffcf33] p-5 text-[#5e0a66] shadow-[0_18px_36px_rgba(74,0,90,0.16)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a1276]/70">
                Seller ready
              </p>
              <p className="mt-3 text-xl font-black">Public storefront</p>
              <p className="mt-2 text-sm leading-6 text-[#5e0a66]/86">
                Promo chỉ là static frontend; grid sản phẩm vẫn lấy dữ liệu thật từ backend.
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
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                aria-label="Next promo slide"
                onClick={() => setActiveIndex((current) => (current + 1) % slides.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white/18"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
