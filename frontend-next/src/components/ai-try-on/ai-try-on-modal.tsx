"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { AiTryOnBodyForm } from "@/components/ai-try-on/ai-try-on-body-form";
import { AiTryOnModelPicker } from "@/components/ai-try-on/ai-try-on-model-picker";
import { AiTryOnResult } from "@/components/ai-try-on/ai-try-on-result";
import { FallbackImage } from "@/components/ui/fallback-image";
import { toast } from "@/components/ui/use-toast";
import {
  createAiTryOnTask,
  getAiTryOnTask,
  uploadAiTryOnReference,
  type AiTryOnBuiltInModel,
  type AiTryOnTask,
} from "@/lib/public-api";

type TryOnFormState = {
  heightCm: string;
  weightKg: string;
  gender: "male" | "female" | "other";
  bodyType: "slim" | "regular" | "large";
  bodyTraits: string[];
  consentAccepted: boolean;
};

const POLLING_STATUSES = new Set<AiTryOnTask["status"]>(["PENDING", "PROCESSING"]);

function resolveTryOnErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey: string,
) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "AI_TRY_ON_PRODUCT_UNSUPPORTED":
        return t("aiTryOn.productUnsupported");
      case "AI_PROVIDER_NOT_CONFIGURED":
        return t("aiTryOn.providerNotConfigured");
      case "AI_TRY_ON_IMAGE_UNSUITABLE":
        return t("aiTryOn.imageUnsuitable");
      case "AI_PROVIDER_ERROR":
        return t("aiTryOn.providerError");
      case "AI_TIMEOUT":
        return t("aiTryOn.timeout");
      default:
        return error.message || t(fallbackKey);
    }
  }

  return error instanceof Error ? error.message : t(fallbackKey);
}

function resolveTaskErrorMessage(task: AiTryOnTask, t: (key: string) => string) {
  switch (task.errorCode) {
    case "AI_TRY_ON_PRODUCT_UNSUPPORTED":
      return t("aiTryOn.productUnsupported");
    case "AI_PROVIDER_NOT_CONFIGURED":
      return t("aiTryOn.providerNotConfigured");
    case "AI_TRY_ON_IMAGE_UNSUITABLE":
      return t("aiTryOn.imageUnsuitable");
    case "AI_PROVIDER_ERROR":
      return t("aiTryOn.providerError");
    case "AI_TIMEOUT":
      return t("aiTryOn.timeout");
    default:
      return task.errorMessage ?? t("aiTryOn.generateFailed");
  }
}

function getGuestSessionId() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const existing = window.localStorage.getItem("public-guest-session-id");
  if (existing) {
    return existing;
  }

  const created = window.crypto?.randomUUID?.() ?? `guest-${Date.now()}`;
  window.localStorage.setItem("public-guest-session-id", created);
  return created;
}

export function AiTryOnModal({
  open,
  locale,
  requireConsent,
  builtInModels,
  product,
  t,
  onClose,
}: {
  open: boolean;
  locale: "ru" | "en";
  requireConsent: boolean;
  builtInModels: AiTryOnBuiltInModel[];
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    selectedSize: string;
    selectedRussianSize: string | null;
  };
  t: (key: string) => string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TryOnFormState>({
    heightCm: "",
    weightKg: "",
    gender: "female",
    bodyType: "regular",
    bodyTraits: [],
    consentAccepted: !requireConsent,
  });
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    builtInModels[0]?.modelId ?? null,
  );
  const [uploadedReference, setUploadedReference] = useState<{
    url: string;
    storageKey: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<AiTryOnTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflowX = previousBodyOverflowX;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
    };
  }, [open]);

  useEffect(() => {
    if (!task || !POLLING_STATUSES.has(task.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const next = await getAiTryOnTask(task.id, getGuestSessionId());
        setTask(next);
        if (next.status === "FAILED") {
          setError(resolveTaskErrorMessage(next, t));
        }
      } catch (requestError) {
        setError(resolveTryOnErrorMessage(requestError, t, "aiTryOn.genericError"));
        window.clearInterval(interval);
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [task, t]);

  const previewModel = useMemo(
    () => builtInModels.find((model) => model.modelId === selectedModelId) ?? null,
    [builtInModels, selectedModelId],
  );

  if (!open) {
    return null;
  }

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadAiTryOnReference(file, getGuestSessionId());
      setUploadedReference({
        url: uploaded.url,
        storageKey: uploaded.storageKey,
      });
      setSelectedModelId(null);
    } catch (uploadError) {
      const message = resolveTryOnErrorMessage(uploadError, t, "aiTryOn.uploadFailed");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (requireConsent && !form.consentAccepted) {
      setError(t("aiTryOn.consentRequired"));
      return;
    }
    if (!uploadedReference && !selectedModelId) {
      setError(t("aiTryOn.referenceRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createAiTryOnTask(
        product.id,
        {
          selectedSize: product.selectedSize,
          selectedRussianSize: product.selectedRussianSize ?? undefined,
          heightCm: form.heightCm ? Number(form.heightCm) : undefined,
          weightKg: form.weightKg ? Number(form.weightKg) : undefined,
          gender: form.gender,
          bodyType: form.bodyType,
          bodyTraits: form.bodyTraits,
          customerImageUrl: uploadedReference?.url,
          customerImageStorageKey: uploadedReference?.storageKey,
          selectedModelId: selectedModelId ?? undefined,
          consentAccepted: form.consentAccepted,
        },
        getGuestSessionId(),
      );
      setTask(created);
    } catch (submitError) {
      const message = resolveTryOnErrorMessage(submitError, t, "aiTryOn.generateFailed");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getDisabledReason = () => {
    if (requireConsent && !form.consentAccepted) {
      return t("aiTryOn.consentRequired");
    }
    if (!uploadedReference && !selectedModelId) {
      return t("aiTryOn.referenceRequired");
    }
    if (uploading) {
      return t("aiTryOn.uploading");
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const busy = submitting || Boolean(task && POLLING_STATUSES.has(task.status));
  const isGenerateDisabled = busy || !!disabledReason;

  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden bg-slate-950/60 backdrop-blur-sm" data-testid="ai-try-on-modal">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none bg-[#fffdfa] sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem] shadow-2xl">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:bg-slate-50 transition"
          >
            {t("common.close")}
          </button>

          {/* Modal Content container - scrollable */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
              {/* Left Panel: Steps 1, 2, 3 */}
              <div className="min-w-0 space-y-8">
                {/* Header */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    {t("aiTryOn.title")}
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                    {t("aiTryOn.heading")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                    {t("aiTryOn.subtitle")}
                  </p>
                </div>

                {task?.status === "COMPLETED" ? (
                  <AiTryOnResult task={task} t={t} />
                ) : (
                  <div className="space-y-8">
                    {/* Step 1: Body traits & preferences */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-[var(--foreground)] border-b pb-2">
                        {t("aiTryOn.step1")}
                      </h3>
                      <AiTryOnBodyForm
                        values={form}
                        requireConsent={false} // Handle consent in Step 2 separately
                        t={t}
                        onChange={setForm}
                      />
                    </div>

                    {/* Step 2: Consent */}
                    {requireConsent && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-[var(--foreground)] border-b pb-2">
                          {t("aiTryOn.step2")}
                        </h3>
                        <label className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--foreground)] hover:bg-slate-50 cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={form.consentAccepted}
                            onChange={(event) => setForm({ ...form, consentAccepted: event.target.checked })}
                            className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                            data-testid="ai-try-on-consent"
                          />
                          <span className="select-none font-medium">{t("aiTryOn.consent")}</span>
                        </label>
                      </div>
                    )}

                    {/* Step 3: Upload photo or Choose built-in model */}
                    <div className="border-t pt-6">
                      <AiTryOnModelPicker
                        models={builtInModels}
                        locale={locale}
                        selectedModelId={selectedModelId}
                        customerPreviewUrl={uploadedReference?.url ?? null}
                        uploading={uploading}
                        t={t}
                        onFileChange={(file) => void handleUpload(file)}
                        onSelectModel={(modelId) => {
                          setSelectedModelId(modelId);
                          setUploadedReference(null);
                        }}
                        onRemovePhoto={() => {
                          setUploadedReference(null);
                          setSelectedModelId(builtInModels[0]?.modelId ?? null);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Step 4 (Product summary & generation) */}
              <aside className="lg:sticky lg:top-0 space-y-4 self-start min-w-0">
                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] mb-4">
                    {t("aiTryOn.step4")}
                  </h3>

                  {/* Product Preview Image */}
                  <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)]">
                    {product.imageUrl ? (
                      <FallbackImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-64 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
                        {product.name}
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="mt-4 space-y-2">
                    <p className="text-lg font-bold text-[var(--foreground)] leading-snug line-clamp-2">
                      {product.name}
                    </p>
                    <div className="text-sm space-y-1.5 pt-2 border-t text-[var(--muted)]">
                      <p className="flex justify-between">
                        <span>{t("aiTryOn.selectedSize")}:</span>
                        <span className="font-semibold text-[var(--foreground)]">{product.selectedSize}</span>
                      </p>
                      {product.selectedRussianSize ? (
                        <p className="flex justify-between">
                          <span>{t("aiTryOn.russianSize")}:</span>
                          <span className="font-semibold text-[var(--foreground)]">{product.selectedRussianSize}</span>
                        </p>
                      ) : null}
                      <p className="flex justify-between">
                        <span>{t("aiTryOn.currentModel")}:</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          {previewModel
                            ? (locale === "ru" ? previewModel.labelRu : previewModel.labelEn)
                            : uploadedReference
                            ? t("aiTryOn.photoSelected")
                            : "-"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Box */}
                {error ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium" data-testid="ai-try-on-error">
                    ⚠️ {error}
                  </div>
                ) : null}

                {/* Loading Box */}
                {task && POLLING_STATUSES.has(task.status) ? (
                  <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-4 text-sm text-[var(--accent-strong)] font-semibold flex items-center gap-3 animate-pulse" data-testid="ai-try-on-loading">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-ping" />
                    {t("aiTryOn.generating")}
                  </div>
                ) : null}

                {/* Generate Button with helper warnings */}
                {task?.status !== "COMPLETED" && (
                  <div className="space-y-2">
                    {disabledReason && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium flex items-start gap-1.5">
                        <span>⚠️</span>
                        <span>{disabledReason}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isGenerateDisabled}
                      className="public-button-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 transition duration-200 hover:scale-[1.01]"
                      data-testid="ai-try-on-generate"
                    >
                      {busy ? t("aiTryOn.generating") : t("aiTryOn.generate")}
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
