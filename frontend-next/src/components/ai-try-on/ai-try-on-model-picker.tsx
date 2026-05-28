"use client";

import { useState } from "react";
import { FallbackImage } from "@/components/ui/fallback-image";
import type { AiTryOnBuiltInModel } from "@/lib/public-api";

export function AiTryOnModelPicker({
  models,
  locale,
  selectedModelId,
  customerPreviewUrl,
  uploading,
  t,
  onFileChange,
  onSelectModel,
  onRemovePhoto,
}: {
  models: AiTryOnBuiltInModel[];
  locale: "ru" | "en";
  selectedModelId: string | null;
  customerPreviewUrl: string | null;
  uploading: boolean;
  t: (key: string) => string;
  onFileChange: (file: File | null) => void;
  onSelectModel: (modelId: string) => void;
  onRemovePhoto: () => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  const resolveGenderLabel = (gender: AiTryOnBuiltInModel["gender"]) => {
    switch (gender) {
      case "female":
        return t("aiTryOn.genderFemale");
      case "male":
        return t("aiTryOn.genderMale");
      default:
        return t("aiTryOn.genderOther");
    }
  };

  const resolveBodyTypeLabel = (bodyType: string) => {
    switch (bodyType) {
      case "petite":
        return t("aiTryOn.bodyTypePetite");
      case "slim":
        return t("aiTryOn.bodyTypeSlim");
      case "average":
        return t("aiTryOn.bodyTypeAverage");
      case "regular":
        return t("aiTryOn.bodyTypeRegular");
      case "curvy":
        return t("aiTryOn.bodyTypeCurvy");
      case "plus-size":
        return t("aiTryOn.bodyTypePlusSize");
      case "athletic":
        return t("aiTryOn.bodyTypeAthletic");
      case "heavy":
        return t("aiTryOn.bodyTypeHeavy");
      case "solid":
        return t("aiTryOn.bodyTypeSolid");
      default:
        return bodyType;
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(e.type === "dragenter" || e.type === "dragover");
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <section className="space-y-6">
      {/* Step 3: Photo Upload or Built-in Model Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {t("aiTryOn.step3")}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("aiTryOn.chooseModelHint")}
          </p>
        </div>

        {/* Upload Dropzone & Portrait Preview */}
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 shadow-sm">
          {!customerPreviewUrl ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                isDragActive
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/20"
                  : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/5"
              }`}
            >
              <input
                type="file"
                id="ai-try-on-upload-input-file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                data-testid="ai-try-on-upload-input"
              />
              <svg
                className="h-10 w-10 text-[var(--muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                {uploading ? t("aiTryOn.uploading") : t("aiTryOn.uploadPhoto")}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {t("aiTryOn.uploadHint")}
              </p>
              <p className="mt-2 text-xs font-medium text-[var(--accent-strong)]">
                {t("aiTryOn.uploadFullBodyHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl border border-[var(--border)] bg-neutral-50 shadow-inner">
                <FallbackImage
                  src={customerPreviewUrl}
                  alt="Try-on reference preview"
                  className="h-full w-full object-contain object-center"
                  testId="ai-try-on-upload-preview"
                />
              </div>
              <div className="flex justify-center gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-slate-50">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                  />
                  {t("aiTryOn.changePhoto")}
                </label>
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  {t("aiTryOn.removePhoto")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Built-in Models Grid */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {t("aiTryOn.chooseModel")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const active = selectedModelId === model.modelId;
            return (
              <button
                key={model.modelId}
                type="button"
                onClick={() => onSelectModel(model.modelId)}
                className={`overflow-hidden rounded-[1.5rem] border text-left transition duration-200 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_10px_30px_rgba(203,17,171,0.16)] ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--border)] bg-white hover:border-[var(--border-hover)] hover:shadow-sm"
                }`}
                data-testid={`ai-try-on-model-${model.modelId}`}
              >
                <FallbackImage
                  src={model.imageUrl}
                  alt={locale === "ru" ? model.labelRu : model.labelEn}
                  className="h-72 w-full bg-[linear-gradient(180deg,#fff7f8_0%,#f8efe8_100%)] object-contain p-3"
                />
                <div className="space-y-1 px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                    {locale === "ru" ? model.labelRu : model.labelEn}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {resolveGenderLabel(model.gender)} • {resolveBodyTypeLabel(model.bodyType)}
                  </p>
                  <p className="text-xs text-[var(--muted)]/80">
                    {model.heightCm} cm • {model.weightKg} kg
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
