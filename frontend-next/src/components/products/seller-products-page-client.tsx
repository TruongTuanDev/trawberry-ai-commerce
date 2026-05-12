"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { getShopProducts } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const PAGE_SIZE = 10;

export function SellerProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);

  const [filters, setFilters] = useState({
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
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
    });
    setPage(Number(searchParams.get("page") ?? "1"));
  }, [searchParams]);

  useEffect(() => {
    if (!token || !currentShopId) {
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
          },
          token,
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
  }, [currentShopId, filters.search, filters.status, page, token]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    params.set("page", "1");
    router.replace(`/seller/products?${params.toString()}`);
  };

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    params.set("page", String(nextPage));
    router.replace(`/seller/products?${params.toString()}`);
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
