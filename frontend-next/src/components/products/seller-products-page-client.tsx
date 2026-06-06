"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import {
  bulkUpdateShopProducts,
  createSellerShop,
  deleteShopProduct,
  getShopProductById,
  getShopProducts,
  saveWbSyncCredentials,
  updateShopProduct,
  updateShopProductInventory,
  type BulkProductVariantMode,
  type ProductListItem,
} from "@/lib/seller-api";
import { getCategories, type PublicCategory } from "@/lib/public-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { toast } from "@/components/ui/use-toast";
import { useI18n } from "@/i18n/use-i18n";

const PAGE_SIZE = 10;

type CatalogTab = "ALL" | "LIVE" | "NEEDS_INFO" | "OUT_OF_STOCK" | "MISSING_PRICE" | "MISSING_CATEGORY" | "MISSING_IMAGE" | "DELETED";
type BulkEditMode = "CATEGORY" | "PRICE" | "STOCK" | null;

export function SellerProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);

  const catalogTabs = useMemo(
    () => [
      { id: "ALL" as const, label: t("seller.products.tabs.all") },
      { id: "LIVE" as const, label: t("seller.products.tabs.live") },
      { id: "NEEDS_INFO" as const, label: t("seller.products.tabs.needsInfo") },
      { id: "OUT_OF_STOCK" as const, label: t("seller.products.tabs.outOfStock") },
      { id: "MISSING_PRICE" as const, label: t("seller.products.tabs.missingPrice") },
      { id: "MISSING_CATEGORY" as const, label: t("seller.products.tabs.missingCategory") },
      { id: "MISSING_IMAGE" as const, label: t("seller.products.tabs.missingImage") },
      { id: "DELETED" as const, label: t("seller.products.tabs.deleted") },
    ],
    [t],
  );

  const [shopForm, setShopForm] = useState({ name: "", apiKey: "" });
  const [filters, setFilters] = useState({
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
    stockStatus: searchParams.get("stockStatus") ?? "",
    tab: (searchParams.get("tab") as CatalogTab | null) ?? "ALL",
  });
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, setState] = useState<{
    items: Awaited<ReturnType<typeof getShopProducts>>["items"];
    meta: Awaited<ReturnType<typeof getShopProducts>>["meta"] | null;
    loading: boolean;
    error: string | null;
  }>({ items: [], meta: null, loading: false, error: null });
  const { run: runShop, isRunning: creatingShop } = useActionFeedback();
  const { run: runBulk, isRunning: bulkSaving } = useActionFeedback();
  const { run: runProductAction } = useActionFeedback();
  const [bulkEditMode, setBulkEditMode] = useState<BulkEditMode>(null);
  const [bulkForm, setBulkForm] = useState({
    categoryId: "",
    price: "",
    stockQuantity: "",
    trackInventory: true,
    variantMode: "MISSING_ONLY" as BulkProductVariantMode,
  });
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<Awaited<ReturnType<typeof bulkUpdateShopProducts>> | null>(null);

  const totalPages = useMemo(() => state.meta?.totalPages ?? 0, [state.meta]);
  const allCategories = useMemo(() => flattenCategories(categories), [categories]);
  const selectedProducts = useMemo(() => state.items.filter((item) => selectedIds.includes(item.id)), [selectedIds, state.items]);

  useEffect(() => {
    setFilters({
      search: searchParams.get("search") ?? "",
      status: searchParams.get("status") ?? "",
      stockStatus: searchParams.get("stockStatus") ?? "",
      tab: (searchParams.get("tab") as CatalogTab | null) ?? "ALL",
    });
    setPage(Number(searchParams.get("page") ?? "1"));
  }, [searchParams]);

  const listQuery = useMemo(() => {
    const tabQuery: Parameters<typeof getShopProducts>[1] = {
      page,
      size: PAGE_SIZE,
      search: filters.search || undefined,
      status: filters.status || undefined,
      stockStatus: (filters.stockStatus || undefined) as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | undefined,
    };

    switch (filters.tab) {
      case "LIVE":
        tabQuery.publicVisible = true;
        break;
      case "NEEDS_INFO":
        tabQuery.needsReview = true;
        break;
      case "OUT_OF_STOCK":
        tabQuery.stockStatus = "OUT_OF_STOCK";
        break;
      case "MISSING_PRICE":
        tabQuery.missingPrice = true;
        break;
      case "MISSING_CATEGORY":
        tabQuery.missingCategory = true;
        break;
      case "MISSING_IMAGE":
        tabQuery.missingImage = true;
        break;
      case "DELETED":
        tabQuery.visibility = "DELETED";
        delete tabQuery.status;
        break;
      default:
        break;
    }

    return tabQuery;
  }, [filters.search, filters.status, filters.stockStatus, filters.tab, page]);

  const loadProducts = useCallback(async () => {
    if (!user || !currentShopId) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await getShopProducts(currentShopId, listQuery, "");
      setState({ items: response.items, meta: response.meta, loading: false, error: null });
      setSelectedIds((current) => current.filter((productId) => response.items.some((item) => item.id === productId)));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : t("seller.products.messages.updateFailed"),
      }));
    }
  }, [currentShopId, listQuery, t, user]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((items) => {
        if (mounted) {
          setCategories(items);
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stockCounts = useMemo(
    () => ({
      tracked: state.items.filter((item) => item.trackInventory).length,
      lowStock: state.items.filter((item) => item.stockStatus === "LOW_STOCK").length,
      outOfStock: state.items.filter((item) => item.stockStatus === "OUT_OF_STOCK").length,
    }),
    [state.items],
  );

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.stockStatus) params.set("stockStatus", filters.stockStatus);
    if (filters.tab !== "ALL") params.set("tab", filters.tab);
    params.set("page", "1");
    router.replace(`/seller/products?${params.toString()}`);
  };

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.stockStatus) params.set("stockStatus", filters.stockStatus);
    if (filters.tab !== "ALL") params.set("tab", filters.tab);
    params.set("page", String(nextPage));
    router.replace(`/seller/products?${params.toString()}`);
  };

  const handleQuickUpdate = async (product: ProductListItem, stockQuantity: number, price?: number) => {
    if (!currentShopId) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const detail = await getShopProductById(currentShopId, product.id, "");
        const primaryVariant = detail.variants[0];
        if (!primaryVariant) {
          throw new Error(t("seller.products.messages.noVariant"));
        }

        await updateShopProductInventory(currentShopId, product.id, {
          variantId: primaryVariant.id,
          stockQuantity,
        });

        if (price !== undefined) {
          await updateShopProduct(currentShopId, product.id, {
            variants: [{ chrtId: Number(primaryVariant.chrtId), basePrice: price, discountPrice: price }],
          });
        }

        const updatedProduct = await getShopProductById(currentShopId, product.id, "");
        await loadProducts();
        return updatedProduct;
      },
      onSuccess: (updatedProduct) => {
        if (updatedProduct.variants[0] && updatedProduct.variants[0].stockQuantity <= 0) {
          toast.success(t("seller.products.messages.hiddenOutOfStock"));
        } else if (updatedProduct.publicVisible && !product.publicVisible) {
          toast.success(t("seller.products.messages.publishedReady"));
        } else {
          toast.success(t("seller.products.messages.updatedPriceStock"));
        }
      },
      errorMessage: t("seller.products.messages.updateFailed"),
    }).catch((error) => {
      setState((current) => ({ ...current, loading: false, error: error.message }));
      throw error;
    });
  };

  const handleDelete = async (productId: string) => {
    if (!currentShopId) {
      return;
    }
    const confirmed = window.confirm(t("common.confirm.deleteProduct"));
    if (!confirmed) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const res = await deleteShopProduct(currentShopId, productId);
        await loadProducts();
        return res;
      },
      successMessage: t("seller.products.messages.deleted"),
      errorMessage: t("seller.products.messages.deleteFailed"),
    }).catch((error) => {
      setState((current) => ({ ...current, loading: false, error: error.message }));
      throw error;
    });
  };

  const handleBulkUpdate = async () => {
    if (!currentShopId || selectedIds.length < 1 || !bulkEditMode) {
      return;
    }

    const updates: { categoryId?: number; price?: number; stockQuantity?: number; trackInventory?: boolean } = {};

    if (bulkEditMode === "CATEGORY") {
      if (!bulkForm.categoryId) {
        setBulkError(t("seller.products.bulk.categoryRequired"));
        return;
      }
      updates.categoryId = Number(bulkForm.categoryId);
    }

    if (bulkEditMode === "PRICE") {
      const price = Number(bulkForm.price);
      if (!Number.isFinite(price) || price <= 0) {
        setBulkError(t("seller.products.bulk.pricePositive"));
        return;
      }
      updates.price = price;
    }

    if (bulkEditMode === "STOCK") {
      const stockQuantity = Number(bulkForm.stockQuantity);
      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        setBulkError(t("seller.products.bulk.stockNonNegative"));
        return;
      }
      updates.stockQuantity = stockQuantity;
      updates.trackInventory = bulkForm.trackInventory;
    }

    setBulkMessage(null);
    setBulkError(null);

    await runBulk({
      action: async () => {
        const result = await bulkUpdateShopProducts(currentShopId, {
          productIds: selectedIds,
          updates,
          scope: { variantMode: bulkForm.variantMode },
          publishIfReady: true,
        });
        setBulkResult(result);
        setBulkMessage(t("seller.products.bulk.complete", { updated: result.updated, failed: result.failed }));
        await loadProducts();
        return result;
      },
      successMessage: t("seller.products.messages.bulkSaved"),
      errorMessage: t("seller.products.messages.bulkFailed"),
    }).catch((error) => {
      setBulkError(error.message);
    });
  };

  const handleCreateShop = async () => {
    setCreateMessage(null);
    setCreateError(null);
    await runShop({
      action: async () => {
        const trimmedName = shopForm.name.trim();
        const trimmedApiKey = shopForm.apiKey.trim();
        const created = await createSellerShop({
          name: trimmedName,
          slug: buildShopSlug(trimmedName),
          paymentInstructions: "Manual transfer after checkout. Seller confirms payment proof in seller center.",
        });

        await saveWbSyncCredentials(created.id, trimmedApiKey);
        await loadShops();
        selectShop(created.id);
        setCreateMessage(t("seller.products.messages.shopCreatedNamed", { name: created.name }));
        setShopForm({ name: "", apiKey: "" });
        router.refresh();
        return created;
      },
      successMessage: t("seller.products.messages.shopCreated"),
      errorMessage: t("seller.products.messages.shopCreateFailed"),
    }).catch((error) => {
      setCreateError(error.message);
    });
  };

  return (
    <div className="space-y-6" data-testid="seller-products-page">
      <SectionCard eyebrow={t("seller.products.catalog")} title={t("seller.products.title")} description={t("seller.products.subtitle")}>
        <div className="space-y-5">
          {createMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createMessage}</div> : null}
          {createError ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{createError}</div> : null}

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5" data-testid="create-shop-panel">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {currentShopId ? t("seller.products.addAnotherShop") : t("seller.products.createFirstShop")}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                  <span>{t("seller.products.shopName")}</span>
                  <input value={shopForm.name} onChange={(event) => setShopForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="create-shop-name" />
                </label>
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                  <span>{t("seller.products.shopApiKey")}</span>
                  <input value={shopForm.apiKey} onChange={(event) => setShopForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={t("seller.wbSync.apiKeyPlaceholder")} type="password" className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="create-shop-api-key" />
                </label>
                <button type="button" onClick={() => void handleCreateShop()} disabled={creatingShop || !shopForm.name.trim() || !shopForm.apiKey.trim()} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="create-shop-submit">
                  {creatingShop ? t("common.loading") : t("seller.products.addShop")}
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {t("seller.products.shopCreateHelper")}
              </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {catalogTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setFilters((current) => ({ ...current, tab: tab.id }))} className={filters.tab === tab.id ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"}>
                {tab.label}
              </button>
            ))}
          </div>

          <ProductFilters value={filters} onChange={(value) => setFilters((current) => ({ ...current, search: value.search, status: value.status, stockStatus: value.stockStatus }))} onSubmit={applyFilters} />

          <div className="grid gap-4 sm:grid-cols-3">
            <InventorySummaryCard label={t("seller.products.summary.tracked")} value={String(stockCounts.tracked)} tone="neutral" />
            <InventorySummaryCard label={t("seller.products.summary.lowStockPage")} value={String(stockCounts.lowStock)} tone={stockCounts.lowStock > 0 ? "warn" : "ok"} />
            <InventorySummaryCard label={t("seller.products.summary.outOfStockPage")} value={String(stockCounts.outOfStock)} tone={stockCounts.outOfStock > 0 ? "danger" : "ok"} />
          </div>

          {currentShopId ? (
            <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4" data-testid="bulk-edit-toolbar">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.products.bulk.selected", { count: selectedIds.length })}</span>
                <button type="button" onClick={() => setBulkEditMode("CATEGORY")} disabled={selectedIds.length < 1} className={bulkEditMode === "CATEGORY" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"} data-testid="bulk-open-category">
                  {t("seller.products.bulk.setCategory")}
                </button>
                <button type="button" onClick={() => setBulkEditMode("PRICE")} disabled={selectedIds.length < 1} className={bulkEditMode === "PRICE" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"} data-testid="bulk-open-price">
                  {t("seller.products.bulk.setPrice")}
                </button>
                <button type="button" onClick={() => setBulkEditMode("STOCK")} disabled={selectedIds.length < 1} className={bulkEditMode === "STOCK" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"} data-testid="bulk-open-stock">
                  {t("seller.products.bulk.setStock")}
                </button>
              </div>

              {bulkEditMode ? (
                <div className="grid gap-4 rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                    {bulkEditMode === "CATEGORY" ? (
                      <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                        <span>{t("seller.products.internalCategory")}</span>
                        <select value={bulkForm.categoryId} onChange={(event) => setBulkForm((current) => ({ ...current, categoryId: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="bulk-category-select">
                          <option value="">{t("seller.products.bulk.selectCategory")}</option>
                          {allCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    {bulkEditMode === "PRICE" ? (
                      <CreateInput label={t("seller.products.price")} type="number" value={bulkForm.price} onChange={(value) => setBulkForm((current) => ({ ...current, price: value }))} testId="bulk-price-input" />
                    ) : null}

                    {bulkEditMode === "STOCK" ? (
                      <>
                        <CreateInput label={t("seller.products.bulk.stockQuantity")} type="number" value={bulkForm.stockQuantity} onChange={(value) => setBulkForm((current) => ({ ...current, stockQuantity: value }))} testId="bulk-stock-input" />
                        <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                          <input type="checkbox" checked={bulkForm.trackInventory} onChange={(event) => setBulkForm((current) => ({ ...current, trackInventory: event.target.checked }))} />
                          {t("seller.products.bulk.trackInventory")}
                        </label>
                      </>
                    ) : null}

                    <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                      <span>{t("seller.products.bulk.variantMode")}</span>
                      <select value={bulkForm.variantMode} onChange={(event) => setBulkForm((current) => ({ ...current, variantMode: event.target.value as BulkProductVariantMode }))} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="bulk-variant-mode">
                        <option value="ALL_VARIANTS">{t("seller.products.bulk.allVariants")}</option>
                        <option value="MISSING_ONLY">{t("seller.products.bulk.missingOnly")}</option>
                        <option value="FIRST_VARIANT_ONLY">{t("seller.products.bulk.firstVariantOnly")}</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-end justify-end gap-3">
                    <button type="button" onClick={() => setBulkEditMode(null)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                      {t("common.actions.close")}
                    </button>
                    <button type="button" onClick={() => void handleBulkUpdate()} disabled={bulkSaving || selectedIds.length < 1} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="bulk-apply-submit">
                      {bulkSaving ? t("common.loading") : t("seller.products.bulk.apply")}
                    </button>
                  </div>
                </div>
              ) : null}

              {bulkMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{bulkMessage}</div> : null}
              {bulkError ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{bulkError}</div> : null}
              {bulkResult ? (
                <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4" data-testid="bulk-edit-result">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                    <span>{t("common.status.updated")}: {bulkResult.updated}</span>
                    <span>{t("common.status.failed")}: {bulkResult.failed}</span>
                    <span>{t("seller.products.bulk.pageSelected", { count: selectedProducts.length })}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {bulkResult.items.map((item) => (
                      <div key={item.productId} className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-[var(--foreground)]">{item.productId}</span>
                          <span className={item.success ? "text-emerald-700" : "text-rose-700"}>{item.success ? t("common.status.updated") : t("common.status.failed")}</span>
                          {item.readiness ? <span className="text-[var(--muted)]">{item.readiness.catalogStatus} | {item.readiness.ready ? t("common.status.ready") : t("common.status.needsReview")}</span> : null}
                        </div>
                        {item.error ? <p className="mt-2 text-rose-700">{item.error}</p> : null}
                        {item.readiness && item.readiness.blockingReasons.length > 0 ? <p className="mt-2 text-[var(--muted)]">{item.readiness.blockingReasons.join(", ")}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {state.error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{state.error}</div> : null}

          {currentShopId ? (
            <>
              {state.loading ? (
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">{t("seller.products.results.loading")}</div>
              ) : (
                <ProductTable
                  products={state.items}
                  selectedIds={selectedIds}
                  onToggleSelect={(productId) => setSelectedIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId])}
                  onToggleSelectAll={() => setSelectedIds((current) => state.items.every((item) => current.includes(item.id)) ? [] : state.items.map((item) => item.id))}
                  onEdit={(productId) => router.push(`/seller/products/${productId}`)}
                  onQuickUpdate={handleQuickUpdate}
                  onDelete={handleDelete}
                />
              )}
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  {state.meta ? t("seller.products.results.showing", { page: state.meta.page, totalPages: Math.max(state.meta.totalPages, 1), total: state.meta.total }) : t("seller.products.results.noData")}
                </p>
                <div className="flex gap-3">
                  <button type="button" disabled={page <= 1 || state.loading} onClick={() => handlePageChange(page - 1)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                    {t("common.actions.back")}
                  </button>
                  <button type="button" disabled={state.loading || totalPages === 0 || page >= totalPages} onClick={() => handlePageChange(page + 1)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50">
                    {t("common.actions.next")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
              {t("seller.products.results.pickShop")}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function InventorySummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "ok" | "warn" | "danger";
}) {
  const colorClass = tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "danger" ? "text-rose-700" : "text-[var(--foreground)]";

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

function flattenCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function CreateInput({
  label,
  value,
  onChange,
  testId,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid={testId} />
    </label>
  );
}
  const buildShopSlug = (name: string) => {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return base.length >= 3 ? `${base}-${Date.now().toString().slice(-6)}` : `shop-${Date.now().toString().slice(-8)}`;
  };
