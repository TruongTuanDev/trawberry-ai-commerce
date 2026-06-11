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
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";

const POLLING_STATUSES = new Set<AiImageTask["status"]>(["PENDING", "PROCESSING"]);
const POLLING_INTERVAL_MS = 2000;

const GENERATION_MODES: Array<{
  id: "studio" | "lifestyle" | "promotional";
  labelKey: string;
  descriptionKey: string;
  taskType: AiTaskType;
  stylePreset: AiStylePreset;
}> = [
  {
    id: "studio",
    labelKey: "seller.aiImages.modes.studio.label",
    descriptionKey: "seller.aiImages.modes.studio.description",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "STUDIO",
  },
  {
    id: "lifestyle",
    labelKey: "seller.aiImages.modes.lifestyle.label",
    descriptionKey: "seller.aiImages.modes.lifestyle.description",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "LIFESTYLE",
  },
  {
    id: "promotional",
    labelKey: "seller.aiImages.modes.promotional.label",
    descriptionKey: "seller.aiImages.modes.promotional.description",
    taskType: "PRODUCT_MODEL_IMAGE",
    stylePreset: "MAIN_COVER",
  },
];

function defaultPrompt(label: string): string {
  return `Create one ${label.toLowerCase()} for this marketplace product while preserving the exact item, color, silhouette, logo placement, and material details.`;
}

function inferFrontImage(images: ProductImage[]): string {
  return (
    images.find((image) => image.imageType === "FRONT")?.id ??
    images.find((image) => image.isMain)?.id ??
    images[0]?.id ??
    ""
  );
}

function getProductTitle(product: ProductListItem, t: (key: string, values?: Record<string, string | number>) => string): string {
  return product.title || product.localTitle || product.wbTitle || t("seller.aiImages.untitledProduct");
}

function getModeBadge(runtimeStatus: AiRuntimeStatus | null, t: (key: string, values?: Record<string, string | number>) => string): {
  label: string;
  tone: string;
  helper?: string;
} {
  switch (runtimeStatus?.sellerFlowEffectiveMode ?? runtimeStatus?.effectiveMode) {
    case "AI_SERVICE_OPENAI_READY":
      return {
        label: t("seller.aiImages.runtime.integrationReady"),
        tone: "bg-emerald-100 text-emerald-800",
      };
    case "AI_SERVICE_OPENAI_BLOCKED":
      return {
        label: t("seller.aiImages.runtime.openAiBlocked"),
        tone: "bg-rose-100 text-rose-800",
        helper: getSafeRuntimeErrorMessage(runtimeStatus?.safeErrorCode, t),
      };
    case "AI_SERVICE_MOCK":
      return {
        label: t("seller.aiImages.runtime.integrationUnavailable"),
        tone: "bg-amber-100 text-amber-800",
        helper: t("seller.aiImages.runtime.integrationUnavailableHelper"),
      };
    case "OFFLINE":
      return {
        label: t("seller.aiImages.runtime.offline"),
        tone: "bg-rose-100 text-rose-800",
      };
    case "INTERNAL_MOCK":
    default:
      return {
        label: t("seller.aiImages.runtime.integrationUnavailable"),
        tone: "bg-amber-100 text-amber-800",
        helper: t("seller.aiImages.runtime.integrationUnavailableHelper"),
      };
  }
}

function getSafeRuntimeErrorMessage(safeErrorCode: string | null | undefined, t: (key: string, values?: Record<string, string | number>) => string): string {
  switch (safeErrorCode) {
    case "OPENAI_UNAUTHORIZED":
      return t("seller.aiImages.runtime.errors.OPENAI_UNAUTHORIZED");
    case "OPENAI_BILLING_HARD_LIMIT":
      return t("seller.aiImages.runtime.errors.OPENAI_BILLING_HARD_LIMIT");
    case "OPENAI_QUOTA_EXCEEDED":
      return t("seller.aiImages.runtime.errors.OPENAI_QUOTA_EXCEEDED");
    case "OPENAI_RATE_LIMIT":
      return t("seller.aiImages.runtime.errors.OPENAI_RATE_LIMIT");
    case "OPENAI_BAD_REQUEST":
      return t("seller.aiImages.runtime.errors.OPENAI_BAD_REQUEST");
    case "STORAGE_WRITE_FAILED":
      return t("seller.aiImages.runtime.errors.STORAGE_WRITE_FAILED");
    case "AI_SERVICE_UNREACHABLE":
      return t("seller.aiImages.runtime.errors.AI_SERVICE_UNREACHABLE");
    case "AI_SERVICE_INVALID_RESPONSE":
      return t("seller.aiImages.runtime.errors.AI_SERVICE_INVALID_RESPONSE");
    default:
      return t("seller.aiImages.runtime.errors.default");
  }
}

export function SellerAiImagesWorkspace() {
  const { t } = useI18n("seller");
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
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [modeId, setModeId] = useState<(typeof GENERATION_MODES)[number]["id"]>("studio");
  const [inputFrontImageId, setInputFrontImageId] = useState("");
  const [inputBackImageId, setInputBackImageId] = useState("");
  const [inputModelImageId, setInputModelImageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const [attachingImageId, setAttachingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { run: runCreateTask, isRunning: creatingTask } = useActionFeedback();
  const { run: runAttach } = useActionFeedback();

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
        getProductTitle(product, t),
        product.brand ?? "",
        product.catalogStatus,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, search, t]);
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
  const modeBadge = getModeBadge(runtimeStatus, t);
  const generationReady =
    runtimeStatus?.sellerFlowEffectiveMode === "AI_SERVICE_OPENAI_READY";

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
          setError(nextError instanceof Error ? nextError.message : t("seller.aiImages.loadingDescription"));
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
  }, [currentShopId, selectedProductId, t]);

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
          setError(nextError instanceof Error ? nextError.message : t("seller.aiImages.loadingDescription"));
        }
      }
    }

    void loadSelectedProductImages();

    return () => {
      mounted = false;
    };
  }, [currentShopId, selectedProductId, t]);

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
        setError(nextError instanceof Error ? nextError.message : t("seller.aiImages.loadingDescription"));
      }
    } finally {
      if (!options?.silent) {
        setRefreshingTasks(false);
      }
    }
  }, [currentShopId, t]);

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
    if (
      !currentShopId ||
      !selectedProductId ||
      !inputFrontImageId ||
      !generationReady
    ) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    await runCreateTask({
      action: async () => {
        return createAiImageTask(currentShopId, selectedProductId, {
          mode: "generate",
          taskType: selectedMode.taskType,
          quantity: count,
          stylePreset: selectedMode.stylePreset,
          sourceImageId: inputFrontImageId,
          inputFrontImageId,
          inputBackImageId: inputBackImageId || undefined,
          inputModelImageId: inputModelImageId || undefined,
          prompt: prompt.trim() || defaultPrompt(t(selectedMode.labelKey)),
        });
      },
      successMessage: t("seller.aiImages.taskCreated"),
      onSuccess: async (task: AiImageTask) => {
        await Promise.all([refreshCredits(), refreshTasks({ silent: true })]);
        setSelectedTaskId(task.id);
        setSuccessMessage(
          t("seller.aiImages.taskCreatedMessage", {
            taskId: task.id.slice(0, 8),
            productName: selectedProduct ? getProductTitle(selectedProduct, t) : t("seller.aiImages.selectedProductFallback"),
          }),
        );
      },
    });
  }

  async function handleAttach(generatedImageId: string) {
    if (!currentShopId || !selectedProductId || !selectedTask) {
      return;
    }

    setAttachingImageId(generatedImageId);
    setError(null);
    setSuccessMessage(null);

    await runAttach({
      action: async () => {
        return attachAiGeneratedImage(currentShopId, selectedProductId, generatedImageId);
      },
      successMessage: t("seller.aiImages.attachSaved"),
      onSuccess: async () => {
        await Promise.all([refreshTasks({ silent: true }), refreshSelectedProductImages()]);
        setSuccessMessage(t("seller.aiImages.attachMessage"));
      },
      onFinally: () => {
        setAttachingImageId(null);
      },
    });
  }

  if (loading) {
    return (
      <SectionCard eyebrow={t("seller.aiImages.pipelineEyebrow")} title={t("seller.aiImages.loadingTitle")} description={t("seller.aiImages.loadingDescription")}>
        <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
      </SectionCard>
    );
  }

  if (!currentShopId) {
    return (
      <SectionCard
        eyebrow={t("seller.aiImages.pipelineEyebrow")}
        title={t("seller.aiImages.chooseShopTitle")}
        description={t("seller.aiImages.chooseShopDescription")}
      >
        <p className="text-sm text-[var(--muted)]">{t("seller.aiImages.chooseShopHint")}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6" data-testid="seller-ai-images-page">
      <SectionCard
        eyebrow={t("seller.aiImages.eyebrow")}
        title={t("seller.aiImages.title")}
        description={t("seller.aiImages.description")}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              {t("seller.aiImages.currentShop")}: <span className="font-semibold text-[var(--foreground)]">{currentShop?.name ?? currentShopId}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", modeBadge.tone)} data-testid="ai-runtime-badge">
                {modeBadge.label}
              </span>
            </div>
            {modeBadge.helper ? <p className="text-sm text-sky-700">{modeBadge.helper}</p> : null}
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("seller.aiImages.credits")}</p>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[var(--muted)]">{t("seller.aiImages.remaining")}</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.remainingCredits ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">{t("seller.aiImages.used")}</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.usedCredits ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">{t("seller.aiImages.total")}</p>
                <p className="font-semibold text-[var(--foreground)]">{credits?.totalCredits ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {runtimeStatus?.sellerFlowEffectiveMode === "OFFLINE" ? (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t("seller.aiImages.runtimeOffline")}
          </div>
        ) : null}

        {runtimeStatus?.sellerFlowEffectiveMode === "AI_SERVICE_OPENAI_BLOCKED" ? (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getSafeRuntimeErrorMessage(runtimeStatus.safeErrorCode, t)}
          </div>
        ) : null}

        {runtimeStatus && ["INTERNAL_MOCK", "AI_SERVICE_MOCK"].includes(runtimeStatus.sellerFlowEffectiveMode ?? runtimeStatus.effectiveMode) ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t("seller.aiImages.runtime.integrationUnavailableHelper")}
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
          eyebrow={t("seller.aiImages.selectorEyebrow")}
          title={t("seller.aiImages.selectorTitle")}
          description={t("seller.aiImages.selectorDescription")}
        >
          <div className="space-y-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("seller.aiImages.searchPlaceholder")}
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
                        <FallbackImage src={product.mainImage} alt={getProductTitle(product, t)} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{getProductTitle(product, t)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {product.catalogStatus} · {product.stockStatus}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{product.mainImage ? t("seller.aiImages.hasImage") : t("seller.aiImages.noImageYet")}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                  {t("seller.aiImages.noMatchingProducts")}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={t("seller.aiImages.generateEyebrow")}
          title={t("seller.aiImages.generateTitle")}
          description={t("seller.aiImages.generateDescription")}
        >
          <div className="space-y-5">
            <div className="grid gap-3">
              {GENERATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    const currentDefault = defaultPrompt(t(selectedMode.labelKey));
                    const nextDefault = defaultPrompt(t(mode.labelKey));
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
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t(mode.labelKey)}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{t(mode.descriptionKey)}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label={t("seller.aiImages.frontProductImage")}
                value={inputFrontImageId}
                onChange={setInputFrontImageId}
                options={availableFrontImages.map((image) => ({
                  value: image.id,
                  label: `${image.imageType} #${image.sortOrder + 1}${image.isMain ? ` (${t("seller.aiImages.main") || "main"})` : ""}`,
                }))}
                placeholder={t("seller.aiImages.chooseProductImage")}
                dataTestId="seller-ai-front-image"
              />
              <SelectField
                label={t("seller.aiImages.count")}
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
                label={t("seller.aiImages.backImage")}
                value={inputBackImageId}
                onChange={setInputBackImageId}
                options={availableBackImages.map((image) => ({
                  value: image.id,
                  label: `${image.imageType} #${image.sortOrder + 1}`,
                }))}
                placeholder={t("seller.aiImages.optionalBackImage")}
                dataTestId="seller-ai-back-image"
              />
              <SelectField
                label={t("seller.aiImages.modelReference")}
                value={inputModelImageId}
                onChange={setInputModelImageId}
                options={availableModelImages.map((image) => ({
                  value: image.id,
                  label: `MODEL_REFERENCE #${image.sortOrder + 1}`,
                }))}
                placeholder={t("seller.aiImages.optionalModelReference")}
                dataTestId="seller-ai-model-image"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="seller-ai-prompt">
                {t("seller.aiImages.prompt")}
              </label>
              <textarea
                id="seller-ai-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                placeholder={t("seller.aiImages.promptPlaceholder")}
                data-testid="seller-ai-prompt"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {t("seller.aiImages.estimatedCreditCost")}: <span className="font-semibold text-[var(--foreground)]">{count}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={!generationReady || !selectedProductId || !inputFrontImageId || creatingTask}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="seller-ai-generate-submit"
            >
              {creatingTask ? t("seller.aiImages.submitting") : t("seller.aiImages.generateButton")}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard
          eyebrow={t("seller.aiImages.taskListEyebrow")}
          title={t("seller.aiImages.taskListTitle")}
          description={t("seller.aiImages.taskListDescription")}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">{t("seller.aiImages.taskCount", { count: tasks.length })}</p>
            <button
              type="button"
              onClick={() => void refreshTasks()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
              data-testid="seller-ai-refresh-tasks"
            >
              {refreshingTasks ? t("seller.aiImages.refreshing") : t("seller.aiImages.refresh")}
            </button>
          </div>
          <div className="space-y-3">
            {tasks.length ? (
              tasks.map((task) => {
                const product = products.find((item) => item.id === task.productId) ?? null;
                const provider =
                  task.generatedImages[0]?.provider ??
                  (runtimeStatus?.sellerFlowEffectiveMode === "AI_SERVICE_OPENAI_READY"
                    ? "OPENAI"
                    : "pending");
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
                        <p className="text-sm font-semibold text-[var(--foreground)]">{product ? getProductTitle(product, t) : task.productId}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {task.taskType} · {task.stylePreset ?? t("seller.aiImages.styleNone")} · {new Date(task.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{t("seller.aiImages.provider")}: {provider === "pending" ? t("seller.aiImages.providerPending") : provider}</p>
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
                {t("seller.aiImages.noTasks")}
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
            eyebrow={t("seller.aiImages.resultsEyebrow")}
            title={t("seller.aiImages.resultsTitle")}
            description={t("seller.aiImages.resultsDescription")}
          >
            <p className="text-sm text-[var(--muted)]">{t("seller.aiImages.selectTaskHint")}</p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        eyebrow={t("seller.aiImages.tryOnEyebrow")}
        title={t("seller.aiImages.tryOnTitle")}
        description={t("seller.aiImages.tryOnDescription")}
      >
        <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-5 py-5" data-testid="seller-ai-tryon-card">
          <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.aiImages.tryOnNotReadyTitle")}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("seller.aiImages.tryOnNotReadyDescription")}
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
