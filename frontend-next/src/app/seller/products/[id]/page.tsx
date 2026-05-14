"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageGallery } from "@/components/products/product-image-gallery";
import {
  getShopProductById,
  getShopProductInventory,
  updateShopProduct,
  updateShopProductInventory,
  type ProductDetail,
  type ProductInventory,
  type UpdateProductPayload,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export default function SellerProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [inventory, setInventory] = useState<ProductInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventorySavingId, setInventorySavingId] = useState<string | null>(null);
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const [productResult, inventoryResult] = await Promise.all([
          getShopProductById(currentShopId, productId),
          getShopProductInventory(currentShopId, productId),
        ]);
        if (mounted) {
          setProduct(productResult);
          setInventory(inventoryResult);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load product.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [currentShopId, productId]);

  const handleSave = async (payload: UpdateProductPayload) => {
    if (!currentShopId || !product) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateShopProduct(currentShopId, product.id, payload);
      setProduct(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update product.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleInventorySave = async (variantId: string, stockQuantity: number) => {
    if (!currentShopId || !product) {
      return;
    }

    setInventorySavingId(variantId);
    try {
      const updatedInventory = await updateShopProductInventory(currentShopId, product.id, {
        variantId,
        stockQuantity,
      });
      const refreshedProduct = await getShopProductById(currentShopId, product.id);
      setInventory(updatedInventory);
      setProduct(refreshedProduct);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update inventory.");
      throw err;
    } finally {
      setInventorySavingId(null);
    }
  };

  const handlePriceSave = async (variantId: string, chrtId: string, basePrice: number) => {
    if (!currentShopId || !product) {
      return;
    }

    setPriceSavingId(variantId);
    try {
      const updated = await updateShopProduct(currentShopId, product.id, {
        variants: [{ chrtId: Number(chrtId), basePrice, discountPrice: basePrice }],
      });
      setProduct(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update price.");
      throw err;
    } finally {
      setPriceSavingId(null);
    }
  };

  if (loading) {
    return (
      <SectionCard eyebrow="Product detail" title="Loading product" description="Fetching seller product details from NestJS.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !product) {
    return (
      <SectionCard eyebrow="Product detail" title="Unable to load product" description="The product could not be loaded from the current seller shop.">
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? "Product not found."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="seller-product-detail-page">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/seller/products"
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
        >
          Back to products
        </Link>
        <Link
          href={`/seller/products/${product.id}/images`}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          Manage images
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ProductForm product={product} saving={saving} onSubmit={handleSave} />
          <SectionCard
            eyebrow="Variants"
            title="Variant overview"
            description="Inventory is managed per variant in this MVP. Stock updates are absolute values and checkout deducts inventory immediately."
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
              <div className="hidden grid-cols-[110px_110px_130px_100px_120px_150px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:grid">
                <div>Tech size</div>
                <div>WB size</div>
                <div>Base price</div>
                <div>Discount</div>
                <div>Stock</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {(inventory?.variants ?? product.variants.map((variant) => ({
                  id: variant.id,
                  chrtId: variant.chrtId,
                  techSize: variant.techSize,
                  wbSize: variant.wbSize,
                  stockQuantity: variant.stockQuantity,
                  reservedStock: variant.reservedStock,
                  lowStockThreshold: variant.lowStockThreshold,
                  trackInventory: variant.trackInventory,
                  stockStatus: variant.stockStatus,
                  availableQuantity: Math.max(0, variant.stockQuantity),
                  inStock: variant.inStock,
                }))).map((variant) => (
                  <InventoryRow
                    key={`${variant.id}-${variant.stockQuantity}-${variant.reservedStock}`}
                    variant={{
                      ...variant,
                      basePrice: product.variants.find((entry) => entry.id === variant.id)?.basePrice ?? null,
                      discountPrice: product.variants.find((entry) => entry.id === variant.id)?.discountPrice ?? null,
                    }}
                    saving={inventorySavingId === variant.id}
                    priceSaving={priceSavingId === variant.id}
                    onSave={handleInventorySave}
                    onPriceSave={handlePriceSave}
                  />
                ))}
              </div>
            </div>
            {inventory ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <InventoryMetric label="Total stock" value={String(inventory.totalStockQuantity)} />
                <InventoryMetric label="Reserved" value={String(inventory.totalReservedStock)} />
                <InventoryMetric
                  label="Available"
                  value={inventory.inStock ? String(inventory.totalAvailableQuantity) : "0"}
                  tone={inventory.stockStatus === "OUT_OF_STOCK" || inventory.stockStatus === "LOW_STOCK" ? "warn" : "ok"}
                />
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            eyebrow="Wildberries"
            title="Source identity"
            description="Reference data from the synced product record remains visible next to editable local fields."
          >
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p><span className="font-semibold text-[var(--foreground)]">Brand:</span> {product.brand ?? "Unknown"}</p>
              <p><span className="font-semibold text-[var(--foreground)]">Category:</span> {product.category?.name ?? product.categoryName ?? "Unknown"}</p>
              <p><span className="font-semibold text-[var(--foreground)]">WB ID:</span> {product.wbNmId}</p>
              <p><span className="font-semibold text-[var(--foreground)]">Vendor code:</span> {product.wbVendorCode ?? "N/A"}</p>
              <p><span className="font-semibold text-[var(--foreground)]">Original title:</span> {product.wbTitle}</p>
            </div>
          </SectionCard>
          <ProductImageGallery productId={product.id} images={product.images} />
        </div>
      </div>
    </div>
  );
}

function InventoryRow({
  variant,
  saving,
  priceSaving,
  onSave,
  onPriceSave,
}: {
  variant: {
    id: string;
    chrtId: string;
    techSize: string | null;
    wbSize: string | null;
    basePrice: string | null;
    discountPrice: string | null;
    stockQuantity: number;
    reservedStock: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED";
    availableQuantity: number;
    inStock: boolean;
  };
  saving: boolean;
  priceSaving: boolean;
  onSave: (variantId: string, stockQuantity: number) => Promise<void>;
  onPriceSave: (variantId: string, chrtId: string, basePrice: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(variant.stockQuantity));
  const [priceValue, setPriceValue] = useState(variant.basePrice ?? "0");

  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[110px_110px_130px_100px_120px_150px_220px] md:px-5">
      <div className="text-sm text-[var(--foreground)]">{variant.techSize ?? "N/A"}</div>
      <div className="text-sm text-[var(--muted)]">{variant.wbSize ?? "N/A"}</div>
      <div>
        <input
          type="number"
          min={0}
          value={priceValue}
          onChange={(event) => setPriceValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
          data-testid="product-price-input"
        />
      </div>
      <div className="text-sm text-[var(--foreground)]">{variant.discountPrice ?? "-"}</div>
      <div>
          <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
          data-testid="product-stock-input"
        />
      </div>
      <div className={variant.stockStatus === "OUT_OF_STOCK" ? "text-sm font-semibold text-rose-700" : variant.stockStatus === "LOW_STOCK" ? "text-sm font-semibold text-amber-700" : "text-sm text-emerald-700"}>
        {variant.trackInventory ? `${variant.availableQuantity} available` : "Not tracked"}
        <div className="text-xs text-[var(--muted)]">
          {variant.trackInventory ? `${variant.reservedStock} reserved - threshold ${variant.lowStockThreshold}` : "Inventory tracking disabled"}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2">
        <button
          type="button"
          onClick={() => void onPriceSave(variant.id, variant.chrtId, Math.max(0, Number(priceValue) || 0))}
          disabled={priceSaving}
          className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="product-price-save"
        >
          {priceSaving ? "Saving..." : "Save price"}
        </button>
        <button
          type="button"
          onClick={() => void onSave(variant.id, Math.max(0, Number(value) || 0))}
          disabled={saving}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="product-stock-save"
        >
          {saving ? "Saving..." : "Save stock"}
        </button>
      </div>
    </article>
  );
}

function InventoryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-[var(--foreground)]";

  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
