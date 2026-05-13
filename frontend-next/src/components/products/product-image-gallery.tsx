import Link from "next/link";
import type { ProductDetail, ProductImage } from "@/lib/seller-api";

const IMAGE_TYPES: ProductImage["imageType"][] = [
  "ORIGINAL",
  "AI_GENERATED",
  "MODEL_REFERENCE",
  "FRONT",
  "BACK",
  "DETAIL",
];

export function ProductImageGallery({
  productId,
  images,
  showOpenGalleryLink = true,
  deletingImageId,
  updatingImageId,
  onDelete,
  onUpdate,
}: {
  productId: string;
  images: ProductDetail["images"] | ProductImage[];
  showOpenGalleryLink?: boolean;
  deletingImageId?: string | null;
  updatingImageId?: string | null;
  onDelete?: (imageId: string) => Promise<void> | void;
  onUpdate?: (
    imageId: string,
    payload: Partial<Pick<ProductImage, "isMain" | "imageType">>,
  ) => Promise<void> | void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Images</p>
          <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
            Product image gallery
          </h2>
        </div>
        {showOpenGalleryLink ? (
          <Link
            href={`/seller/products/${productId}/images`}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
          >
            Open full gallery
          </Link>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.length ? (
          images.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)]" data-testid="product-image-card">
              <div className="aspect-[4/3] bg-[var(--panel-strong)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={("url" in image ? image.url : image.localUrl) ?? image.wbUrl}
                  alt={`Product image ${image.id}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-4 p-4 text-sm text-[var(--muted)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {"imageType" in image ? image.imageType : "ORIGINAL"}
                  </span>
                  {image.isMain ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Main image
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p>Sort order: {image.sortOrder}</p>
                  {"originalName" in image && image.originalName ? <p>File: {image.originalName}</p> : null}
                  {"mimeType" in image && image.mimeType ? <p>Type: {image.mimeType}</p> : null}
                </div>
                {onUpdate && "imageType" in image ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Image type
                      </span>
                      <select
                        value={image.imageType}
                        onChange={(event) => void onUpdate(image.id, { imageType: event.target.value as ProductImage["imageType"] })}
                        disabled={updatingImageId === image.id}
                        className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
                      >
                        {IMAGE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void onUpdate(image.id, { isMain: true })}
                      disabled={image.isMain || updatingImageId === image.id}
                      className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingImageId === image.id ? "Saving..." : image.isMain ? "Current main image" : "Set as main image"}
                    </button>
                  </div>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => void onDelete(image.id)}
                    disabled={deletingImageId === image.id}
                    className="w-full rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingImageId === image.id ? "Deleting..." : "Delete image"}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
            No product images available.
          </div>
        )}
      </div>
    </section>
  );
}
