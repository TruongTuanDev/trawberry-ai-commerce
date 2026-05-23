"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import {
  archiveShopProduct,
  bulkShopProductAction,
  bulkUpdateShopProducts,
  createSellerShop,
  createShopProduct,
  getShopProducts,
  publishShopProduct,
  unpublishShopProduct,
  updateShopProductInventory,
  type BulkProductVariantMode,
  type ProductListItem,
} from "@/lib/seller-api";
import { getCategories, type PublicCategory } from "@/lib/public-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const PAGE_SIZE = 10;

const catalogTabs = [
  { id: "ALL", label: "All" },
  { id: "IMPORTED", label: "Imported" },
  { id: "NEEDS_REVIEW", label: "Needs review" },
  { id: "READY", label: "Ready to publish" },
  { id: "PUBLISHED", label: "Published" },
  { id: "UNPUBLISHED", label: "Unpublished" },
  { id: "ARCHIVED", label: "Archived" },
  { id: "MISSING_PRICE", label: "Missing price" },
  { id: "MISSING_STOCK", label: "Missing stock" },
  { id: "MISSING_CATEGORY", label: "Missing category" },
] as const;

type CatalogTab = (typeof catalogTabs)[number]["id"];
type BulkEditMode = "CATEGORY" | "PRICE" | "STOCK" | null;

export function SellerProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);

  const [shopForm, setShopForm] = useState({ name: "", slug: "" });
  const [productForm, setProductForm] = useState({
    title: "",
    description: "",
    brand: "",
    categoryId: "",
    categoryName: "",
    price: "100",
    stockQuantity: "5",
  });
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
  }>({
    items: [],
    meta: null,
    loading: false,
    error: null,
  });
  const { run: runShop, isRunning: creatingShop } = useActionFeedback();
  const { run: runCreate, isRunning: creatingProduct } = useActionFeedback();
  const { run: runBulk, isRunning: bulkSaving } = useActionFeedback();
  const { run: runProductAction } = useActionFeedback();
  const [bulkEditMode, setBulkEditMode] = useState<BulkEditMode>(null);
  const [bulkForm, setBulkForm] = useState({
    categoryId: "",
    price: "",
    stockQuantity: "",
    trackInventory: true,
    variantMode: "MISSING_ONLY" as BulkProductVariantMode,
    publishIfReady: false,
  });
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<Awaited<ReturnType<typeof bulkUpdateShopProducts>> | null>(null);

  const totalPages = useMemo(() => state.meta?.totalPages ?? 0, [state.meta]);
  const allCategories = useMemo(() => flattenCategories(categories), [categories]);
  const selectedProducts = useMemo(
    () => state.items.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, state.items],
  );

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
      case "IMPORTED":
        tabQuery.catalogStatus = "IMPORTED";
        break;
      case "NEEDS_REVIEW":
        tabQuery.needsReview = true;
        break;
      case "READY":
        tabQuery.readyToPublish = true;
        break;
      case "PUBLISHED":
        tabQuery.published = true;
        break;
      case "UNPUBLISHED":
        tabQuery.catalogStatus = "UNPUBLISHED";
        break;
      case "ARCHIVED":
        tabQuery.catalogStatus = "ARCHIVED";
        break;
      case "MISSING_PRICE":
        tabQuery.missingPrice = true;
        break;
      case "MISSING_STOCK":
        tabQuery.missingStock = true;
        break;
      case "MISSING_CATEGORY":
        tabQuery.missingCategory = true;
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
      setState({
        items: response.items,
        meta: response.meta,
        loading: false,
        error: null,
      });
      setSelectedIds((current) =>
        current.filter((productId) => response.items.some((item) => item.id === productId)),
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load products.",
      }));
    }
  }, [currentShopId, listQuery, user]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((items) => {
        if (mounted) setCategories(items);
      })
      .catch(() => {
        if (mounted) setCategories([]);
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

  const handleQuickUpdate = async (product: ProductListItem, stockQuantity: number) => {
    if (!currentShopId) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const res = await updateShopProductInventory(currentShopId, product.id, {
          variantId: product.primaryVariantId ?? undefined,
          stockQuantity,
        });
        await loadProducts();
        return res;
      },
      successMessage: "Cập nhật kho hàng thành công!",
      errorMessage: "Không thể cập nhật kho hàng.",
    }).catch((error) => {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
      throw error;
    });
  };

  const handlePublish = async (productId: string) => {
    if (!currentShopId) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const res = await publishShopProduct(currentShopId, productId);
        await loadProducts();
        return res;
      },
      successMessage: "Đăng bán sản phẩm thành công!",
      errorMessage: "Không thể đăng bán sản phẩm.",
    }).catch((error) => {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
      throw error;
    });
  };

  const handleUnpublish = async (productId: string) => {
    if (!currentShopId) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const res = await unpublishShopProduct(currentShopId, productId);
        await loadProducts();
        return res;
      },
      successMessage: "Ngừng đăng bán sản phẩm thành công!",
      errorMessage: "Không thể ngừng đăng bán sản phẩm.",
    }).catch((error) => {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
      throw error;
    });
  };

  const handleArchive = async (productId: string) => {
    if (!currentShopId) return;
    const confirmed = window.confirm("Bạn có chắc chắn muốn lưu trữ sản phẩm này không?");
    if (!confirmed) return;

    setState((current) => ({ ...current, loading: true, error: null }));
    await runProductAction({
      action: async () => {
        const res = await archiveShopProduct(currentShopId, productId);
        await loadProducts();
        return res;
      },
      successMessage: "Lưu trữ sản phẩm thành công!",
      errorMessage: "Không thể lưu trữ sản phẩm.",
    }).catch((error) => {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
      throw error;
    });
  };

  const runBulkLifecycle = async (action: "PUBLISH" | "UNPUBLISH" | "ARCHIVE") => {
    if (!currentShopId || selectedIds.length < 1) {
      return;
    }

    if (action === "ARCHIVE") {
      const confirmed = window.confirm("Bạn có chắc chắn muốn lưu trữ các sản phẩm đã chọn?");
      if (!confirmed) return;
    }

    setBulkMessage(null);
    setBulkError(null);
    setBulkResult(null);

    await runBulk({
      action: async () => {
        const result = await bulkShopProductAction(currentShopId, {
          productIds: selectedIds,
          action,
        });
        setBulkMessage(`${action}: ${result.successCount} succeeded, ${result.failureCount} failed.`);
        setSelectedIds([]);
        await loadProducts();
        return result;
      },
      successMessage: "Cập nhật hàng loạt thành công!",
      errorMessage: "Thao tác hàng loạt thất bại.",
    }).catch((error) => {
      setBulkError(error.message);
    });
  };

  const handleBulkUpdate = async () => {
    if (!currentShopId || selectedIds.length < 1 || !bulkEditMode) {
      return;
    }

    const updates: {
      categoryId?: number;
      price?: number;
      stockQuantity?: number;
      trackInventory?: boolean;
    } = {};

    if (bulkEditMode === "CATEGORY") {
      if (!bulkForm.categoryId) {
        setBulkError("Select an internal category before applying the bulk update.");
        return;
      }
      updates.categoryId = Number(bulkForm.categoryId);
    }

    if (bulkEditMode === "PRICE") {
      const price = Number(bulkForm.price);
      if (!Number.isFinite(price) || price <= 0) {
        setBulkError("Bulk price must be greater than zero.");
        return;
      }
      updates.price = price;
    }

    if (bulkEditMode === "STOCK") {
      const stockQuantity = Number(bulkForm.stockQuantity);
      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        setBulkError("Bulk stock must be zero or greater.");
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
          scope: {
            variantMode: bulkForm.variantMode,
          },
          publishIfReady: bulkForm.publishIfReady,
        });
        setBulkResult(result);
        setBulkMessage(`Bulk edit complete: ${result.updated} updated, ${result.failed} failed.`);
        await loadProducts();
        return result;
      },
      successMessage: "Lưu cập nhật hàng loạt thành công!",
      errorMessage: "Cập nhật hàng loạt thất bại.",
    }).catch((error) => {
      setBulkError(error.message);
    });
  };

  const handleCreateShop = async () => {
    setCreateMessage(null);
    setCreateError(null);
    await runShop({
      action: async () => {
        const created = await createSellerShop({
          name: shopForm.name.trim(),
          slug: shopForm.slug.trim(),
          paymentInstructions: "Manual transfer after checkout. Seller confirms payment proof in seller center.",
        });
        await loadShops();
        selectShop(created.id);
        setCreateMessage(`${created.name} created.`);
        setShopForm({ name: "", slug: "" });
        router.refresh();
        return created;
      },
      successMessage: "Tạo cửa hàng thành công!",
      errorMessage: "Không thể tạo cửa hàng.",
    }).catch((error) => {
      setCreateError(error.message);
    });
  };

  const handleCreateProduct = async () => {
    if (!currentShopId) return;

    setCreateMessage(null);
    setCreateError(null);
    await runCreate({
      action: async () => {
        const stamp = Date.now();
        const title = productForm.title.trim();
        const created = await createShopProduct(currentShopId, {
          wbNmId: Number(String(stamp).slice(-9)),
          wbTitle: title,
          localTitle: title,
          wbDescription: productForm.description.trim() || undefined,
          localDescription: productForm.description.trim() || undefined,
          brand: productForm.brand.trim() || undefined,
          categoryId: productForm.categoryId ? Number(productForm.categoryId) : undefined,
          categoryName: productForm.categoryName.trim() || "Seller Created",
          wbVendorCode: `UI-${stamp}`,
          seoSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          visibility: "ACTIVE",
          variants: [
            {
              chrtId: Number(String(stamp).slice(-10)),
              techSize: "ONE",
              wbSize: "One size",
              basePrice: Math.max(1, Number(productForm.price) || 1),
              stockQuantity: Math.max(0, Number(productForm.stockQuantity) || 0),
              lowStockThreshold: 2,
              trackInventory: true,
            },
          ],
        });
        setProductForm({
          title: "",
          description: "",
          brand: "",
          categoryId: "",
          categoryName: "",
          price: "100",
          stockQuantity: "5",
        });
        router.push(`/seller/products/${created.id}`);
        router.refresh();
        return created;
      },
      successMessage: "Tạo sản phẩm thành công!",
      errorMessage: "Không thể tạo sản phẩm.",
    }).catch((error) => {
      setCreateError(error.message);
    });
  };

  return (
    <div className="space-y-6" data-testid="seller-products-page">
      <SectionCard
        eyebrow="Catalog"
        title="Products"
        description="Seller catalog is separate from the public marketplace. Imported products stay private until the seller reviews and publishes them."
      >
        <div className="space-y-5">
          {createMessage ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createMessage}</div>
          ) : null}
          {createError ? (
            <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{createError}</div>
          ) : null}

          {!currentShopId ? (
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5" data-testid="create-shop-panel">
              <p className="text-sm font-semibold text-[var(--foreground)]">Create your first shop</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                  <span>Shop name</span>
                  <input
                    value={shopForm.name}
                    onChange={(event) => setShopForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="create-shop-name"
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                  <span>Shop slug</span>
                  <input
                    value={shopForm.slug}
                    onChange={(event) => setShopForm((current) => ({ ...current, slug: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="create-shop-slug"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleCreateShop()}
                  disabled={creatingShop || !shopForm.name.trim() || !shopForm.slug.trim()}
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="create-shop-submit"
                >
                  {creatingShop ? "Đang gửi..." : "Create shop"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5" data-testid="create-product-panel">
              <p className="text-sm font-semibold text-[var(--foreground)]">Create product</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <CreateInput label="Name" value={productForm.title} onChange={(value) => setProductForm((current) => ({ ...current, title: value }))} testId="create-product-name" />
                <CreateInput label="Brand" value={productForm.brand} onChange={(value) => setProductForm((current) => ({ ...current, brand: value }))} testId="create-product-brand" />
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                  <span>Internal category</span>
                  <select
                    value={productForm.categoryId}
                    onChange={(event) => {
                      const selected = allCategories.find((category) => category.id === event.target.value);
                      setProductForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                        categoryName: selected?.name ?? current.categoryName,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="create-product-category-id"
                  >
                    <option value="">No internal category</option>
                    {allCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <CreateInput label="Category" value={productForm.categoryName} onChange={(value) => setProductForm((current) => ({ ...current, categoryName: value }))} testId="create-product-category" />
                <CreateInput label="Price" type="number" value={productForm.price} onChange={(value) => setProductForm((current) => ({ ...current, price: value }))} testId="create-product-price" />
                <CreateInput label="Initial stock" type="number" value={productForm.stockQuantity} onChange={(value) => setProductForm((current) => ({ ...current, stockQuantity: value }))} testId="create-product-stock" />
                <label className="space-y-2 text-sm font-semibold text-[var(--foreground)] lg:col-span-3">
                  <span>Description</span>
                  <textarea
                    value={productForm.description}
                    onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="create-product-description"
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCreateProduct()}
                  disabled={creatingProduct || !productForm.title.trim()}
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="create-product-submit"
                >
                  {creatingProduct ? "Đang gửi..." : "Create product"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {catalogTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, tab: tab.id }))}
                className={filters.tab === tab.id ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ProductFilters
            value={filters}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                search: value.search,
                status: value.status,
                stockStatus: value.stockStatus,
              }))
            }
            onSubmit={applyFilters}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <InventorySummaryCard label="Tracked products" value={String(stockCounts.tracked)} tone="neutral" />
            <InventorySummaryCard label="Low stock on this page" value={String(stockCounts.lowStock)} tone={stockCounts.lowStock > 0 ? "warn" : "ok"} />
            <InventorySummaryCard label="Out of stock on this page" value={String(stockCounts.outOfStock)} tone={stockCounts.outOfStock > 0 ? "danger" : "ok"} />
          </div>

          {currentShopId ? (
            <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4" data-testid="bulk-edit-toolbar">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">{selectedIds.length} selected</span>
                <button
                  type="button"
                  onClick={() => setBulkEditMode("CATEGORY")}
                  disabled={selectedIds.length < 1}
                  className={bulkEditMode === "CATEGORY" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"}
                  data-testid="bulk-open-category"
                >
                  Set category for selected
                </button>
                <button
                  type="button"
                  onClick={() => setBulkEditMode("PRICE")}
                  disabled={selectedIds.length < 1}
                  className={bulkEditMode === "PRICE" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"}
                  data-testid="bulk-open-price"
                >
                  Set price for selected
                </button>
                <button
                  type="button"
                  onClick={() => setBulkEditMode("STOCK")}
                  disabled={selectedIds.length < 1}
                  className={bulkEditMode === "STOCK" ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]" : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"}
                  data-testid="bulk-open-stock"
                >
                  Set stock for selected
                </button>
                <button
                  type="button"
                  onClick={() => void runBulkLifecycle("PUBLISH")}
                  disabled={bulkSaving || selectedIds.length < 1}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="bulk-publish-selected"
                >
                  Publish selected
                </button>
                <button
                  type="button"
                  onClick={() => void runBulkLifecycle("UNPUBLISH")}
                  disabled={bulkSaving || selectedIds.length < 1}
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unpublish selected
                </button>
                <button
                  type="button"
                  onClick={() => void runBulkLifecycle("ARCHIVE")}
                  disabled={bulkSaving || selectedIds.length < 1}
                  className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Archive selected
                </button>
              </div>

              {bulkEditMode ? (
                <div className="grid gap-4 rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                    {bulkEditMode === "CATEGORY" ? (
                      <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                        <span>Internal category</span>
                        <select
                          value={bulkForm.categoryId}
                          onChange={(event) => setBulkForm((current) => ({ ...current, categoryId: event.target.value }))}
                          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                          data-testid="bulk-category-select"
                        >
                          <option value="">Select a category</option>
                          {allCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    {bulkEditMode === "PRICE" ? (
                      <CreateInput
                        label="Price"
                        type="number"
                        value={bulkForm.price}
                        onChange={(value) => setBulkForm((current) => ({ ...current, price: value }))}
                        testId="bulk-price-input"
                      />
                    ) : null}

                    {bulkEditMode === "STOCK" ? (
                      <>
                        <CreateInput
                          label="Stock quantity"
                          type="number"
                          value={bulkForm.stockQuantity}
                          onChange={(value) => setBulkForm((current) => ({ ...current, stockQuantity: value }))}
                          testId="bulk-stock-input"
                        />
                        <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={bulkForm.trackInventory}
                            onChange={(event) => setBulkForm((current) => ({ ...current, trackInventory: event.target.checked }))}
                          />
                          Track inventory after update
                        </label>
                      </>
                    ) : null}

                    <label className="space-y-2 text-sm font-semibold text-[var(--foreground)]">
                      <span>Variant mode</span>
                      <select
                        value={bulkForm.variantMode}
                        onChange={(event) => setBulkForm((current) => ({ ...current, variantMode: event.target.value as BulkProductVariantMode }))}
                        className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                        data-testid="bulk-variant-mode"
                      >
                        <option value="ALL_VARIANTS">All variants</option>
                        <option value="MISSING_ONLY">Missing only</option>
                        <option value="FIRST_VARIANT_ONLY">First variant only</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={bulkForm.publishIfReady}
                        onChange={(event) => setBulkForm((current) => ({ ...current, publishIfReady: event.target.checked }))}
                        data-testid="bulk-publish-if-ready"
                      />
                      Publish automatically if a product becomes ready
                    </label>
                  </div>

                  <div className="flex items-end justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkEditMode(null)}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkUpdate()}
                      disabled={bulkSaving || selectedIds.length < 1}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="bulk-apply-submit"
                    >
                      {bulkSaving ? "Đang lưu..." : "Apply bulk update"}
                    </button>
                  </div>
                </div>
              ) : null}

              {bulkMessage ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{bulkMessage}</div>
              ) : null}
              {bulkError ? (
                <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{bulkError}</div>
              ) : null}
              {bulkResult ? (
                <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4" data-testid="bulk-edit-result">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                    <span>{bulkResult.updated} updated</span>
                    <span>{bulkResult.failed} failed</span>
                    <span>{selectedProducts.length} selected on page</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {bulkResult.items.map((item) => (
                      <div key={item.productId} className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-[var(--foreground)]">{item.productId}</span>
                          <span className={item.success ? "text-emerald-700" : "text-rose-700"}>
                            {item.success ? "Updated" : "Failed"}
                          </span>
                          {item.readiness ? (
                            <span className="text-[var(--muted)]">
                              {item.readiness.catalogStatus} | {item.readiness.ready ? "Ready" : "Needs review"}
                            </span>
                          ) : null}
                        </div>
                        {item.error ? <p className="mt-2 text-rose-700">{item.error}</p> : null}
                        {item.readiness && item.readiness.blockingReasons.length > 0 ? (
                          <p className="mt-2 text-[var(--muted)]">
                            Blocking reasons: {item.readiness.blockingReasons.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {state.error ? (
            <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
              {state.error}
            </div>
          ) : null}

          {currentShopId ? (
            <>
              {state.loading ? (
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
                  Loading products...
                </div>
              ) : (
                <ProductTable
                  products={state.items}
                  selectedIds={selectedIds}
                  onToggleSelect={(productId) =>
                    setSelectedIds((current) =>
                      current.includes(productId)
                        ? current.filter((id) => id !== productId)
                        : [...current, productId],
                    )
                  }
                  onToggleSelectAll={() =>
                    setSelectedIds((current) =>
                      state.items.every((item) => current.includes(item.id))
                        ? []
                        : state.items.map((item) => item.id),
                    )
                  }
                  onEdit={(productId) => router.push(`/seller/products/${productId}`)}
                  onQuickUpdate={handleQuickUpdate}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onArchive={handleArchive}
                />
              )}
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  {state.meta ? `Showing page ${state.meta.page} of ${Math.max(state.meta.totalPages, 1)} | ${state.meta.total} total products` : "No data loaded yet"}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={page <= 1 || state.loading}
                    onClick={() => handlePageChange(page - 1)}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={state.loading || totalPages === 0 || page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
              Pick a seller shop to load products.
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
  const colorClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-700"
          : "text-[var(--foreground)]";

  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

function flattenCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children ?? []),
  ]);
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
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
        data-testid={testId}
      />
    </label>
  );
}
