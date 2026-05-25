"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SectionCard } from "@/components/seller/section-card";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageGallery } from "@/components/products/product-image-gallery";
import {
  getSellerProductById,
  getSellerProductInventory,
  getSellerProductReadiness,
  getShopProductById,
  getShopProductInventory,
  getShopProductReadiness,
  updateShopProduct,
  updateShopProductInventory,
  type ProductDetail,
  type ProductInventory,
  type ProductReadiness,
  type UpdateProductPayload,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useI18n } from "@/i18n/use-i18n";

export default function SellerProductDetailPage() {
  const { t } = useI18n("seller");
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [inventory, setInventory] = useState<ProductInventory | null>(null);
  const [readiness, setReadiness] = useState<ProductReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [variantSavingId, setVariantSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrateWorkspace();
  }, [hydrateWorkspace]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!hydrated) {
        return;
      }

      try {
        let productResult: ProductDetail;
        let inventoryResult: ProductInventory;
        let readinessResult: ProductReadiness;
        if (currentShopId) {
          try {
            [productResult, inventoryResult] = await Promise.all([
              getShopProductById(currentShopId, productId),
              getShopProductInventory(currentShopId, productId),
            ]);
            readinessResult = await getShopProductReadiness(currentShopId, productId);
          } catch {
            [productResult, inventoryResult, readinessResult] = await Promise.all([
              getSellerProductById(productId),
              getSellerProductInventory(productId),
              getSellerProductReadiness(productId),
            ]);
          }
        } else {
          [productResult, inventoryResult, readinessResult] = await Promise.all([
            getSellerProductById(productId),
            getSellerProductInventory(productId),
            getSellerProductReadiness(productId),
          ]);
        }
        if (mounted) {
          setProduct(productResult);
          setInventory(inventoryResult);
          setReadiness(readinessResult);
          if (productResult.shop.id !== useSellerWorkspaceStore.getState().currentShopId) {
            selectShop(productResult.shop.id);
          }
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("seller.productDetail.errorDescription"));
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
  }, [currentShopId, hydrated, productId, selectShop, t]);

  const handleSave = async (payload: UpdateProductPayload) => {
    if (!currentShopId || !product) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateShopProduct(currentShopId, product.id, payload);
      setProduct(updated);
      setReadiness(await getShopProductReadiness(currentShopId, product.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.products.messages.updateFailed"));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleVariantSave = async (
    variantId: string,
    chrtId: string,
    basePrice: number,
    discountPercent: number,
    stockQuantity: number,
  ) => {
    if (!currentShopId || !product) {
      return;
    }

    setVariantSavingId(variantId);
    try {
      const finalPrice = Math.max(
        0,
        Math.round(basePrice * (1 - discountPercent / 100)),
      );
      const [updatedProduct, updatedInventory] = await Promise.all([
        updateShopProduct(currentShopId, product.id, {
          variants: [
            {
              chrtId: Number(chrtId),
              basePrice,
              discountPrice: finalPrice,
            },
          ],
        }),
        updateShopProductInventory(currentShopId, product.id, {
          variantId,
          stockQuantity,
        }),
      ]);
      setProduct(updatedProduct);
      setInventory(updatedInventory);
      setReadiness(await getShopProductReadiness(currentShopId, product.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.products.messages.updateFailed"));
      throw err;
    } finally {
      setVariantSavingId(null);
    }
  };

  if (loading) {
    return (
      <SectionCard eyebrow={t("seller.productDetail.loadingTitle")} title={t("seller.productDetail.loadingTitle")} description={t("seller.productDetail.loadingDescription")}>
        <p className="text-sm text-[var(--muted)]">{t("seller.results.loading")}</p>
      </SectionCard>
    );
  }

  if (error || !product) {
    return (
      <SectionCard eyebrow={t("seller.productDetail.errorTitle")} title={t("seller.productDetail.errorTitle")} description={t("seller.productDetail.errorDescription")}>
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? t("seller.productDetail.notFound")}
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
          {t("seller.productDetail.backToProducts")}
        </Link>
        <Link
          href={`/seller/products/${product.id}/images`}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          {t("seller.productDetail.manageImages")}
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard
            eyebrow={t("seller.products.catalog")}
            title={t("seller.productDetail.visibilityTitle")}
            description={t("seller.productDetail.visibilityDescription")}
          >
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("seller.productDetail.catalogStatus")}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{product.catalogStatus}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">{t("seller.products.table.source")}: {product.source}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("seller.productDetail.publicVisibility")}</p>
                <p className={`mt-2 text-lg font-semibold ${readiness?.ready ? "text-emerald-700" : "text-amber-700"}`}>
                  {readiness?.ready ? t("seller.productDetail.ready") : t("seller.productDetail.needsInfo")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(readiness?.blockingReasons ?? []).map((reason) => {
                    const keyMap: Record<string, string> = {
                      MISSING_PRICE: "missingPrice",
                      MISSING_STOCK: "missingStock",
                      MISSING_CATEGORY: "missingCategory",
                      MISSING_IMAGE: "missingImage",
                      NO_ACTIVE_VARIANT: "missingVariant"
                    };
                    const key = keyMap[reason] || reason.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                    const translated = t(`seller.products.statusBadges.${key}`);
                    const display = translated.includes("statusBadges") ? reason.replaceAll("_", " ") : translated;
                    return (
                      <span key={reason} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        {display}
                      </span>
                    );
                  })}
                  {readiness && readiness.blockingReasons.length < 1 ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {t("seller.productDetail.readyLabel")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>
          <ProductForm product={product} saving={saving} onSubmit={handleSave} />
          <SectionCard
            eyebrow={t("seller.products.variantMode")}
            title={t("seller.productDetail.variantOverview")}
            description={t("seller.productDetail.variantOverviewDescription")}
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
              <div className="hidden grid-cols-[90px_90px_130px_110px_130px_110px_150px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:grid">
                <div>{t("seller.productDetail.techSize")}</div>
                <div>{t("seller.productDetail.wbSize")}</div>
                <div>{t("seller.productDetail.basePrice")}</div>
                <div>{t("seller.productDetail.discount")}</div>
                <div>{t("seller.productDetail.finalPrice")}</div>
                <div>{t("seller.productDetail.stock")}</div>
                <div>{t("seller.productDetail.status")}</div>
                <div>{t("seller.productDetail.action")}</div>
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
                    key={`${variant.id}-${variant.stockQuantity}-${variant.reservedStock}-${product.variants.find((entry) => entry.id === variant.id)?.basePrice ?? "0"}-${product.variants.find((entry) => entry.id === variant.id)?.discountPrice ?? "0"}`}
                    variant={{
                      ...variant,
                      basePrice: product.variants.find((entry) => entry.id === variant.id)?.basePrice ?? null,
                      discountPrice: product.variants.find((entry) => entry.id === variant.id)?.discountPrice ?? null,
                    }}
                    saving={variantSavingId === variant.id}
                    onSave={handleVariantSave}
                  />
                ))}
              </div>
            </div>
            {inventory ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <InventoryMetric label={t("seller.productDetail.totalStock")} value={String(inventory.totalStockQuantity)} />
                <InventoryMetric label={t("seller.productDetail.reserved")} value={String(inventory.totalReservedStock)} />
                <InventoryMetric
                  label={t("seller.productDetail.available")}
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
            title={t("seller.productDetail.sourceIdentity")}
            description={t("seller.productDetail.sourceIdentityDescription")}
          >
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p><span className="font-semibold text-[var(--foreground)]">{t("seller.products.brand")}:</span> {product.brand ?? t("common.unknown")}</p>
              <p><span className="font-semibold text-[var(--foreground)]">{t("seller.products.category")}:</span> {product.category?.name ?? product.categoryName ?? t("common.unknown")}</p>
              <p><span className="font-semibold text-[var(--foreground)]">WB ID:</span> {product.wbNmId}</p>
              <p><span className="font-semibold text-[var(--foreground)]">{t("seller.productDetail.vendorCode")}:</span> {product.wbVendorCode ?? "N/A"}</p>
              <p><span className="font-semibold text-[var(--foreground)]">{t("seller.productDetail.originalTitle")}:</span> {product.wbTitle}</p>
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
  onSave,
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
  onSave: (
    variantId: string,
    chrtId: string,
    basePrice: number,
    discountPercent: number,
    stockQuantity: number,
  ) => Promise<void>;
}) {
  const { t } = useI18n("seller");
  const [value, setValue] = useState(String(variant.stockQuantity));
  const [priceValue, setPriceValue] = useState(variant.basePrice ?? "0");
  const [rowError, setRowError] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState(() => {
    const basePrice = Number(variant.basePrice ?? "0");
    const finalPrice = Number(variant.discountPrice ?? variant.basePrice ?? "0");
    if (basePrice <= 0) {
      return "0";
    }
    const discountPercent = ((basePrice - finalPrice) / basePrice) * 100;
    return String(Math.max(0, Math.round(discountPercent * 100) / 100));
  });

  const normalizedBasePrice = Math.max(0, Number(priceValue) || 0);
  const normalizedDiscountPercent = Math.min(
    100,
    Math.max(0, Number(discountValue) || 0),
  );
  const finalPrice = Math.max(
    0,
    Math.round(normalizedBasePrice * (1 - normalizedDiscountPercent / 100)),
  );

  const handleSaveClick = async () => {
    if (priceValue.trim() === "") {
      setRowError(t("seller.productDetail.priceRequired"));
      return;
    }
    if (discountValue.trim() === "") {
      setRowError(t("seller.productDetail.discountRequired"));
      return;
    }
    if (value.trim() === "") {
      setRowError(t("seller.productDetail.stockRequired"));
      return;
    }

    setRowError(null);
    await onSave(
      variant.id,
      variant.chrtId,
      normalizedBasePrice,
      normalizedDiscountPercent,
      Math.max(0, Number(value) || 0),
    );
  };

  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[90px_90px_130px_110px_130px_110px_150px_220px] md:px-5">
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
      <div>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={discountValue}
          onChange={(event) => setDiscountValue(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
          data-testid="product-discount-input"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">%</p>
      </div>
      <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
        {finalPrice}
      </div>
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
        {variant.trackInventory ? t("seller.productDetail.availableCount", { value: variant.availableQuantity }) : t("seller.productDetail.notTracked")}
        <div className="text-xs text-[var(--muted)]">
          {variant.trackInventory ? t("seller.productDetail.reservedLabel", { value: variant.reservedStock, threshold: variant.lowStockThreshold }) : t("seller.productDetail.notTrackedLabel")}
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => void handleSaveClick()}
          disabled={saving}
          className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="product-variant-save"
        >
          {saving ? t("seller.productDetail.saving") : t("seller.productDetail.saveVariant")}
        </button>
        {rowError ? <p className="text-xs font-medium text-rose-700">{rowError}</p> : null}
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
