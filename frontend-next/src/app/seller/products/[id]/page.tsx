"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/seller/section-card";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageGallery } from "@/components/products/product-image-gallery";
import { getShopProductById, updateShopProduct, type ProductDetail, type UpdateProductPayload } from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export default function SellerProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const result = await getShopProductById(currentShopId, params.id);
        if (mounted) {
          setProduct(result);
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
  }, [currentShopId, params.id]);

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
    <div className="space-y-6">
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
            description="Angular used inline controls for price and inventory. This first Next.js pass keeps a read-only variant summary while metadata editing is migrated."
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
              <div className="hidden grid-cols-[140px_140px_160px_160px_120px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:grid">
                <div>Tech size</div>
                <div>WB size</div>
                <div>Base price</div>
                <div>Discount</div>
                <div>Stock</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {product.variants.map((variant) => (
                  <article key={variant.id} className="grid gap-3 px-4 py-4 md:grid-cols-[140px_140px_160px_160px_120px] md:px-5">
                    <div className="text-sm text-[var(--foreground)]">{variant.techSize ?? "N/A"}</div>
                    <div className="text-sm text-[var(--muted)]">{variant.wbSize ?? "N/A"}</div>
                    <div className="text-sm text-[var(--foreground)]">{variant.basePrice ?? "0.00"}</div>
                    <div className="text-sm text-[var(--foreground)]">{variant.discountPrice ?? "-"}</div>
                    <div className={variant.inStock ? "text-sm text-emerald-700" : "text-sm text-[var(--accent)]"}>
                      {variant.stockQuantity}
                    </div>
                  </article>
                ))}
              </div>
            </div>
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
