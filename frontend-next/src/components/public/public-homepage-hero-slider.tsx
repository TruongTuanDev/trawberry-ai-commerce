"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/use-i18n";
import {
  getPublicHomepageSlides,
  type PublicHomepageSlide,
} from "@/lib/public-api";

type PublicHomepageHeroSliderProps = {
  initialSlides?: PublicHomepageSlide[];
};

export function PublicHomepageHeroSlider({
  initialSlides = [],
}: PublicHomepageHeroSliderProps) {
  const { locale: currentLocale, t } = useI18n("customer");
  const locale = currentLocale === "ru" ? "ru" : "en"; // Force RU/EN only, no VI exposure

  const [slides, setSlides] = useState<PublicHomepageSlide[]>(initialSlides);
  const [slidesLoading, setSlidesLoading] = useState(initialSlides.length === 0);
  const [slidesResolved, setSlidesResolved] = useState(initialSlides.length > 0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const autoplayTimerRef = useRef<number | null>(null);
  const slidesRef = useRef<PublicHomepageSlide[]>(initialSlides);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const refreshSlides = async (showLoader: boolean) => {
      if (showLoader && slidesRef.current.length === 0) {
        setSlidesLoading(true);
      }

      try {
        const nextSlides = await getPublicHomepageSlides({
          signal: controller.signal,
        });

        if (!mounted) {
          return;
        }

        if (nextSlides.length > 0) {
          setSlides(nextSlides);
          setSlidesResolved(true);
          setSlidesLoading(false);
          setActiveIndex((current) => Math.min(current, nextSlides.length - 1));
          return;
        }

        if (slidesRef.current.length === 0) {
          setSlides([]);
          setSlidesResolved(true);
          setSlidesLoading(false);
          setActiveIndex(0);
        }
      } catch {
        if (!mounted || controller.signal.aborted) {
          return;
        }

        if (slidesRef.current.length === 0) {
          setSlidesResolved(true);
          setSlidesLoading(false);
        }
      }
    };

    if (initialSlides.length === 0) {
      void refreshSlides(true);
    }

    const handlePageShow = () => {
      void refreshSlides(false);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      mounted = false;
      controller.abort();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [initialSlides]);

  // Autoplay functionality: 5–7s (using 6 seconds here), paused on hover
  useEffect(() => {
    if (slides.length <= 1 || isHovered) {
      if (autoplayTimerRef.current) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      return;
    }

    autoplayTimerRef.current = window.setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 6000);

    return () => {
      if (autoplayTimerRef.current) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [slides.length, isHovered]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  if (slidesLoading && slides.length === 0) {
    return (
      <section
        className="relative overflow-hidden rounded-[2.5rem] border border-[var(--border)] bg-white/80 min-h-[300px] sm:min-h-[400px] md:min-h-[480px]"
        data-testid="hero-slider-loading"
      >
        <div className="animate-pulse h-full min-h-[300px] px-8 py-10 sm:min-h-[400px] sm:px-12 md:min-h-[480px]">
          <div className="max-w-4xl space-y-5">
            <div className="h-7 w-32 rounded-full bg-[var(--panel-strong)]" />
            <div className="h-14 w-3/4 rounded-3xl bg-[var(--panel-strong)]" />
            <div className="h-5 w-2/3 rounded-full bg-[var(--panel-strong)]" />
            <div className="h-12 w-44 rounded-full bg-[var(--panel-strong)]" />
          </div>
        </div>
      </section>
    );
  }

  // Safe fallback if no active slides exist after resolving attempts
  if (slidesResolved && slides.length === 0) {
    const fallbackTitle = t("home.heroFallbackTitle");
    const fallbackSubtitle = t("home.heroFallbackSubtitle");
    const fallbackCta = t("home.heroCtaFallback");
    const fallbackAlt = t("home.bannerAltFallback");

    return (
      <section
        className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#0b0f19_0%,#3b0764_50%,#701a75_100%)] text-white shadow-2xl min-h-[360px] sm:min-h-[400px] md:min-h-[480px] flex items-center"
        data-testid="hero-slider-fallback"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(203,17,171,0.25),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.2),transparent_40%)]" />
        <div className="relative z-10 w-full max-w-4xl px-8 sm:px-12 py-10 space-y-6">
          <div className="space-y-4">
            <span className="inline-block rounded-full bg-white/10 border border-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/90">
              Welcome
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-white drop-shadow-md leading-tight">
              {fallbackTitle}
            </h2>
            <p className="max-w-2xl text-base sm:text-lg md:text-xl text-white/80 leading-relaxed drop-shadow">
              {fallbackSubtitle}
            </p>
          </div>
          <div>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-8 py-3.5 text-sm font-bold text-white transition-all duration-300 shadow-[0_10px_25px_rgba(203,17,171,0.3)] hover:shadow-[0_14px_30px_rgba(203,17,171,0.4)] hover:scale-103 hover:opacity-95"
            >
              {fallbackCta}
            </Link>
          </div>
        </div>
        {/* Hidden screen-reader descriptive element containing altFallback */}
        <span className="sr-only">{fallbackAlt}</span>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[2.5rem] shadow-2xl min-h-[300px] sm:min-h-[400px] md:min-h-[480px] select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="public-homepage-slider"
    >
      <div className="relative w-full h-full min-h-[300px] sm:min-h-[400px] md:min-h-[480px] flex items-stretch">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

          // Localized fields with English fallbacks
          const title = locale === "ru" ? (slide.titleRu || slide.titleEn) : (slide.titleEn || slide.titleRu);
          const subtitle = locale === "ru" ? (slide.subtitleRu || slide.subtitleEn) : (slide.subtitleEn || slide.subtitleRu);
          const ctaLabel = locale === "ru" ? (slide.ctaLabelRu || slide.ctaLabelEn) : (slide.ctaLabelEn || slide.ctaLabelRu);
          const altText = (locale === "ru" ? (slide.altTextRu ?? slide.altTextEn) : (slide.altTextEn ?? slide.altTextRu)) ?? undefined;

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out flex items-stretch ${
                isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
              }`}
              style={{ background: slide.backgroundColor || "#0f172a" }}
              data-testid={`slide-item-${index}`}
            >
              {/* MainVisual: Image background with responsive override */}
              <div className="absolute inset-0 w-full h-full">
                {/* Desktop view: display imageDesktopUrl */}
                <img
                  src={slide.imageDesktopUrl}
                  alt={altText}
                  className="hidden sm:block w-full h-full object-fill"
                  data-testid={`slide-desktop-image-${index}`}
                />
                {/* Mobile view: display imageMobileUrl if present, otherwise desktop fallback */}
                <img
                  src={slide.imageMobileUrl || slide.imageDesktopUrl}
                  alt={altText}
                  className="block sm:hidden w-full h-full object-fill"
                  data-testid={`slide-mobile-image-${index}`}
                />
              </div>

              {/* Slide Content Overlay */}
              {(title || subtitle || (ctaLabel && slide.ctaUrl)) && (
                <div className="relative z-10 w-full max-w-4xl px-6 sm:px-12 md:px-16 flex flex-col justify-end pb-12 sm:pb-16 pt-16 md:justify-center md:pb-0 md:pt-0 text-white pointer-events-none">
                  <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 sm:p-8 max-w-lg space-y-4 sm:space-y-6 shadow-2xl pointer-events-auto">
                    {(title || subtitle) && (
                      <div className="space-y-2 sm:space-y-4">
                        {title && (
                          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl md:text-5xl text-white drop-shadow-md">
                            {title}
                          </h2>
                        )}
                        {subtitle && (
                          <p className="text-xs sm:text-sm md:text-base text-white/90 leading-relaxed drop-shadow">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    )}
                    {ctaLabel && slide.ctaUrl && (
                      <div>
                        <Link
                          href={slide.ctaUrl}
                          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-slate-900 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-dark)] transition-all duration-300 shadow-md hover:shadow-lg hover:scale-103"
                          data-testid={`slide-cta-link-${index}`}
                        >
                          {ctaLabel}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Controls (Only if > 1 slide) */}
      {slides.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition hover:bg-black/50"
            aria-label="Previous slide"
            data-testid="slider-prev-btn"
          >
            <span aria-hidden="true" className="text-lg sm:text-xl">&larr;</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition hover:bg-black/50"
            aria-label="Next slide"
            data-testid="slider-next-btn"
          >
            <span aria-hidden="true" className="text-lg sm:text-xl">&rarr;</span>
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === activeIndex ? "w-8 bg-[var(--brand-primary)]" : "w-2.5 bg-white/50 hover:bg-white/80"
                }`}
                data-testid={`slider-dot-${index}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
