export const dynamic = "force-dynamic";

import { HomeCatalogSectionClient } from "@/components/public/home-catalog-section-client";
import { PublicHomepageHeroSlider } from "@/components/public/public-homepage-hero-slider";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicProducts, getPublicHomepageSlides, type PublicProduct, type PublicHomepageSlide } from "@/lib/public-api";

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

  let slides: PublicHomepageSlide[] = [];
  try {
    slides = await getPublicHomepageSlides();
  } catch (error) {
    console.error("Failed to load public homepage slides", error);
  }

  return (
    <PublicShell tone="hero">
      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <PublicHomepageHeroSlider initialSlides={slides} />
          <HomeCatalogSectionClient items={items} total={total} />
        </div>
      </main>
    </PublicShell>
  );
}
