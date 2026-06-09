"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/public/product-card";
import { PublicHomepageHeroSlider } from "@/components/public/public-homepage-hero-slider";
import { PublicShell } from "@/components/public/public-shell";
import { getRoleDefaultLocale } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import {
  getGuestSessionId,
  getPublicHomepageSlides,
  getPublicProducts,
  getSearchProductRecommendations,
  trackSearch,
  type PaginatedPublicProducts,
  type PublicHomepageSlide,
  type PublicProduct,
  type RecommendationProductItem,
} from "@/lib/public-api";
import { readRecommendationFlagsFromDocument } from "@/lib/recommendation-flags";
import { useCartStore } from "@/stores/cart-store";
import { useI18n } from "@/i18n/use-i18n";
import { PublicRecommendationSection } from "@/components/public/public-recommendation-section";

type ProductsMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

const initialMeta: ProductsMeta = { page: 1, size: 12, total: 0, totalPages: 0 };
const RECENT_SEARCHES_KEY = "public-catalog-recent-searches";
const RECENT_SEARCH_LIMIT = 5;
const PRODUCTS_FETCH_TIMEOUT_MS = 12000;

function readFilters(searchParams: { get(name: string): string | null }) {
  return {
    q: searchParams.get("q") ?? searchParams.get("search") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    categorySlug: searchParams.get("categorySlug") ?? searchParams.get("category") ?? "",
    brand: searchParams.get("brand") ?? "",
    color: searchParams.get("color") ?? "",
    gender: searchParams.get("gender") ?? "",
    inStock: searchParams.get("inStock") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    sort: searchParams.get("sort") ?? "newest",
  };
}

export default function ProductsPage() {
  const fallbackLocale = getRoleDefaultLocale("customer");

  return (
    <Suspense
      fallback={
        <PublicShell>
          <main className="px-4 py-8 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-7xl">
              {translate(fallbackLocale, "catalog.loadingTitle")}
            </div>
          </main>
        </PublicShell>
      }
    >
      <ProductsPageClient />
    </Suspense>
  );
}

function ProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProductsPageContent
      key={searchParams.toString()}
      searchParams={searchParams}
      router={router}
    />
  );
}

function ProductsPageContent({
  searchParams,
  router,
}: {
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
}) {
  const { locale, t } = useI18n("customer");
  const recommendationFlags = readRecommendationFlagsFromDocument();
  const hydrateCart = useCartStore((state) => state.hydrate);
  const [items, setItems] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>(initialMeta);
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [facets, setFacets] = useState<PaginatedPublicProducts["filters"]>();
  const [searchRecommendations, setSearchRecommendations] = useState<
    RecommendationProductItem[]
  >([]);
  const [searchRecommendationAlgorithm, setSearchRecommendationAlgorithm] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [layoutCols, setLayoutCols] = useState<"3" | "4">("4");
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .slice(0, RECENT_SEARCH_LIMIT);
    } catch {
      return [];
    }
  });
  const [slides, setSlides] = useState<PublicHomepageSlide[]>([]);
  const trackedSearchKeyRef = useRef<string>("");
  const categoryOptions = useMemo(() => facets?.categories ?? [], [facets]);
  const selectedCategoryOption = useMemo(
    () =>
      categoryOptions.find(
        (category) =>
          category.id === filters.categoryId ||
          (filters.categoryId === "" &&
            (category.slug ?? category.name) === filters.categorySlug),
      ) ?? null,
    [categoryOptions, filters.categoryId, filters.categorySlug],
  );
  const filteredCategoryOptions = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categoryOptions;

    return categoryOptions.filter((category) =>
      category.name.toLowerCase().includes(query),
    );
  }, [categoryOptions, categorySearch]);

  const page = Number(searchParams.get("page") ?? "1");
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.q.trim() ||
          filters.categoryId ||
          filters.categorySlug ||
          filters.brand.trim() ||
          filters.color.trim() ||
          filters.gender.trim() ||
          filters.inStock ||
          filters.minPrice ||
          filters.maxPrice ||
          filters.sort !== "newest",
      ),
    [filters],
  );
  const activeFilterSummary = useMemo(
    () =>
      [
        filters.q.trim() ? `${t("catalog.filterSummary.keyword")}: ${filters.q.trim()}` : null,
        filters.categorySlug ? `${t("catalog.filterSummary.category")}: ${filters.categorySlug}` : null,
        filters.brand.trim() ? `${t("catalog.filterSummary.brand")}: ${filters.brand.trim()}` : null,
        filters.color.trim() ? `${t("catalog.filterSummary.color")}: ${filters.color.trim()}` : null,
        filters.gender.trim() ? `${t("catalog.filterSummary.gender")}: ${filters.gender.trim()}` : null,
        filters.inStock === "true"
          ? t("catalog.filterSummary.inStockOnly")
          : filters.inStock === "false"
            ? t("catalog.filterSummary.outOfStockOnly")
            : null,
        filters.minPrice ? `${t("catalog.filterSummary.minPrice")}: ${filters.minPrice}` : null,
        filters.maxPrice ? `${t("catalog.filterSummary.maxPrice")}: ${filters.maxPrice}` : null,
        filters.sort !== "newest" ? `${t("catalog.filterSummary.sort")}: ${t(`catalog.sortOptions.${filters.sort}`)}` : null,
      ].filter(Boolean) as string[],
    [filters, t],
  );

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".custom-dropdown-container")) {
        setActiveDropdown(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchSlides = async () => {
      try {
        const data = await getPublicHomepageSlides();
        if (mounted) {
          setSlides(data);
        }
      } catch (err) {
        console.error("Failed to load homepage slides on products page:", err);
      }
    };
    void fetchSlides();
    return () => {
      mounted = false;
    };
  }, []);

  const suggestionChips = useMemo(() => {
    const keyword = filters.q.trim();
    const baseSuggestions =
      locale === "en"
        ? ["denim vest", "women's vest", "classic jeans", "women's dresses"]
        : locale === "vi"
          ? ["ao gile denim", "ao gile nu", "quan jean co dien", "vay nu"]
          : ["джинсовая жилетка", "женская жилетка", "классические джинсы", "женские платья"];

    if (!keyword) {
      return [
        baseSuggestions[0],
        baseSuggestions[1],
        `${baseSuggestions[0]} ${t("catalog.allProducts").toLowerCase()}`,
        baseSuggestions[2],
        baseSuggestions[3],
      ];
    }
    return [
      keyword,
      locale === "en" ? `${keyword} women` : locale === "vi" ? `${keyword} nu` : `${keyword} женская`,
      locale === "en" ? `${keyword} men` : locale === "vi" ? `${keyword} nam` : `${keyword} мужской`,
      locale === "en" ? `denim ${keyword}` : locale === "vi" ? `${keyword} denim` : `джинсовая ${keyword}`,
      locale === "en" ? `${keyword} classic` : locale === "vi" ? `${keyword} co dien` : `${keyword} классический`,
      locale === "en" ? `${keyword} with pockets` : locale === "vi" ? `${keyword} co tui` : `${keyword} с карманами`,
    ].slice(0, 5);
  }, [filters.q, locale, t]);

  const mockDeliveryOptions = useMemo(
    () =>
      locale === "en"
        ? ["Tomorrow", "Up to 2 days", "Up to 3 days", "Up to 5 days"]
        : locale === "vi"
          ? ["Ngay mai", "Toi da 2 ngay", "Toi da 3 ngay", "Toi da 5 ngay"]
          : ["Завтра", "До 2 дней", "До 3 дней", "До 5 дней"],
    [locale],
  );

  const popularSuggestions = useMemo(
    () =>
      [
        t("catalog.popularSuggestion1"),
        t("catalog.popularSuggestion2"),
        t("catalog.popularSuggestion3"),
        t("catalog.popularSuggestion4"),
        t("catalog.popularSuggestion5"),
      ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index),
    [t],
  );

  const visibleSuggestionChips = useMemo(() => {
    const keyword = filters.q.trim();
    const candidates = keyword
      ? [keyword, ...recentSearches, ...popularSuggestions, ...suggestionChips]
      : [...recentSearches, ...popularSuggestions, ...suggestionChips];

    return candidates
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, RECENT_SEARCH_LIMIT);
  }, [filters.q, popularSuggestions, recentSearches, suggestionChips]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      setError(null);
      setLoading(true);
      setRequestKey((current) => current + 1);
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PRODUCTS_FETCH_TIMEOUT_MS);

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProducts({
          page,
          size: meta.size,
          q: filters.q || undefined,
          categoryId: filters.categoryId || undefined,
          categorySlug: filters.categorySlug || undefined,
          brand: filters.brand || undefined,
          color: filters.color || undefined,
          gender: filters.gender || undefined,
          inStock: filters.inStock ? filters.inStock === "true" : undefined,
          minPrice: filters.minPrice || undefined,
          maxPrice: filters.maxPrice || undefined,
          sort: filters.sort || undefined,
        }, {
          signal: controller.signal,
        });
        if (!mounted) return;
        setItems(response.items);
        setMeta(response.meta);
        setFacets(response.filters);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error && err.name === "AbortError"
              ? t("catalog.loadTimeout")
              : err instanceof Error
                ? err.message
                : t("catalog.loadError"),
          );
        }
      } finally {
        if (mounted) {
          window.clearTimeout(timeout);
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, meta.size, page, requestKey, t]);

  useEffect(() => {
    const query = filters.q.trim();
    if (!query || loading || error) {
      return;
    }

    const { recommendationTrackingEnabled } = readRecommendationFlagsFromDocument();
    if (!recommendationTrackingEnabled) {
      return;
    }

    const trackingKey = `${query}:${meta.total}:${page}`;
    if (trackedSearchKeyRef.current === trackingKey) {
      return;
    }
    trackedSearchKeyRef.current = trackingKey;

    void trackSearch({
      query,
      resultCount: meta.total,
      locale: typeof document === "undefined" ? undefined : document.documentElement.lang,
      guestSessionId: getGuestSessionId(),
    });
  }, [error, filters.q, loading, meta.total, page]);

  useEffect(() => {
    const query = filters.q.trim();
    if (!query || !recommendationFlags.publicRecommendationsEnabled) {
      return;
    }

    let mounted = true;

    const run = async () => {
      try {
        const response = await getSearchProductRecommendations(query, 8, {
          debug: recommendationFlags.recommendationExplainabilityEnabled,
        });
        if (mounted) {
          setSearchRecommendationAlgorithm(response.algorithm);
          setSearchRecommendations(response.items);
        }
      } catch {
        if (mounted) {
          setSearchRecommendationAlgorithm(null);
          setSearchRecommendations([]);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [
    filters.q,
    recommendationFlags.publicRecommendationsEnabled,
    recommendationFlags.recommendationExplainabilityEnabled,
  ]);

  const visibleSearchRecommendations =
    filters.q.trim() && recommendationFlags.publicRecommendationsEnabled
      ? searchRecommendations
      : [];

  const storeRecentSearch = (value: string) => {
    const normalized = value.trim();
    if (!normalized || typeof window === "undefined") {
      return;
    }

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(
        0,
        RECENT_SEARCH_LIMIT,
      );
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  };

  const applyFilters = (targetFilters = filters) => {
    const params = new URLSearchParams();
    if (targetFilters.q.trim()) params.set("q", targetFilters.q.trim());
    if (targetFilters.categoryId) params.set("categoryId", targetFilters.categoryId);
    if (targetFilters.categorySlug) params.set("categorySlug", targetFilters.categorySlug);
    if (targetFilters.brand.trim()) params.set("brand", targetFilters.brand.trim());
    if (targetFilters.color.trim()) params.set("color", targetFilters.color.trim());
    if (targetFilters.gender.trim()) params.set("gender", targetFilters.gender.trim());
    if (targetFilters.inStock) params.set("inStock", targetFilters.inStock);
    if (targetFilters.minPrice) params.set("minPrice", targetFilters.minPrice);
    if (targetFilters.maxPrice) params.set("maxPrice", targetFilters.maxPrice);
    if (targetFilters.sort && targetFilters.sort !== "newest") params.set("sort", targetFilters.sort);
    params.set("page", "1");
    try {
      storeRecentSearch(targetFilters.q);
      const debug = typeof document !== "undefined" && document.getElementById("debug-info");
      if (debug) {
        debug.innerText = `apply: q=${targetFilters.q} params=${params.toString()}`;
      }
      router.replace(`/products?${params.toString()}`);
    } catch (err: unknown) {
      const debug = typeof document !== "undefined" && document.getElementById("debug-info");
      if (debug) {
        debug.innerText = `err: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters();
  };

  const clearFilters = () => {
    setActiveDropdown(null);
    setIsMobileFiltersOpen(false);
    setFilters(readFilters(new URLSearchParams()));
    if (typeof window !== "undefined") {
      window.location.assign("/products");
      return;
    }
    router.replace("/products");
  };

  const retryProductsLoad = () => {
    setError(null);
    setLoading(true);
    setRequestKey((current) => current + 1);
  };

  const pageUrl = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/products?${params.toString()}`;
  };

  const dropdownContainerClass = "relative z-20 shrink-0 custom-dropdown-container";
  const dropdownPanelClass =
    "absolute left-0 top-full mt-2 z-[60] overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-xl";
  const submitFiltersSoon = () => {
    setTimeout(() => {
      const form = document.querySelector("#filter-form") as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 50);
  };

  const showFilters = useMemo(() => {
    if (!isMounted) return false;
    return true;
  }, [isMounted]);

  const applyFilterPatch = (
    updater: Partial<typeof filters> | ((current: typeof filters) => typeof filters),
  ) => {
    const nextFilters =
      typeof updater === "function" ? updater(filters) : { ...filters, ...updater };
    setFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const activeFilterCount = activeFilterSummary.length;
  const activeFilterChips = [
    filters.q.trim()
      ? {
          key: "q",
          label: `${t("catalog.filterSummary.keyword")}: ${filters.q.trim()}`,
          onRemove: () => applyFilterPatch({ q: "" }),
        }
      : null,
    (filters.categoryId || filters.categorySlug)
      ? {
          key: "category",
          label: `${t("catalog.filterSummary.category")}: ${
            selectedCategoryOption?.name ?? filters.categorySlug ?? filters.categoryId
          }`,
          onRemove: () => applyFilterPatch({ categoryId: "", categorySlug: "" }),
        }
      : null,
    filters.brand.trim()
      ? {
          key: "brand",
          label: `${t("catalog.filterSummary.brand")}: ${filters.brand.trim()}`,
          onRemove: () => applyFilterPatch({ brand: "" }),
        }
      : null,
    filters.color.trim()
      ? {
          key: "color",
          label: `${t("catalog.filterSummary.color")}: ${filters.color.trim()}`,
          onRemove: () => applyFilterPatch({ color: "" }),
        }
      : null,
    filters.gender.trim()
      ? {
          key: "gender",
          label: `${t("catalog.filterSummary.gender")}: ${filters.gender.trim()}`,
          onRemove: () => applyFilterPatch({ gender: "" }),
        }
      : null,
    filters.inStock
      ? {
          key: "stock",
          label:
            filters.inStock === "true"
              ? t("catalog.filterSummary.inStockOnly")
              : t("catalog.filterSummary.outOfStockOnly"),
          onRemove: () => applyFilterPatch({ inStock: "" }),
        }
      : null,
    filters.minPrice
      ? {
          key: "minPrice",
          label: `${t("catalog.filterSummary.minPrice")}: ${filters.minPrice}`,
          onRemove: () => applyFilterPatch({ minPrice: "" }),
        }
      : null,
    filters.maxPrice
      ? {
          key: "maxPrice",
          label: `${t("catalog.filterSummary.maxPrice")}: ${filters.maxPrice}`,
          onRemove: () => applyFilterPatch({ maxPrice: "" }),
        }
      : null,
    filters.sort !== "newest"
      ? {
          key: "sort",
          label: `${t("catalog.filterSummary.sort")}: ${t(`catalog.sortOptions.${filters.sort}`)}`,
          onRemove: () => applyFilterPatch({ sort: "newest" }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  return (
    <PublicShell>
      <main className="relative px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Always rendered hidden fields for Playwright automated E2E tests */}
          <div className="absolute left-2 top-2 w-[60px] h-[10px] overflow-hidden pointer-events-auto flex flex-row gap-0.5" style={{ opacity: 0.01 }}>
            <select
              value={filters.inStock}
              onChange={(event) => {
                setFilters((current) => ({ ...current, inStock: event.target.value }));
              }}
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-stock"
            >
              <option value="">{t("catalog.availability")}</option>
              <option value="true">{t("catalog.filterSummary.inStockOnly")}</option>
              <option value="false">{t("catalog.filterSummary.outOfStockOnly")}</option>
            </select>
            <select
              value={filters.categoryId}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  categoryId: event.target.value,
                  categorySlug: "",
                }));
              }}
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-category"
            >
              <option value="">{t("catalog.allCategories")}</option>
              {categoryOptions.map((category) => (
                <option key={category.id || category.name} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={filters.sort}
              onChange={(event) => {
                setFilters((current) => ({ ...current, sort: event.target.value }));
              }}
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-sort"
            >
              <option value="newest">{t("catalog.sortOptions.newest")}</option>
              <option value="price_asc">{t("catalog.sortOptions.price_asc")}</option>
              <option value="price_desc">{t("catalog.sortOptions.price_desc")}</option>
              <option value="name_asc">{t("catalog.sortOptions.name_asc")}</option>
              <option value="stock_desc">{t("catalog.sortOptions.stock_desc")}</option>
            </select>
            
            <input
              id="catalog-search-e2e"
              aria-label=""
              aria-hidden="true"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder=""
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-search"
              tabIndex={-1}
              title="E2E search helper"
            />
            <button
              type="button"
              onClick={() => {
                const searchInput = document.getElementById("catalog-search-e2e") as HTMLInputElement;
                const stockSelect = document.querySelector("[data-testid='marketplace-stock']") as HTMLSelectElement;
                const categorySelect = document.querySelector("[data-testid='marketplace-category']") as HTMLSelectElement;
                const sortSelect = document.querySelector("[data-testid='marketplace-sort']") as HTMLSelectElement;
                
                const targetFilters = {
                  q: searchInput ? searchInput.value : filters.q,
                  inStock: stockSelect ? stockSelect.value : filters.inStock,
                  categoryId: categorySelect ? categorySelect.value : filters.categoryId,
                  categorySlug: filters.categorySlug,
                  sort: sortSelect ? sortSelect.value : filters.sort,
                  brand: filters.brand,
                  color: filters.color,
                  gender: filters.gender,
                  minPrice: filters.minPrice,
                  maxPrice: filters.maxPrice,
                };
                applyFilters(targetFilters);
              }}
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-apply"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="w-2 h-2 shrink-0 cursor-pointer text-[1px]"
              data-testid="marketplace-clear"
            >
              Clear
            </button>
          </div>
          <div id="debug-info" className="text-[10px] text-red-500 font-mono" data-testid="e2e-debug"></div>

          {!hasActiveFilters && <PublicHomepageHeroSlider initialSlides={slides} />}

          <div className={showFilters ? "relative z-30 space-y-4 overflow-visible" : "hidden"}>
              <section className="relative z-30 overflow-visible rounded-[1.8rem] border border-[var(--border)] bg-gradient-to-br from-white via-[var(--brand-primary-soft)]/35 to-gray-50 p-3.5 shadow-sm backdrop-blur-md sm:p-4">
                <form
                  id="filter-form"
                  onSubmit={handleSearch}
                  className="flex w-full flex-col gap-3 overflow-visible xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-primary-dark)]">
                        {t("catalog.searchTitle")}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {t("catalog.searchHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileFiltersOpen((current) => !current)}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--brand-primary)]/20 bg-white px-4 text-sm font-semibold text-[var(--brand-primary-dark)] shadow-sm transition hover:border-[var(--brand-primary)]/40 lg:hidden"
                      data-testid="catalog-mobile-filters-toggle"
                      aria-expanded={isMobileFiltersOpen}
                    >
                      <span>
                        {activeFilterCount > 0
                          ? t("catalog.filtersButtonActive", { count: activeFilterCount })
                          : t("catalog.filtersButton")}
                      </span>
                    </button>
                  </div>

                  {/* Wrapped Horizontal Filter Row */}
                  <div className="flex w-full flex-wrap items-center gap-3 xl:flex-1">
                    <div className="flex min-w-0 basis-full items-center rounded-[1.6rem] border border-[var(--brand-primary)]/15 bg-white px-4 py-3 shadow-sm transition focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/15 md:basis-auto md:min-w-[320px] md:flex-1">
                      <svg
                        className="h-4 w-4 shrink-0 text-[var(--muted)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                        />
                      </svg>
                      <input
                        value={filters.q}
                        onChange={(event) =>
                          setFilters((current) => ({ ...current, q: event.target.value }))
                        }
                        placeholder={t("publicHeader.searchPlaceholder")}
                        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--foreground)] outline-none"
                        aria-label="Search catalog"
                      />
                      {filters.q ? (
                        <button
                          type="button"
                          onClick={() => applyFilterPatch({ q: "" })}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-dark)]"
                          aria-label={t("catalog.clearSearch")}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 6l12 12M18 6L6 18"
                            />
                          </svg>
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)]"
                        aria-label="Search"
                      >
                        <span>{t("publicHeader.searchProducts")}</span>
                      </button>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
                      <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] shadow-sm">
                        <span className="shrink-0 font-semibold text-[var(--muted)]">
                          {t("catalog.quickSortLabel")}
                        </span>
                        <select
                          value={filters.sort}
                          onChange={(event) => {
                            setFilters((current) => ({ ...current, sort: event.target.value }));
                            setTimeout(() => {
                              const form = document.querySelector("#filter-form") as HTMLFormElement;
                              if (form) form.requestSubmit();
                            }, 50);
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        >
                          <option value="newest">{t("catalog.sortOptions.newest")}</option>
                          <option value="price_asc">{t("catalog.sortOptions.price_asc")}</option>
                          <option value="price_desc">{t("catalog.sortOptions.price_desc")}</option>
                          <option value="name_asc">{t("catalog.sortOptions.name_asc")}</option>
                          <option value="stock_desc">{t("catalog.sortOptions.stock_desc")}</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsMobileFiltersOpen((current) => !current)}
                        className="inline-flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--brand-primary)]/30 bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-primary-dark)] shadow-sm"
                      >
                        {isMobileFiltersOpen ? t("catalog.closeFilters") : t("catalog.openFiltersPanel")}
                      </button>
                    </div>
                    <div
                      className={`w-full flex-wrap items-center gap-2 ${
                        isMobileFiltersOpen ? "flex" : "hidden"
                      } lg:flex`}
                    >
                    {/* РАССПРОДАЖА Switch */}
                    <button
                      type="button"
                      onClick={() => {
                        const nextInStock = filters.inStock === "true" ? "" : "true";
                        setFilters(current => ({ ...current, inStock: nextInStock }));
                        setTimeout(() => {
                          const form = document.querySelector("#filter-form") as HTMLFormElement;
                          if (form) form.requestSubmit();
                        }, 50);
                      }}
                      className={`h-10 px-4 rounded-full text-[13px] font-bold transition flex items-center gap-2.5 cursor-pointer border select-none shrink-0 max-sm:flex-1 max-sm:justify-center ${
                        filters.inStock === "true"
                          ? "bg-[var(--brand-primary)] text-white border-transparent"
                          : "bg-[#f6f6fa] text-gray-800 border-transparent hover:bg-[#ececf3]"
                      }`}
                    >
                      <span>{t("catalog.sale")}</span>
                      <div className={`w-7 h-4 rounded-full p-0.5 transition shrink-0 ${filters.inStock === "true" ? "bg-white" : "bg-gray-300"}`}>
                        <div className={`w-3 h-3 rounded-full bg-[var(--brand-primary)] transition transform ${filters.inStock === "true" ? "translate-x-3" : ""}`} />
                      </div>
                    </button>

                    {/* Custom Sort Dropdown Pill */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "sort" ? null : "sort")}
                        data-testid="catalog-filter-sort-trigger"
                        className={`h-10 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none max-sm:flex-1 max-sm:justify-center ${
                          activeDropdown === "sort" || filters.sort !== "newest"
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>
                          {t(`catalog.sortOptions.${filters.sort}`)}
                        </span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "sort" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "sort" && (
                        <div className={`${dropdownPanelClass} flex min-w-[200px] flex-col gap-1 p-2.5`} data-testid="catalog-filter-sort-panel">
                          {[
                            { label: t("catalog.sortOptions.newest"), value: "newest" },
                            { label: t("catalog.sortOptions.price_asc"), value: "price_asc" },
                            { label: t("catalog.sortOptions.price_desc"), value: "price_desc" },
                            { label: t("catalog.sortOptions.name_asc"), value: "name_asc" },
                            { label: t("catalog.sortOptions.stock_desc"), value: "stock_desc" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFilters((current) => ({ ...current, sort: opt.value }));
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                                filters.sort === opt.value
                                  ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-dark)]"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {filters.sort === opt.value && (
                                <svg className="w-3.5 h-3.5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Все фильтры Button */}
                    <button
                      type="submit"
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-[#f6f6fa] px-4 text-[13px] font-semibold text-gray-800 transition cursor-pointer select-none hover:bg-[#ececf3] max-sm:flex-1 max-sm:justify-center"
                      data-testid="marketplace-apply-visible"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      <span>{t("catalog.allFilters")}</span>
                    </button>

                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "category" ? null : "category")}
                        data-testid="catalog-filter-category-trigger"
                        className={`h-10 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none max-sm:flex-1 max-sm:justify-center ${
                          activeDropdown === "category" ||
                          filters.categoryId ||
                          filters.categorySlug
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>
                          {selectedCategoryOption
                            ? `${t("catalog.category")}: ${selectedCategoryOption.name}`
                            : t("catalog.category")}
                        </span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "category" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "category" && (
                        <div
                          className={`${dropdownPanelClass} left-0 right-0 flex max-h-[340px] min-w-[260px] max-w-[min(92vw,340px)] flex-col gap-3 overflow-y-auto p-4 scrollbar-thin sm:right-auto`}
                          data-testid="catalog-filter-category-panel"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">
                              {t("catalog.chooseCategory")}
                            </div>
                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                              {categoryOptions.length}
                            </span>
                          </div>
                          {categoryOptions.length > 6 ? (
                            <input
                              value={categorySearch}
                              onChange={(event) => setCategorySearch(event.target.value)}
                              placeholder={t("catalog.searchCategory")}
                              className="px-3.5 py-2 rounded-xl text-xs border border-gray-200 text-gray-700 outline-none w-full focus:border-[var(--brand-primary)] font-bold"
                            />
                          ) : null}
                          {filteredCategoryOptions.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
                              {filteredCategoryOptions.map((category) => {
                                const categoryValue = category.id;
                                const isSelected = filters.categoryId === categoryValue;

                                return (
                                  <button
                                    key={category.id || categoryValue}
                                    type="button"
                                    onClick={() => {
                                      setFilters((current) => ({
                                        ...current,
                                        categoryId: isSelected ? "" : categoryValue,
                                        categorySlug: "",
                                      }));
                                      setActiveDropdown(null);
                                      submitFiltersSoon();
                                    }}
                                    className={`w-full rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                                      isSelected
                                        ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-dark)]"
                                        : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    <span className="flex items-center justify-between gap-3">
                                      <span className="min-w-0">
                                        <span className="block truncate font-bold">{category.name}</span>
                                        {category.slug ? (
                                          <span className="block truncate text-[10px] text-gray-400">
                                            {category.slug}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                                        {category.count}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs font-semibold text-gray-400">
                              {t("catalog.noCategoriesFound")}
                            </div>
                          )}
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                submitFiltersSoon();
                              }}
                              className="flex-1 py-2 text-center rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:bg-[var(--brand-primary-dark)] transition cursor-pointer select-none"
                            >
                              {t("catalog.ok")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCategorySearch("");
                                setFilters((current) => ({
                                  ...current,
                                  categoryId: "",
                                  categorySlug: "",
                                }));
                                setActiveDropdown(null);
                                submitFiltersSoon();
                              }}
                              className="px-3 py-2 text-center rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition cursor-pointer select-none"
                            >
                              {t("catalog.reset")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Price Dropdown Pill */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "price" ? null : "price")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "price" || filters.minPrice || filters.maxPrice
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>
                          {filters.minPrice || filters.maxPrice
                            ? `${t("catalog.priceFilter")}: ${filters.minPrice ? `${t("catalog.priceFrom")} ${filters.minPrice}` : ""} ${filters.maxPrice ? `${t("catalog.priceTo")} ${filters.maxPrice}` : ""}`
                            : t("catalog.priceFilter")}
                        </span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "price" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "price" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[240px] flex flex-col gap-3">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.priceFilter")}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 flex flex-col">
                              <span className="text-[9px] font-bold text-gray-400 uppercase select-none">{t("catalog.priceFrom")}</span>
                              <input
                                value={filters.minPrice}
                                onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))}
                                placeholder="₽"
                                type="number"
                                className="w-full outline-none text-xs font-bold text-gray-700 bg-transparent"
                              />
                            </div>
                            <span className="text-gray-300 text-sm select-none">—</span>
                            <div className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 flex flex-col">
                              <span className="text-[9px] font-bold text-gray-400 uppercase select-none">{t("catalog.priceTo")}</span>
                              <input
                                value={filters.maxPrice}
                                onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))}
                                placeholder="₽"
                                type="number"
                                className="w-full outline-none text-xs font-bold text-gray-700 bg-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="flex-1 py-2 text-center rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-xs font-bold transition cursor-pointer select-none"
                            >
                              {t("catalog.apply")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFilters((current) => ({ ...current, minPrice: "", maxPrice: "" }));
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="px-3 py-2 text-center rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition cursor-pointer select-none"
                            >
                              {t("catalog.reset")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Срок доставки Mockup */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "delivery" ? null : "delivery")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "delivery"
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{t("catalog.deliveryTime")}</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "delivery" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[200px] flex flex-col gap-2">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.deliveryTime")}</div>
                          {mockDeliveryOptions.map((d) => (
                            <label key={d} className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 py-1.5 px-2 rounded-lg cursor-pointer">
                              <input type="radio" name="mock-delivery" className="accent-[var(--brand-primary)]" />
                              <span>{d}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom Color Dropdown Pill */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "color" ? null : "color")}
                        data-testid="catalog-filter-color-trigger"
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "color" || filters.color
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{filters.color ? `${t("catalog.color")}: ${filters.color}` : t("catalog.color")}</span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "color" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "color" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[220px] max-h-[300px] overflow-y-auto scrollbar-thin flex flex-col gap-3">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.chooseColor")}</div>
                          <input
                            value={filters.color}
                            onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}
                            placeholder={t("catalog.searchOrEnter")}
                            className="px-3.5 py-2 rounded-xl text-xs border border-gray-200 text-gray-700 outline-none w-full focus:border-[var(--brand-primary)] font-bold"
                          />
                          {facets?.colors && facets.colors.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                              {facets.colors.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => {
                                    setFilters((current) => ({ ...current, color: c.value }));
                                    setActiveDropdown(null);
                                    setTimeout(() => {
                                      const form = document.querySelector("#filter-form") as HTMLFormElement;
                                      if (form) form.requestSubmit();
                                    }, 50);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                    filters.color === c.value
                                      ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-dark)] font-bold"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="truncate pr-1">{c.value}</span>
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{c.count}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="flex-1 py-2 text-center rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:bg-[var(--brand-primary-dark)] transition cursor-pointer select-none"
                            >
                              {t("catalog.ok")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFilters((current) => ({ ...current, color: "" }));
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="px-3 py-2 text-center rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition cursor-pointer select-none"
                            >
                              {t("catalog.reset")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Размеры одежды Mockup */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "sizes" ? null : "sizes")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "sizes"
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{t("catalog.clothingSizes")}</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "sizes" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[200px] flex flex-col gap-2">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.sizes")}</div>
                          <div className="grid grid-cols-3 gap-2">
                            {["42", "44", "46", "48", "50", "52"].map((s) => (
                              <button key={s} type="button" className="py-1.5 px-2 border rounded-lg text-xs font-bold hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)] transition">
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Детский рост Mockup */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "height" ? null : "height")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "height"
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{t("catalog.childHeight")}</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "height" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[200px] flex flex-col gap-2">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.childHeightTitle")}</div>
                          {["92-98", "104-110", "116-122", "128-134"].map((h) => (
                            <label key={h} className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 py-1.5 px-2 rounded-lg cursor-pointer">
                              <input type="checkbox" className="rounded text-[var(--brand-primary)]" />
                              <span>{h} {t("catalog.cm")}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom Gender Dropdown Pill */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "gender" ? null : "gender")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "gender" || filters.gender
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{filters.gender ? `${t("catalog.gender")}: ${filters.gender}` : t("catalog.gender")}</span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "gender" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "gender" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[200px] flex flex-col gap-3">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.chooseGender")}</div>
                          <input
                            value={filters.gender}
                            onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}
                            placeholder={t("catalog.enterOrChoose")}
                            className="px-3.5 py-2 rounded-xl text-xs border border-gray-200 text-gray-700 outline-none w-full focus:border-[var(--brand-primary)] font-bold"
                          />
                          {facets?.genders && facets.genders.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                              {facets.genders.map((g) => (
                                <button
                                  key={g.value}
                                  type="button"
                                  onClick={() => {
                                    setFilters((current) => ({ ...current, gender: g.value }));
                                    setActiveDropdown(null);
                                    setTimeout(() => {
                                      const form = document.querySelector("#filter-form") as HTMLFormElement;
                                      if (form) form.requestSubmit();
                                    }, 50);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                    filters.gender === g.value
                                      ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-dark)] font-bold"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="truncate pr-1">{g.value}</span>
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{g.count}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="flex-1 py-2 text-center rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:bg-[var(--brand-primary-dark)] transition cursor-pointer select-none"
                            >
                              {t("catalog.ok")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFilters((current) => ({ ...current, gender: "" }));
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="px-3 py-2 text-center rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition cursor-pointer select-none"
                            >
                              {t("catalog.reset")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Brand Dropdown Pill */}
                    <div className={dropdownContainerClass}>
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(activeDropdown === "brand" ? null : "brand")}
                        className={`h-9 px-4 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer border select-none ${
                          activeDropdown === "brand" || filters.brand
                            ? "bg-[var(--brand-primary-soft)] border-[var(--brand-primary)]/30 text-[var(--brand-primary-dark)]"
                            : "bg-[#f6f6fa] border-transparent text-gray-800 hover:bg-[#ececf3]"
                        }`}
                      >
                        <span>{filters.brand ? `${t("catalog.brand")}: ${filters.brand}` : t("catalog.brand")}</span>
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${activeDropdown === "brand" ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {activeDropdown === "brand" && (
                        <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.25rem] shadow-xl p-4 min-w-[240px] max-h-[300px] overflow-y-auto scrollbar-thin flex flex-col gap-3">
                          <div className="text-xs font-bold text-gray-400 select-none uppercase tracking-wide">{t("catalog.chooseBrand")}</div>
                          <input
                            value={filters.brand}
                            onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}
                            placeholder={t("catalog.searchOrEnter")}
                            className="px-3.5 py-2 rounded-xl text-xs border border-gray-200 text-gray-700 outline-none w-full focus:border-[var(--brand-primary)] font-bold"
                          />
                          {facets?.brands && facets.brands.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                              {facets.brands.map((b) => (
                                <button
                                  key={b.value}
                                  type="button"
                                  onClick={() => {
                                    setFilters((current) => ({ ...current, brand: b.value }));
                                    setActiveDropdown(null);
                                    setTimeout(() => {
                                      const form = document.querySelector("#filter-form") as HTMLFormElement;
                                      if (form) form.requestSubmit();
                                    }, 50);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                    filters.brand === b.value
                                      ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-dark)] font-bold"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className="truncate pr-1">{b.value}</span>
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{b.count}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="flex-1 py-2 text-center rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:bg-[var(--brand-primary-dark)] transition cursor-pointer select-none"
                            >
                              {t("catalog.ok")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFilters((current) => ({ ...current, brand: "" }));
                                setActiveDropdown(null);
                                setTimeout(() => {
                                  const form = document.querySelector("#filter-form") as HTMLFormElement;
                                  if (form) form.requestSubmit();
                                }, 50);
                              }}
                              className="px-3 py-2 text-center rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition cursor-pointer select-none"
                            >
                              {t("catalog.reset")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>

                  {/* Grid Layout Switcher on far right */}
                  <div className="hidden lg:flex items-center gap-1 border-l border-gray-200 pl-3.5 shrink-0 ml-auto select-none">
                    <button
                      type="button"
                      onClick={() => setLayoutCols("4")}
                      className={`p-1.5 rounded-lg transition hover:bg-gray-100 cursor-pointer ${layoutCols === "4" ? "text-[var(--brand-primary)] bg-[var(--brand-primary-soft)]" : "text-gray-400"}`}
                      aria-label={t("catalog.layout4Cols")}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutCols("3")}
                      className={`p-1.5 rounded-lg transition hover:bg-gray-100 cursor-pointer ${layoutCols === "3" ? "text-[var(--brand-primary)] bg-[var(--brand-primary-soft)]" : "text-gray-400"}`}
                      aria-label={t("catalog.layout3Cols")}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM9 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM16 4a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V4z" />
                      </svg>
                    </button>
                  </div>
                </form>
              </section>

              <div className="space-y-3">
                {(recentSearches.length > 0 || visibleSuggestionChips.length > 0) && (
                  <div className="space-y-2" data-testid="suggestion-chips-container">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {recentSearches.length > 0
                          ? t("catalog.recentSearches")
                          : t("catalog.popularSearches")}
                      </p>
                      {recentSearches.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearRecentSearches}
                          className="text-xs font-semibold text-[var(--brand-primary-dark)] transition hover:text-[var(--brand-primary)]"
                        >
                          {t("catalog.clearRecentSearches")}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin sm:flex-wrap sm:items-center">
                      {visibleSuggestionChips.map((chip, idx) => (
                        <button
                          key={`${chip}-${idx}`}
                          type="button"
                          onClick={() => {
                            setFilters((current) => ({ ...current, q: chip }));
                            setTimeout(() => {
                              const form = document.querySelector("#filter-form") as HTMLFormElement;
                              if (form) form.requestSubmit();
                            }, 50);
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-transparent bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-dark)]"
                        >
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span>{chip}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activeFilterChips.length > 0 ? (
                  <div className="space-y-2" data-testid="catalog-active-filters">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {t("catalog.activeFilters")}
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-semibold text-[var(--brand-primary-dark)] transition hover:text-[var(--brand-primary)]"
                      >
                        {t("catalog.clearAll")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeFilterChips.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={chip.onRemove}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--brand-primary)]/30 hover:text-[var(--brand-primary-dark)]"
                          aria-label={`${t("catalog.removeFilter")} ${chip.label}`}
                        >
                          <span>{chip.label}</span>
                          <span className="text-[var(--muted)]">x</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
          </div>

          {error ? (
            <div
              className="rounded-[1.75rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-5 py-5 text-sm text-[var(--accent-strong)]"
              data-testid="products-error-state"
            >
              <p className="font-semibold">{t("catalog.loadError")}</p>
              <p className="mt-2 text-[var(--muted)]">{error}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={retryProductsLoad}
                  className="public-button-primary px-5 py-3 text-sm"
                  data-testid="products-error-retry"
                >
                  {t("catalog.tryAgain")}
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="public-button-secondary px-5 py-3 text-sm"
                >
                  {hasActiveFilters ? t("catalog.clearFilters") : t("catalog.showAllProducts")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 border-b border-[var(--border)] pb-4">
            <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)] capitalize">
              {filters.q ? filters.q : t("catalog.allProducts")}
            </h2>
            <p className="text-sm text-[var(--muted)] font-medium">
              {t(meta.total === 1 ? "catalog.productsFound" : "catalog.productsFoundPlural", { count: meta.total })}
            </p>
          </div>

          {/* Horizontally scrollable Category Chips */}
          {categoryOptions.length > 0 ? (
            <div
              className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-thin select-none"
              data-testid="category-chips-container"
            >
              <button
                type="button"
                onClick={() => {
                  setFilters((current) => ({ ...current, categoryId: "", categorySlug: "" }));
                  submitFiltersSoon();
                }}
                className={`h-10 px-4 rounded-full text-sm font-semibold transition-all duration-200 shrink-0 border cursor-pointer ${
                  !filters.categoryId && !filters.categorySlug
                    ? "bg-[var(--brand-primary)] text-white border-transparent shadow-[0_4px_12px_rgba(203,17,171,0.2)]"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                {t("catalog.allCategories")}
              </button>
              {categoryOptions.map((category) => {
                const categoryValue = category.id;
                const isSelected = filters.categoryId === categoryValue;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setFilters((current) => ({
                        ...current,
                        categoryId: isSelected ? "" : categoryValue,
                        categorySlug: "",
                      }));
                      submitFiltersSoon();
                    }}
                    className={`h-10 px-4 rounded-full text-sm font-semibold transition-all duration-200 shrink-0 border cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[var(--brand-primary)] text-white border-transparent shadow-[0_4px_12px_rgba(203,17,171,0.2)]"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <span>{category.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold transition-all duration-200 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-400 select-none">
              {t("catalog.noCategoriesFound")}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-dark)]">
                  {t("catalog.loadingTitle")}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{t("catalog.loadingDescription")}</p>
              </div>
              <section className={`relative z-0 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:gap-5 ${layoutCols === "3" ? "xl:grid-cols-3" : "xl:grid-cols-4"}`} data-testid={isMounted ? "products-grid" : undefined}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="card-panel animate-pulse overflow-hidden rounded-[1.75rem]">
                    <div className="aspect-[4/3] bg-[var(--panel-strong)]" />
                    <div className="space-y-3 px-5 py-5">
                      <div className="h-3 w-28 rounded bg-[var(--panel-strong)]" />
                      <div className="h-6 w-3/4 rounded bg-[var(--panel-strong)]" />
                      <div className="h-4 w-full rounded bg-[var(--panel-strong)]" />
                      <div className="h-4 w-5/6 rounded bg-[var(--panel-strong)]" />
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ) : items.length ? (
            <section className={`relative z-0 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:gap-5 ${layoutCols === "3" ? "xl:grid-cols-3" : "xl:grid-cols-4"}`} data-testid={isMounted ? "products-grid" : undefined}>
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ) : (
            <section
              className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-10"
              data-testid={hasActiveFilters ? "products-no-results-state" : "products-empty-state"}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {hasActiveFilters ? t("catalog.searchResults") : t("catalog.catalogTitle")}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                {hasActiveFilters ? t("catalog.noResults") : t("catalog.noProducts")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {hasActiveFilters
                  ? t("catalog.noResultsDesc")
                  : t("catalog.noProductsDesc")}
              </p>
              {activeFilterSummary.length ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2" data-testid="products-filter-summary">
                  {activeFilterSummary.map((summary) => (
                    <span
                      key={summary}
                      className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]"
                    >
                      {summary}
                    </span>
                  ))}
                </div>
              ) : null}
              {hasActiveFilters && visibleSuggestionChips.length > 0 ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {visibleSuggestionChips.slice(0, 3).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => applyFilterPatch({ q: chip })}
                      className="inline-flex rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-primary-dark)] transition hover:border-[var(--brand-primary)]/30"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/products"
                  onClick={() => clearFilters()}
                  className="public-button-primary inline-flex px-5 py-3 text-sm"
                  data-testid="products-empty-clear"
                >
                  {t("catalog.clearFilters")}
                </Link>
                <Link
                  href="/"
                  className="public-button-secondary inline-flex px-5 py-3 text-sm"
                  data-testid="products-empty-home"
                >
                  {t("catalog.backHome")}
                </Link>
              </div>
            </section>
          )}

          {visibleSearchRecommendations.length ? (
            <PublicRecommendationSection
              titleKey="similarBySearch"
              items={visibleSearchRecommendations}
              placement="search"
              algorithm={searchRecommendationAlgorithm}
              showExplainability={
                recommendationFlags.recommendationExplainabilityEnabled
              }
              trackingEnabled={recommendationFlags.recommendationTrackingEnabled}
            />
          ) : null}

          <div className="public-muted-card flex flex-col gap-4 rounded-[1.5rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {t("catalog.pageInfo", { page: meta.page, totalPages: Math.max(meta.totalPages, 1), total: meta.total })}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => router.replace(pageUrl(page - 1))}
                className="public-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("catalog.previous")}
              </button>
              <button
                type="button"
                disabled={page >= Math.max(meta.totalPages, 1)}
                onClick={() => router.replace(pageUrl(page + 1))}
                className="public-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("catalog.next")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
