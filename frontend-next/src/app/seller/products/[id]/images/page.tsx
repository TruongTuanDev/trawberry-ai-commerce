"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const POLLING_STATUSES = new Set<AiImageTask["status"]>(["PENDING", "PROCESSING"]);
const POLLING_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export default function SellerProductImagesPage({
  params,
}: {
  params: { id: string };
}) {
  const token = useAuthStore((state) => state.token);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
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
    let mounted = true;

    const run = async () => {
      if (!token || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const [productResult, imagesResult, tasksResult, creditsResult] = await Promise.all([
          getShopProductById(currentShopId, params.id, token),
          getShopProductImages(currentShopId, params.id, token),
          getShopAiImageTasks(currentShopId, { productId: params.id }, token),
          getAiCredits(currentShopId, token),
        ]);

        if (!mounted) {
          return;
        }

        setProduct(productResult);
        setImages(imagesResult);
        setCurrentTask(tasksResult[0] ?? null);
        setCredits(creditsResult);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load product images.");
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
  }, [currentShopId, params.id, token]);

  useEffect(() => {
    if (!token || !currentShopId || !currentTask || !POLLING_STATUSES.has(currentTask.status)) {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      void getAiImageTask(currentShopId, currentTask.id, token)
        .then(async (task) => {
          setCurrentTask(task);
          if (!POLLING_STATUSES.has(task.status)) {
            window.clearInterval(interval);
            try {
              const nextCredits = await getAiCredits(currentShopId, token);
              setCredits(nextCredits);
            } catch {}
            return;
          }

          if (attempts >= MAX_POLL_ATTEMPTS) {
            window.clearInterval(interval);
            setError("AI task polling timed out before the worker reached a final state.");
          }
        })
        .catch((pollError) => {
          window.clearInterval(interval);
          setError(pollError instanceof Error ? pollError.message : "Unable to refresh AI task.");
        });
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentShopId, currentTask, token]);

  const selectedSummary = useMemo(
    () => selectedFiles.map((file) => file.name).join(", "),
    [selectedFiles],
  );

  const refreshImages = async () => {
    if (!token || !currentShopId) {
      return;
    }

    const nextImages = await getShopProductImages(currentShopId, params.id, token);
    setImages(nextImages);
  };

  const refreshCredits = async () => {
    if (!token || !currentShopId) {
      return;
    }

    const nextCredits = await getAiCredits(currentShopId, token);
    setCredits(nextCredits);
  };

  const handleUpload = async () => {
    if (!token || !currentShopId || !selectedFiles.length) {
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const uploaded = await uploadShopProductImages(currentShopId, params.id, selectedFiles, token);
      setImages((current) => [...current, ...uploaded].sort((left, right) => left.sortOrder - right.sortOrder));
      setSelectedFiles([]);
      setSuccessMessage(`Uploaded ${uploaded.length} image${uploaded.length > 1 ? "s" : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload product images.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!token || !currentShopId) {
      return;
    }

    setDeletingImageId(imageId);
    setError(null);
    setSuccessMessage(null);

    try {
      await deleteShopProductImage(currentShopId, params.id, imageId, token);
      setImages((current) => current.filter((image) => image.id !== imageId));
      setSuccessMessage("Image deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete image.");
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleUpdateImage = async (
    imageId: string,
    payload: Partial<Pick<ProductImage, "isMain" | "imageType">>,
  ) => {
    if (!token || !currentShopId) {
      return;
    }

    setUpdatingImageId(imageId);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedImage = await updateShopProductImage(currentShopId, params.id, imageId, payload, token);
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
      setSuccessMessage(payload.isMain ? "Main image updated." : "Image metadata updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update image metadata.");
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
    if (!token || !currentShopId) {
      return;
    }

    setCreatingTask(true);
    setError(null);
    setAiModalError(null);
    setSuccessMessage(null);

    try {
      const task = await createAiImageTask(
        currentShopId,
        params.id,
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
        token,
      );
      setCurrentTask(task);
      setAiModalOpen(false);
      await refreshCredits();
      setSuccessMessage(`AI task ${task.id.slice(0, 8)} created.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create AI task.";
      setError(message);
      setAiModalError(message);
      throw err;
    } finally {
      setCreatingTask(false);
    }
  };

  const handleAttach = async (generatedImageId: string) => {
    if (!token || !currentShopId || !currentTask) {
      return;
    }

    setAttachingImageId(generatedImageId);
    setError(null);
    setSuccessMessage(null);

    try {
      const attachedImage = await attachGeneratedImage(currentShopId, params.id, generatedImageId, token);
      setImages((current) => [...current, attachedImage].sort((left, right) => left.sortOrder - right.sortOrder));
      const refreshedTask = await getAiImageTask(currentShopId, currentTask.id, token);
      setCurrentTask(refreshedTask);
      setSuccessMessage("AI image attached to product gallery.");
      await refreshImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to attach AI image.");
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
      <SectionCard eyebrow="Product images" title="Loading gallery" description="Fetching seller product images and AI task status from NestJS.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error && !product) {
    return (
      <SectionCard eyebrow="Product images" title="Unable to load gallery" description="The selected product gallery could not be loaded for the current shop.">
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/seller/products/${product?.id ?? params.id}`}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
        >
          Back to product
        </Link>
        <button
          type="button"
          onClick={() => void handleOpenAiModal()}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          Generate AI Image
        </button>
      </div>

      <SectionCard
        eyebrow="Upload"
        title="Add product images"
        description="Direct upload is still available for seller-managed assets. AI generation lives alongside it and can attach completed results back into the gallery."
      >
        <div className="space-y-4">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--panel-strong)]">
            <span className="text-sm font-semibold text-[var(--foreground)]">Choose multiple image files</span>
            <span className="mt-2 text-sm text-[var(--muted)]">JPG, PNG, WEBP. Files upload into the selected seller shop and product.</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
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
            >
              {uploading ? "Uploading..." : "Upload selected images"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              disabled={!selectedFiles.length || uploading}
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear selection
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ProductImageGallery
          productId={product?.id ?? params.id}
          images={images}
          showOpenGalleryLink={false}
          deletingImageId={deletingImageId}
          updatingImageId={updatingImageId}
          onDelete={handleDelete}
          onUpdate={handleUpdateImage}
        />

        <SectionCard
          eyebrow="AI Pipeline"
          title="Seller AI generate flow"
          description="Create a task, let NestJS queue it, poll for progress, then attach finished images into the product gallery."
        >
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">AI credits</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">Remaining</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.remainingCredits ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">Used</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.usedCredits ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]">Total</p>
                  <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{credits?.totalCredits ?? 0}</p>
                </div>
              </div>
            </div>
            {currentTask ? (
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">Latest task</p>
                <p className="mt-2">Task ID: {currentTask.id}</p>
                <p className="mt-1">Status: {currentTask.status}</p>
                <p className="mt-1">Credit cost: {currentTask.creditCost}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No AI task has been created for this product yet. Open the modal to start one.
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
