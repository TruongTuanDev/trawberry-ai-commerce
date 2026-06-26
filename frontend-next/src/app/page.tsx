import { HomeCatalogSectionClient } from "@/components/public/home-catalog-section-client";
import { PublicHomepageHeroSlider } from "@/components/public/public-homepage-hero-slider";
import { PublicShell } from "@/components/public/public-shell";
import {
  getHomeRecommendations,
  getPublicHomepageSlides,
  getPublicProducts,
  type RecommendationProductItem,
  type PublicHomepageSlide,
  type PublicProduct,
} from "@/lib/public-api";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

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

async function loadHomepageSlides() {
  try {
    return await getPublicHomepageSlides();
  } catch {
    return [] as PublicHomepageSlide[];
  }
}

async function loadHomepageRecommendations(enabled: boolean) {
  if (!enabled) {
    return {
      algorithm: null,
      items: [] as RecommendationProductItem[],
    };
  }

  try {
    const recommendationFlags = getRecommendationFlags();
    const response = await getHomeRecommendations(8, {
      debug: recommendationFlags.recommendationExplainabilityEnabled,
    });
    return {
      algorithm: response.algorithm,
      items: response.items,
    };
  } catch {
    return {
      algorithm: null,
      items: [] as RecommendationProductItem[],
    };
  }
}

export default async function HomePage() {
  const recommendationFlags = getRecommendationFlags();
  const { items } = await loadHomepageCatalog();
  const slides = await loadHomepageSlides();
  const recommendations = await loadHomepageRecommendations(
    recommendationFlags.publicRecommendationsEnabled,
  );

  // Merge recommendations into the single product grid: recommended products
  // first (in recommendation order), then the rest of the catalog (deduped).
  const recommendedProductIds = new Set(
    recommendations.items.map((item) => item.product.id),
  );
  const orderedItems = [
    ...recommendations.items.map((item) => item.product),
    ...items.filter((product) => !recommendedProductIds.has(product.id)),
  ];

  return (
    <PublicShell tone="hero">
      <main className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
          <PublicHomepageHeroSlider initialSlides={slides} />

          <HomeCatalogSectionClient items={orderedItems} />
        </div>
      </main>
    </PublicShell>
  );
}
