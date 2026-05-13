"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { getShopProducts, updateShopProductInventory, type ProductListItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const PAGE_SIZE = 10;

export function SellerProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);

  const [filters, setFilters] = useState({
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
    stockStatus: searchParams.get("stockStatus") ?? "",
  });
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
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

  const totalPages = useMemo(() => state.meta?.totalPages ?? 0, [state.meta]);

  useEffect(() => {
    setFilters({
      search: searchParams.get("search") ?? "",
      status: searchParams.get("status") ?? "",
      stockStatus: searchParams.get("stockStatus") ?? "",
    });
    setPage(Number(searchParams.get("page") ?? "1"));
  }, [searchParams]);

  useEffect(() => {
    if (!user || !currentShopId) {
      return;
    }

    const run = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const response = await getShopProducts(
          currentShopId,
          {
            page,
            size: PAGE_SIZE,
            search: filters.search || undefined,
            status: filters.status || undefined,
            stockStatus: (filters.stockStatus || undefined) as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | undefined,
          },
          "",
        );

        setState({
          items: response.items,
          meta: response.meta,
          loading: false,
          error: null,
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load products.",
        }));
      }
    };

    void run();
  }, [currentShopId, filters.search, filters.status, filters.stockStatus, page, user]);

  const stockCounts = useMemo(() => ({
    tracked: state.items.filter((item) => item.trackInventory).length,
    lowStock: state.items.filter((item) => item.stockStatus === "LOW_STOCK").length,
    outOfStock: state.items.filter((item) => item.stockStatus === "OUT_OF_STOCK").length,
  }), [state.items]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.stockStatus) params.set("stockStatus", filters.stockStatus);
    params.set("page", "1");
    router.replace(`/seller/products?${params.toString()}`);
  };

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.stockStatus) params.set("stockStatus", filters.stockStatus);
    params.set("page", String(nextPage));
    router.replace(`/seller/products?${params.toString()}`);
  };

  const handleQuickUpdate = async (product: ProductListItem, stockQuantity: number) => {
    if (!currentShopId) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      await updateShopProductInventory(currentShopId, product.id, {
        variantId: product.primaryVariantId ?? undefined,
        stockQuantity,
      });

      const response = await getShopProducts(
        currentShopId,
        {
          page,
          size: PAGE_SIZE,
          search: filters.search || undefined,
          status: filters.status || undefined,
          stockStatus: (filters.stockStatus || undefined) as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | undefined,
        },
        "",
      );

      setState({
        items: response.items,
        meta: response.meta,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to update stock.",
      }));
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Catalog"
        title="Products"
        description="The Angular seller product list has been reworked into a responsive table with search, pagination, and shop-scoped NestJS data."
      >
        <div className="space-y-5">
          <ProductFilters value={filters} onChange={setFilters} onSubmit={applyFilters} />

          <div className="grid gap-4 sm:grid-cols-3">
            <InventorySummaryCard label="Tracked products" value={String(stockCounts.tracked)} tone="neutral" />
            <InventorySummaryCard label="Low stock on this page" value={String(stockCounts.lowStock)} tone={stockCounts.lowStock > 0 ? "warn" : "ok"} />
            <InventorySummaryCard label="Out of stock on this page" value={String(stockCounts.outOfStock)} tone={stockCounts.outOfStock > 0 ? "danger" : "ok"} />
          </div>

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
                  onEdit={(productId) => router.push(`/seller/products/${productId}`)}
                  onQuickUpdate={handleQuickUpdate}
                />
              )}
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  {state.meta ? `Showing page ${state.meta.page} of ${Math.max(state.meta.totalPages, 1)} · ${state.meta.total} total products` : "No data loaded yet"}
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
