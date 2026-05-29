"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ReferenceSource = "photo" | "model" | null;

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
      case "AI_TRY_ON_REFERENCE_REQUIRED":
        return t("aiTryOn.referenceRequired");
      case "AI_TRY_ON_REFERENCE_CONFLICT":
        return t("aiTryOn.referenceConflict");
      case "AI_TRY_ON_CONSENT_REQUIRED":
        return t("aiTryOn.consentRequired");
      case "AI_TRY_ON_LIMIT_EXCEEDED":
        return t("aiTryOn.limitExceeded");
      case "AI_PROVIDER_NOT_CONFIGURED":
        return t("aiTryOn.providerNotConfigured");
      case "AI_TRY_ON_IMAGE_UNSUITABLE":
        return t("aiTryOn.imageUnsuitable");
      case "AI_PROVIDER_ERROR":
        return t("aiTryOn.providerError");
      case "AI_TIMEOUT":
        return t("aiTryOn.timeout");
      default:
        return t(fallbackKey);
    }
  }

  return t(fallbackKey);
}

function resolveTaskErrorMessage(task: AiTryOnTask, t: (key: string) => string) {
  switch (task.errorCode) {
    case "AI_TRY_ON_PRODUCT_UNSUPPORTED":
      return t("aiTryOn.productUnsupported");
    case "AI_TRY_ON_REFERENCE_REQUIRED":
      return t("aiTryOn.referenceRequired");
    case "AI_TRY_ON_REFERENCE_CONFLICT":
      return t("aiTryOn.referenceConflict");
    case "AI_TRY_ON_CONSENT_REQUIRED":
      return t("aiTryOn.consentRequired");
    case "AI_TRY_ON_LIMIT_EXCEEDED":
      return t("aiTryOn.limitExceeded");
    case "AI_PROVIDER_NOT_CONFIGURED":
      return t("aiTryOn.providerNotConfigured");
    case "AI_TRY_ON_IMAGE_UNSUITABLE":
      return t("aiTryOn.imageUnsuitable");
    case "AI_PROVIDER_ERROR":
      return t("aiTryOn.providerError");
    case "AI_TIMEOUT":
      return t("aiTryOn.timeout");
    default:
      return t("aiTryOn.generateFailed");
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
  const [referenceSource, setReferenceSource] = useState<ReferenceSource>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [uploadedReference, setUploadedReference] = useState<{
    url: string;
    storageKey: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<AiTryOnTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [uploadedReferenceError, setUploadedReferenceError] = useState<string | null>(null);
  const [uploadedImageUnsuitable, setUploadedImageUnsuitable] = useState(false);
  const uploadRequestIdRef = useRef(0);

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
          setErrorCode(next.errorCode);
          setError(resolveTaskErrorMessage(next, t));
        }
      } catch (requestError) {
        setErrorCode(requestError instanceof ApiError ? requestError.code ?? null : null);
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

  const hasUploadedReference = Boolean(uploadedReference?.url && uploadedReference?.storageKey);
  const hasSelectedModel = Boolean(selectedModelId);
  const isPhotoMode = referenceSource === "photo";
  const isDemoModelMode = referenceSource === "model";

  const clearErrors = () => {
    setError(null);
    setErrorCode(null);
  };

  const clearUploadedValidation = () => {
    setUploadedReferenceError(null);
    setUploadedImageUnsuitable(false);
  };

  const handleSourceChange = (nextSource: Exclude<ReferenceSource, null>) => {
    if (nextSource === "photo") {
      const replacingModel = hasSelectedModel;
      uploadRequestIdRef.current += 1;
      setSelectedModelId(null);
      setReferenceSource("photo");
      clearErrors();
      clearUploadedValidation();
      setInfoMessage(replacingModel ? t("aiTryOn.photoOverridesModel") : null);
      return;
    }

    const replacingPhoto = hasUploadedReference;
    uploadRequestIdRef.current += 1;
    setUploading(false);
    setUploadedReference(null);
    setReferenceSource("model");
    clearErrors();
    clearUploadedValidation();
    setInfoMessage(replacingPhoto ? t("aiTryOn.modelOverridesPhoto") : null);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    const replacingModel = hasSelectedModel;
    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    setUploading(true);
    setReferenceSource("photo");
    clearErrors();
    clearUploadedValidation();
    try {
      const uploaded = await uploadAiTryOnReference(file, getGuestSessionId());
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }
      setUploadedReference({
        url: uploaded.url,
        storageKey: uploaded.storageKey,
      });
      setReferenceSource("photo");
      setSelectedModelId(null);
      setInfoMessage(replacingModel ? t("aiTryOn.photoOverridesModel") : null);
    } catch (uploadError) {
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }
      const message = resolveTryOnErrorMessage(uploadError, t, "aiTryOn.uploadFailed");
      const nextErrorCode = uploadError instanceof ApiError ? uploadError.code ?? null : null;
      setErrorCode(nextErrorCode);
      setUploadedReferenceError(message);
      setUploadedImageUnsuitable(nextErrorCode === "AI_TRY_ON_IMAGE_UNSUITABLE");
      setError(message);
      toast.error(message);
    } finally {
      if (uploadRequestIdRef.current === requestId) {
        setUploading(false);
      }
    }
  };

  const handleSelectModel = (modelId: string) => {
    const replacingPhoto = hasUploadedReference;
    uploadRequestIdRef.current += 1;
    setUploading(false);
    setSelectedModelId(modelId);
    setUploadedReference(null);
    setReferenceSource("model");
    clearErrors();
    clearUploadedValidation();
    setInfoMessage(replacingPhoto ? t("aiTryOn.modelOverridesPhoto") : null);
  };

  const handleRemovePhoto = () => {
    uploadRequestIdRef.current += 1;
    setUploading(false);
    setUploadedReference(null);
    setReferenceSource(null);
    clearErrors();
    clearUploadedValidation();
    setInfoMessage(null);
  };

  const handleSubmit = async () => {
    if (requireConsent && !form.consentAccepted) {
      setErrorCode("AI_TRY_ON_CONSENT_REQUIRED");
      setError(t("aiTryOn.consentRequired"));
      return;
    }
    if (!hasUploadedReference && !hasSelectedModel) {
      setErrorCode("AI_TRY_ON_REFERENCE_REQUIRED");
      setError(t("aiTryOn.referenceRequired"));
      return;
    }

    setSubmitting(true);
    clearErrors();
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
      const nextErrorCode = submitError instanceof ApiError ? submitError.code ?? null : null;
      setErrorCode(nextErrorCode);
      if (isPhotoMode && nextErrorCode === "AI_TRY_ON_IMAGE_UNSUITABLE") {
        setUploadedReferenceError(message);
        setUploadedImageUnsuitable(true);
      }
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
    if (uploading) {
      return t("aiTryOn.uploading");
    }
    if (!hasUploadedReference && !hasSelectedModel) {
      return t("aiTryOn.referenceRequired");
    }
    if (
      isPhotoMode &&
      (uploadedImageUnsuitable || errorCode === "AI_TRY_ON_IMAGE_UNSUITABLE")
    ) {
      return uploadedReferenceError ?? t("aiTryOn.imageUnsuitable");
    }
    if (errorCode === "AI_TRY_ON_PRODUCT_UNSUPPORTED") {
      return t("aiTryOn.productUnsupported");
    }
    if (errorCode === "AI_TRY_ON_LIMIT_EXCEEDED") {
      return t("aiTryOn.limitExceeded");
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const busy = submitting || Boolean(task && POLLING_STATUSES.has(task.status));
  const isGenerateDisabled = busy || !!disabledReason;
  const visibleError =
    isDemoModelMode && errorCode === "AI_TRY_ON_IMAGE_UNSUITABLE" ? null : error;

  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden bg-slate-950/60 backdrop-blur-sm" data-testid="ai-try-on-modal">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none bg-[#fffdfa] sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem] shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-slate-50"
          >
            {t("common.close")}
          </button>

          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
              <div className="min-w-0 space-y-8">
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
                    <div className="space-y-4">
                      <h3 className="border-b pb-2 text-lg font-semibold text-[var(--foreground)]">
                        {t("aiTryOn.step1")}
                      </h3>
                      <AiTryOnBodyForm
                        values={form}
                        requireConsent={false}
                        t={t}
                        onChange={setForm}
                      />
                    </div>

                    {requireConsent && (
                      <div className="space-y-4">
                        <h3 className="border-b pb-2 text-lg font-semibold text-[var(--foreground)]">
                          {t("aiTryOn.step2")}
                        </h3>
                        <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--foreground)] transition hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={form.consentAccepted}
                            onChange={(event) =>
                              setForm({ ...form, consentAccepted: event.target.checked })
                            }
                            className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                            data-testid="ai-try-on-consent"
                          />
                          <span className="select-none font-medium">{t("aiTryOn.consent")}</span>
                        </label>
                      </div>
                    )}

                    <div className="border-t pt-6">
                      <AiTryOnModelPicker
                        models={builtInModels}
                        locale={locale}
                        referenceSource={referenceSource}
                        selectedModelId={selectedModelId}
                        customerPreviewUrl={uploadedReference?.url ?? null}
                        uploading={uploading}
                        t={t}
                        onSourceChange={handleSourceChange}
                        onFileChange={(file) => void handleUpload(file)}
                        onSelectModel={handleSelectModel}
                        onRemovePhoto={handleRemovePhoto}
                      />
                    </div>
                  </div>
                )}
              </div>

              <aside className="min-w-0 self-start space-y-4 lg:sticky lg:top-0">
                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("aiTryOn.step4")}
                  </h3>

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

                  <div className="mt-4 space-y-2">
                    <p className="line-clamp-2 text-lg font-bold leading-snug text-[var(--foreground)]">
                      {product.name}
                    </p>
                    <div className="space-y-1.5 border-t pt-2 text-sm text-[var(--muted)]">
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
                      <p className="flex justify-between gap-4">
                        <span>
                          {hasUploadedReference
                            ? t("aiTryOn.referenceLabel")
                            : t("aiTryOn.selectedModelLabel")}
                          :
                        </span>
                        <span className="text-right font-semibold text-[var(--foreground)]">
                          {previewModel
                            ? (locale === "ru" ? previewModel.labelRu : previewModel.labelEn)
                            : hasUploadedReference
                              ? t("aiTryOn.referenceUploadedPhoto")
                              : "-"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {infoMessage ? (
                  <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
                    {infoMessage}
                  </div>
                ) : null}

                {visibleError ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" data-testid="ai-try-on-error">
                    {visibleError}
                  </div>
                ) : null}

                {task && POLLING_STATUSES.has(task.status) ? (
                  <div className="flex items-center gap-3 rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-4 text-sm font-semibold text-[var(--accent-strong)]" data-testid="ai-try-on-loading">
                    <span className="h-2 w-2 animate-ping rounded-full bg-[var(--accent)]" />
                    {t("aiTryOn.generating")}
                  </div>
                ) : null}

                {task?.status !== "COMPLETED" && (
                  <div className="space-y-2">
                    {disabledReason ? (
                      <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-600">
                        <span>{disabledReason}</span>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isGenerateDisabled}
                      className="public-button-primary w-full px-5 py-3.5 text-sm transition duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
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
