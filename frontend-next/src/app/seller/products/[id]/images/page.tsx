"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AiImageGenerateModal } from "@/components/products/ai-image-generate-modal";
import { AiTaskPanel } from "@/components/products/ai-task-panel";
import { ProductImageGallery } from "@/components/products/product-image-gallery";
import { SectionCard } from "@/components/seller/section-card";
import {
  attachGeneratedImage,
  createAiImageTask,
  deleteShopProductImage,
  getAiCredits,
  getAiImageTask,
  getShopAiImageTasks,
  getSellerProductById,
  getSellerProductImages,
  getShopProductById,
  getShopProductImages,
  updateShopProductImage,
  uploadShopProductImages,
  type AiCredits,
  type AiImageTask,
  type AiStylePreset,
  type AiTaskType,
  type ProductDetail,
  type ProductImage,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { useI18n } from "@/i18n/use-i18n";

const POLLING_STATUSES = new Set<AiImageTask["status"]>(["PENDING", "PROCESSING"]);
const POLLING_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export default function SellerProductImagesPage() {
  const { t } = useI18n("seller");
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentTask, setCurrentTask] = useState<AiImageTask | null>(null);
  const [credits, setCredits] = useState<AiCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [attachingImageId, setAttachingImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiModalError, setAiModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const pollingActive = Boolean(currentTask && POLLING_STATUSES.has(currentTask.status));

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
        let imagesResult: ProductImage[];
        let shopId = currentShopId;
        if (shopId) {
          try {
            [productResult, imagesResult] = await Promise.all([
              getShopProductById(shopId, productId),
              getShopProductImages(shopId, productId),
            ]);
          } catch {
            productResult = await getSellerProductById(productId);
            imagesResult = await getSellerProductImages(productId);
            shopId = productResult.shop.id;
          }
        } else {
          productResult = await getSellerProductById(productId);
          imagesResult = await getSellerProductImages(productId);
          shopId = productResult.shop.id;
        }
        const [tasksResult, creditsResult] = await Promise.all([
          getShopAiImageTasks(shopId!, { productId }),
          getAiCredits(shopId!),
        ]);

        if (!mounted) {
          return;
        }

        setProduct(productResult);
        setImages(imagesResult);
        setCurrentTask(tasksResult[0] ?? null);
        setCredits(creditsResult);
        if (shopId && shopId !== useSellerWorkspaceStore.getState().currentShopId) {
          selectShop(shopId);
        }
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("seller.productDetail.errorGalleryDescription"));
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

  useEffect(() => {
    if (!currentShopId || !currentTask || !POLLING_STATUSES.has(currentTask.status)) {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      void getAiImageTask(currentShopId, currentTask.id)
        .then(async (task) => {
          setCurrentTask(task);
          if (!POLLING_STATUSES.has(task.status)) {
            window.clearInterval(interval);
            try {
              const nextCredits = await getAiCredits(currentShopId);
              setCredits(nextCredits);
            } catch {}
            return;
          }

          if (attempts >= MAX_POLL_ATTEMPTS) {
            window.clearInterval(interval);
            setError(t("seller.productDetail.pollTimeout"));
          }
        })
        .catch((pollError) => {
          window.clearInterval(interval);
          setError(pollError instanceof Error ? pollError.message : t("seller.productDetail.pollError"));
        });
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentShopId, currentTask, t]);

  const selectedSummary = useMemo(
    () => selectedFiles.map((file) => file.name).join(", "),
    [selectedFiles],
  );

  const refreshImages = async () => {
    if (!currentShopId) {
      return;
    }

    const nextImages = await getShopProductImages(currentShopId, productId);
    setImages(nextImages);
  };

  const refreshCredits = async () => {
    if (!currentShopId) {
      return;
    }

    const nextCredits = await getAiCredits(currentShopId);
    setCredits(nextCredits);
  };

  const handleUpload = async () => {
    if (!currentShopId || !selectedFiles.length) {
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const uploaded = await uploadShopProductImages(currentShopId, productId, selectedFiles);
      setImages((current) => [...current, ...uploaded].sort((left, right) => left.sortOrder - right.sortOrder));
      setSelectedFiles([]);
      setSuccessMessage(t("seller.productDetail.imagesUploaded", { count: uploaded.length }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.productDetail.imagesUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!currentShopId) {
      return;
    }

    setDeletingImageId(imageId);
    setError(null);
    setSuccessMessage(null);

    try {
      await deleteShopProductImage(currentShopId, productId, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
      setSuccessMessage(t("seller.productDetail.imageDeleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.productDetail.imageDeleteFailed"));
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleUpdateImage = async (
    imageId: string,
    payload: Partial<Pick<ProductImage, "isMain" | "imageType">>,
  ) => {
    if (!currentShopId) {
      return;
    }

    setUpdatingImageId(imageId);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedImage = await updateShopProductImage(currentShopId, productId, imageId, payload);
      setImages((current) =>
        current
          .map((image) => {
            if (image.id === updatedImage.id) {
              return updatedImage;
            }

            if (payload.isMain && image.productId === updatedImage.productId) {
              return {
                ...image,
                isMain: false,
              };
            }

            return image;
          })
          .sort((left, right) => {
            if (left.isMain !== right.isMain) {
              return left.isMain ? -1 : 1;
            }

            return left.sortOrder - right.sortOrder;
          }),
      );
      setSuccessMessage(payload.isMain ? t("seller.productDetail.mainImageUpdated") : t("seller.productDetail.imageMetaUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.productDetail.imageMetaUpdateFailed"));
    } finally {
      setUpdatingImageId(null);
    }
  };

  const handleCreateAiTask = async ({
    inputFrontImageId,
    inputBackImageId,
    inputModelImageId,
    quantity,
    prompt,
    stylePreset,
    taskType,
  }: {
    inputFrontImageId: string;
    inputBackImageId?: string;
    inputModelImageId?: string;
    quantity: number;
    prompt: string;
    stylePreset: AiStylePreset;
    taskType: AiTaskType;
  }) => {
    if (!currentShopId) {
      return;
    }

    setCreatingTask(true);
    setError(null);
    setAiModalError(null);
    setSuccessMessage(null);

    try {
      const task = await createAiImageTask(
        currentShopId,
        productId,
        {
          mode: "generate",
          taskType,
          quantity: Math.min(quantity, 10),
          sourceImageId: inputFrontImageId,
          inputFrontImageId,
          inputBackImageId,
          inputModelImageId,
          prompt: prompt.trim()
            ? prompt
            : `Create ${quantity} ${stylePreset.replaceAll("_", " ").toLowerCase()} marketplace image${quantity > 1 ? "s" : ""} for this product while keeping the item unchanged.`,
          stylePreset,
        },
      );
      setCurrentTask(task);
      setAiModalOpen(false);
      await refreshCredits();
      setSuccessMessage(t("seller.productDetail.aiTaskCreated", { id: task.id.slice(0, 8) }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("seller.productDetail.aiTaskCreateFailed");
      setError(message);
      setAiModalError(message);
      throw err;
    } finally {
      setCreatingTask(false);
    }
  };

  const handleAttach = async (generatedImageId: string) => {
    if (!currentShopId || !currentTask) {
      return;
    }

    setAttachingImageId(generatedImageId);
    setError(null);
    setSuccessMessage(null);

    try {
      const attachedImage = await attachGeneratedImage(currentShopId, productId, generatedImageId);
      setImages((current) => [...current, attachedImage].sort((left, right) => left.sortOrder - right.sortOrder));
      const refreshedTask = await getAiImageTask(currentShopId, currentTask.id);
      setCurrentTask(refreshedTask);
      setSuccessMessage(t("seller.productDetail.aiImageAttached"));
      await refreshImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.productDetail.aiImageAttachFailed"));
    } finally {
      setAttachingImageId(null);
    }
  };

  const handleOpenAiModal = async () => {
    setAiModalError(null);
    try {
      await refreshCredits();
    } catch {}
    setAiModalOpen(true);
  };

  if (loading) {
    return (
      <SectionCard eyebrow={t("seller.productDetail.manageImages")} title={t("seller.productDetail.loadingGalleryTitle")} description={t("seller.productDetail.loadingGalleryDescription")}>
        <p className="text-sm text-[var(--muted)]">{t("seller.results.loading")}</p>
      </SectionCard>
    );
  }

  if (error && !product) {
    return (
      <SectionCard eyebrow={t("seller.productDetail.manageImages")} title={t("seller.productDetail.errorGalleryTitle")} description={t("seller.productDetail.errorGalleryDescription")}>
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="seller-product-images-page">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/seller/products/${product?.id ?? productId}`}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
        >
          {t("seller.productDetail.backToProduct")}
        </Link>
        <button
          type="button"
          onClick={() => void handleOpenAiModal()}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          {t("seller.productDetail.generateAiImage")}
        </button>
      </div>

      <SectionCard
        eyebrow="Upload"
        title={t("seller.productDetail.addImagesTitle")}
        description={t("seller.productDetail.addImagesDescription")}
      >
        <div className="space-y-4">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--panel-strong)]">
            <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.productDetail.chooseFiles")}</span>
            <span className="mt-2 text-sm text-[var(--muted)]">{t("seller.productDetail.chooseFilesHint")}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              data-testid="product-image-input"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setSelectedFiles(files);
              }}
            />
          </label>

          {selectedFiles.length ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              {selectedSummary}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!selectedFiles.length || uploading}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="product-image-upload"
            >
              {uploading ? t("seller.productDetail.uploading") : t("seller.productDetail.uploadSelected")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              disabled={!selectedFiles.length || uploading}
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("seller.productDetail.clearSelection")}
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ProductImageGallery
          productId={product?.id ?? productId}
          images={images}
          showOpenGalleryLink={false}
          deletingImageId={deletingImageId}
          updatingImageId={updatingImageId}
          onDelete={handleDelete}
          onUpdate={handleUpdateImage}
        />

        <SectionCard
          eyebrow={t("seller.aiImages.pipelineEyebrow")}
          title={t("seller.productDetail.generateFlowTitle")}
          description={t("seller.productDetail.generateFlowDescription")}
        >
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">{t("seller.productDetail.creditsTitle")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">{t("seller.aiImages.remaining")}</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.remainingCredits ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">{t("seller.aiImages.used")}</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.usedCredits ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">{t("seller.aiImages.total")}</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.totalCredits ?? 0}</p>
                </div>
              </div>
            </div>
            {currentTask ? (
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">{t("seller.productDetail.latestTask")}</p>
                <p className="mt-2">Task ID: {currentTask.id}</p>
                <p className="mt-1">Status: {currentTask.status}</p>
                <p className="mt-1">Credit cost: {currentTask.creditCost}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                {t("seller.productDetail.noTask")}
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      {currentTask ? (
        <AiTaskPanel task={currentTask} pollingActive={pollingActive} attachingImageId={attachingImageId} onAttach={handleAttach} />
      ) : null}

      <AiImageGenerateModal
        open={aiModalOpen}
        productTitle={product?.title ?? product?.wbTitle ?? "Product"}
        images={images}
        credits={credits}
        submitError={aiModalError}
        submitting={creatingTask}
        onClose={() => {
          setAiModalError(null);
          setAiModalOpen(false);
        }}
        onSubmit={handleCreateAiTask}
      />
    </div>
  );
}
