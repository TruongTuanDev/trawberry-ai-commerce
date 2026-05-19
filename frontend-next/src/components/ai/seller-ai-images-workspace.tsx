"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { AiTaskPanel } from "@/components/products/ai-task-panel";
import { SectionCard } from "@/components/seller/section-card";
import { FallbackImage } from "@/components/ui/fallback-image";
import {
  attachAiGeneratedImage,
  createAiImageTask,
  getAiCredits,
  getAiRuntimeStatus,
  getShopAiImageTasks,
  getShopProductImages,
  getShopProducts,
  type AiCredits,
  type AiImageTask,
  type AiRuntimeStatus,
  type AiStylePreset,
  type AiTaskType,
  type ProductImage,
  type ProductListItem,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const POLLING_STATUSES = new Set<AiImageTask["status"]>(["PENDING", "PROCESSING"]);
const POLLING_INTERVAL_MS = 2000;

const GENERATION_MODES: Array<{
  id: "studio" | "lifestyle" | "promotional";
  label: string;
  description: string;
  taskType: AiTaskType;
  stylePreset: AiStylePreset;
}> = [
  {
    id: "studio",
    label: "Studio product image",
    description: "Clean catalog shot for marketplace listing and moderation-safe product presentation.",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "STUDIO",
  },
  {
    id: "lifestyle",
    label: "Lifestyle image",
    description: "Product in a believable editorial or home context while keeping the item unchanged.",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "LIFESTYLE",
  },
  {
    id: "promotional",
    label: "Promotional image",
    description: "Hero-style marketing image for banners, campaigns, and product spotlight content.",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "MAIN_COVER",
  },
];

function defaultPrompt(label: string) {
  return `Create one ${label.toLowerCase()} for this marketplace product while preserving the exact item, color, silhouette, logo placement, and material details.`;
}

function inferFrontImage(images: ProductImage[]) {
  return (
    images.find((image) => image.imageType === "FRONT")?.id ??
    images.find((image) => image.isMain)?.id ??
    images[0]?.id ??
    ""
  );
}

function getProductTitle(product: ProductListItem) {
  return product.title || product.localTitle || product.wbTitle || "Untitled product";
}

function getModeBadge(runtimeStatus: AiRuntimeStatus | null): {
  label: string;
  tone: string;
  helper?: string;
} {
  switch (runtimeStatus?.sellerFlowEffectiveMode ?? runtimeStatus?.effectiveMode) {
    case "OPENAI_REAL":
      return {
        label: "OpenAI real mode",
        tone: "bg-emerald-100 text-emerald-800",
      };
    case "AI_SERVICE_MOCK":
      return {
        label: "AI service mock mode",
        tone: "bg-sky-100 text-sky-800",
        helper: "AI service mock mode - no OpenAI billing used.",
      };
    case "AI_SERVICE_UNAVAILABLE":
      return {
        label: "AI service offline",
        tone: "bg-rose-100 text-rose-800",
      };
    case "INTERNAL_MOCK":
    default:
      return {
        label: "Internal mock mode",
        tone: "bg-amber-100 text-amber-800",
      };
  }
}

export function SellerAiImagesWorkspace() {
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductImages, setSelectedProductImages] = useState<ProductImage[]>([]);
  const [tasks, setTasks] = useState<AiImageTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [credits, setCredits] = useState<AiCredits | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus | null>(null);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt(GENERATION_MODES[0].label));
  const [count, setCount] = useState(1);
  const [modeId, setModeId] = useState<(typeof GENERATION_MODES)[number]["id"]>("studio");
  const [inputFrontImageId, setInputFrontImageId] = useState("");
  const [inputBackImageId, setInputBackImageId] = useState("");
  const [inputModelImageId, setInputModelImageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [attachingImageId, setAttachingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null,
    [selectedTaskId, tasks],
  );
  const selectedMode = useMemo(
    () => GENERATION_MODES.find((mode) => mode.id === modeId) ?? GENERATION_MODES[0],
    [modeId],
  );
  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return products;
    }

    return products.filter((product) => {
      const haystack = [
        getProductTitle(product),
        product.brand ?? "",
        product.catalogStatus,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, search]);
  const availableFrontImages = useMemo(
    () => selectedProductImages.filter((image) => image.imageType !== "MODEL_REFERENCE"),
    [selectedProductImages],
  );
  const availableBackImages = useMemo(
    () => selectedProductImages.filter((image) => image.id !== inputFrontImageId),
    [inputFrontImageId, selectedProductImages],
  );
  const availableModelImages = useMemo(
    () => selectedProductImages.filter((image) => image.imageType === "MODEL_REFERENCE"),
    [selectedProductImages],
  );
  const pollingActive = Boolean(tasks.some((task) => POLLING_STATUSES.has(task.status)));
  const modeBadge = getModeBadge(runtimeStatus);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      if (!currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const [productsResponse, tasksResponse, creditsResponse, runtimeResponse] = await Promise.all([
          getShopProducts(currentShopId, {
            page: 1,
            size: 100,
            sort: "updatedAt_desc",
          }),
          getShopAiImageTasks(currentShopId, {}),
          getAiCredits(currentShopId),
          getAiRuntimeStatus(currentShopId),
        ]);

        if (!mounted) {
          return;
        }

        const nextProducts = productsResponse.items;
        const nextSelectedProductId =
          nextProducts.find((product) => product.id === selectedProductId)?.id ??
          tasksResponse[0]?.productId ??
          nextProducts[0]?.id ??
          "";

        setProducts(nextProducts);
        setTasks(tasksResponse);
        setCredits(creditsResponse);
        setRuntimeStatus(runtimeResponse);
        setSelectedTaskId((current) => current || tasksResponse[0]?.id || "");
        setSelectedProductId(nextSelectedProductId);
        setError(null);
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load seller AI workspace.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [currentShopId, selectedProductId]);

  useEffect(() => {
    let mounted = true;

    async function loadSelectedProductImages() {
      if (!currentShopId || !selectedProductId) {
        setSelectedProductImages([]);
        setInputFrontImageId("");
        setInputBackImageId("");
        setInputModelImageId("");
        return;
      }

      try {
        const images = await getShopProductImages(currentShopId, selectedProductId);
        if (!mounted) {
          return;
        }

        setSelectedProductImages(images);
        setInputFrontImageId((current) => (images.some((image) => image.id === current) ? current : inferFrontImage(images)));
        setInputBackImageId((current) => (images.some((image) => image.id === current) ? current : ""));
        setInputModelImageId((current) => (images.some((image) => image.id === current) ? current : ""));
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load product reference images.");
        }
      }
    }

    void loadSelectedProductImages();

    return () => {
      mounted = false;
    };
  }, [currentShopId, selectedProductId]);

  const refreshTasks = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentShopId) {
      return;
    }

    if (!options?.silent) {
      setRefreshingTasks(true);
    }

    try {
      const nextTasks = await getShopAiImageTasks(currentShopId, {});
      setTasks(nextTasks);
      setSelectedTaskId((current) => {
        if (current && nextTasks.some((task) => task.id === current)) {
          return current;
        }

        return nextTasks[0]?.id ?? "";
      });
    } catch (nextError) {
      if (!options?.silent) {
        setError(nextError instanceof Error ? nextError.message : "Unable to refresh AI tasks.");
      }
    } finally {
      if (!options?.silent) {
        setRefreshingTasks(false);
      }
    }
  }, [currentShopId]);

  useEffect(() => {
    if (!currentShopId || !pollingActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshTasks({ silent: true });
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentShopId, pollingActive, refreshTasks]);

  async function refreshCredits() {
    if (!currentShopId) {
      return;
    }

    const nextCredits = await getAiCredits(currentShopId);
    setCredits(nextCredits);
  }

  async function refreshSelectedProductImages() {
    if (!currentShopId || !selectedProductId) {
      return;
    }

    const nextImages = await getShopProductImages(currentShopId, selectedProductId);
    setSelectedProductImages(nextImages);
  }

  async function handleCreateTask() {
    if (!currentShopId || !selectedProductId || !inputFrontImageId) {
      return;
    }

    setCreatingTask(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const task = await createAiImageTask(currentShopId, selectedProductId, {
        mode: "generate",
        taskType: selectedMode.taskType,
        quantity: count,
        stylePreset: selectedMode.stylePreset,
        sourceImageId: inputFrontImageId,
        inputFrontImageId,
        inputBackImageId: inputBackImageId || undefined,
        inputModelImageId: inputModelImageId || undefined,
        prompt: prompt.trim() || defaultPrompt(selectedMode.label),
      });

      await Promise.all([refreshCredits(), refreshTasks({ silent: true })]);
      setSelectedTaskId(task.id);
      setSuccessMessage(
        `AI task ${task.id.slice(0, 8)} created for ${selectedProduct ? getProductTitle(selectedProduct) : "the selected product"}.`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create AI image task.");
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleAttach(generatedImageId: string) {
    if (!currentShopId || !selectedProductId || !selectedTask) {
      return;
    }

    setAttachingImageId(generatedImageId);
    setError(null);
    setSuccessMessage(null);

    try {
      await attachAiGeneratedImage(currentShopId, selectedProductId, generatedImageId);
      await Promise.all([refreshTasks({ silent: true }), refreshSelectedProductImages()]);
      setSuccessMessage("AI image attached to the product gallery.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to attach generated image.");
    } finally {
      setAttachingImageId(null);
    }
  }

  if (loading) {
    return (
      <SectionCard eyebrow="AI pipeline" title="Loading AI workspace" description="Loading seller AI products, task history, and runtime mode.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (!currentShopId) {
    return (
      <SectionCard
        eyebrow="AI pipeline"
        title="Choose a seller shop"
        description="Seller AI Images is shop-scoped because credits, tasks, and product ownership all belong to one seller shop."
      >
        <p className="text-sm text-[var(--muted)]">Use the shop switcher above before creating or attaching AI images.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="seller-ai-images-page">
      <SectionCard
        eyebrow="Seller AI"
        title="AI Images"
        description="Generate product-safe marketplace images, monitor task status, and attach completed outputs back into the product gallery."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Current shop: <span className="font-semibold text-[var(--foreground)]">{currentShop?.name ?? currentShopId}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", modeBadge.tone)} data-testid="ai-runtime-badge">
                {modeBadge.label}
              </span>
              {runtimeStatus?.aiServiceStorageDriver ? (
                <span className="inline-flex rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                  Storage: {runtimeStatus.aiServiceStorageDriver}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-[var(--muted)]">{runtimeStatus?.statusMessage}</p>
            {modeBadge.helper ? <p className="text-sm text-sky-700">{modeBadge.helper}</p> : null}
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Credits</p>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[var(--muted)]">Remaining</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.remainingCredits ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Used</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.usedCredits ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Total</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.totalCredits ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {runtimeStatus?.effectiveMode === "AI_SERVICE_UNAVAILABLE" ? (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            `ai-service` is configured as the worker target but its health endpoint is unreachable. New tasks can fail until the service comes back.
          </div>
        ) : null}

        {runtimeStatus && ["INTERNAL_MOCK", "AI_SERVICE_MOCK"].includes(runtimeStatus.sellerFlowEffectiveMode ?? runtimeStatus.effectiveMode) ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Mock generation is active for development. The UI and backend flow are real, but image generation is using a mock-safe provider.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          eyebrow="Product selector"
          title="Choose a product"
          description="Pick one product from the current seller shop before generating AI images. Seller catalog ownership and gallery attach stay shop-scoped."
        >
          <div className="space-y-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products by title, brand, or catalog status"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              data-testid="seller-ai-product-search"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {filteredProducts.length ? (
                filteredProducts.slice(0, 12).map((product) => {
                  const active = product.id === selectedProductId;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className={clsx(
                        "flex items-center gap-3 rounded-[1.5rem] border px-3 py-3 text-left transition",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-white hover:bg-[var(--panel-strong)]",
                      )}
                      data-testid={active ? "seller-ai-product-selected" : "seller-ai-product-option"}
                    >
                      <div className="h-16 w-16 overflow-hidden rounded-2xl bg-[var(--panel-strong)]">
                        <FallbackImage src={product.mainImage} alt={getProductTitle(product)} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{getProductTitle(product)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {product.catalogStatus} · {product.stockStatus}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{product.mainImage ? "Has image" : "No image yet"}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                  No matching products found in the current shop.
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Generate"
          title="Create AI image task"
          description="This form creates a real NestJS task for the selected product. The downstream generation provider may still be mock-safe, depending on runtime mode."
        >
          <div className="space-y-5">
            <div className="grid gap-3">
              {GENERATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    const currentDefault = defaultPrompt(selectedMode.label);
                    const nextDefault = defaultPrompt(mode.label);
                    setModeId(mode.id);
                    if (!prompt.trim() || prompt === currentDefault) {
                      setPrompt(nextDefault);
                    }
                  }}
                  className={clsx(
                    "rounded-[1.5rem] border px-4 py-4 text-left transition",
                    mode.id === modeId
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-white hover:bg-[var(--panel-strong)]",
                  )}
                  data-testid={`seller-ai-mode-${mode.id}`}
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">{mode.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{mode.description}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Front product image"
                value={inputFrontImageId}
                onChange={setInputFrontImageId}
                options={availableFrontImages.map((image) => ({
                  value: image.id,
                  label: `${image.imageType} #${image.sortOrder + 1}${image.isMain ? " (main)" : ""}`,
                }))}
                placeholder="Choose a product image"
                dataTestId="seller-ai-front-image"
              />
              <SelectField
                label="Count"
                value={String(count)}
                onChange={(value) => setCount(Number(value))}
                options={[1, 2, 3, 4].map((value) => ({
                  value: String(value),
                  label: `${value}`,
                }))}
                dataTestId="seller-ai-count"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Back image"
                value={inputBackImageId}
                onChange={setInputBackImageId}
                options={availableBackImages.map((image) => ({
                  value: image.id,
                  label: `${image.imageType} #${image.sortOrder + 1}`,
                }))}
                placeholder="Optional back image"
                dataTestId="seller-ai-back-image"
              />
              <SelectField
                label="Model reference"
                value={inputModelImageId}
                onChange={setInputModelImageId}
                options={availableModelImages.map((image) => ({
                  value: image.id,
                  label: `MODEL_REFERENCE #${image.sortOrder + 1}`,
                }))}
                placeholder="Optional model reference"
                dataTestId="seller-ai-model-image"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="seller-ai-prompt">
                Prompt
              </label>
              <textarea
                id="seller-ai-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="Add product-safe guidance for the generated image."
                data-testid="seller-ai-prompt"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Estimated credit cost: <span className="font-semibold text-[var(--foreground)]">{count}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={!selectedProductId || !inputFrontImageId || creatingTask}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="seller-ai-generate-submit"
            >
              {creatingTask ? "Creating task..." : "Generate AI image"}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard
          eyebrow="Task list"
          title="Recent AI tasks"
          description="Recent seller AI generation jobs for the current shop. Select one row to inspect results and attach generated images."
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">{tasks.length} task(s) in this shop</p>
            <button
              type="button"
              onClick={() => void refreshTasks()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
              data-testid="seller-ai-refresh-tasks"
            >
              {refreshingTasks ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="space-y-3">
            {tasks.length ? (
              tasks.map((task) => {
                const product = products.find((item) => item.id === task.productId) ?? null;
                const provider =
                  task.generatedImages[0]?.provider ??
                  (runtimeStatus?.effectiveMode === "OPENAI_REAL" ? "OPENAI" : runtimeStatus?.aiServiceProvider ?? "pending");
                const active = task.id === selectedTask?.id;

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setSelectedProductId(task.productId);
                    }}
                    className={clsx(
                      "w-full rounded-[1.5rem] border px-4 py-4 text-left transition",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-white hover:bg-[var(--panel-strong)]",
                    )}
                    data-testid={active ? "seller-ai-task-selected" : "seller-ai-task-row"}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{product ? getProductTitle(product) : task.productId}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {task.taskType} · {task.stylePreset ?? "no-style"} · {new Date(task.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Provider: {provider}</p>
                      </div>
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          task.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : task.status === "FAILED"
                              ? "bg-rose-100 text-rose-700"
                              : task.status === "PROCESSING"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {task.status}
                      </span>
                    </div>
                    {task.errorMessage ? <p className="mt-3 text-sm text-rose-700">{task.errorMessage}</p> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                No AI tasks yet. Create the first task from the panel above.
              </div>
            )}
          </div>
        </SectionCard>

        {selectedTask ? (
          <AiTaskPanel
            task={selectedTask}
            pollingActive={pollingActive && selectedTask.id === tasks.find((task) => POLLING_STATUSES.has(task.status))?.id}
            attachingImageId={attachingImageId}
            onAttach={handleAttach}
          />
        ) : (
          <SectionCard
            eyebrow="Results"
            title="Result gallery"
            description="Generated AI images will appear here after the selected task completes."
          >
            <p className="text-sm text-[var(--muted)]">Select or create an AI task to view generated images.</p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        eyebrow="Virtual try-on"
        title="Coming soon"
        description="Customer-facing or seller-facing virtual try-on is not wired to a verified backend task flow yet."
      >
        <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-5 py-5" data-testid="seller-ai-tryon-card">
          <p className="text-sm font-semibold text-[var(--foreground)]">Backend not ready for end-to-end try-on.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            The domain has `TRY_ON` task hints, but there is no verified upload, processing, and result flow that should be presented as real today. This card is intentionally non-interactive.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  dataTestId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  dataTestId?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
        data-testid={dataTestId}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
