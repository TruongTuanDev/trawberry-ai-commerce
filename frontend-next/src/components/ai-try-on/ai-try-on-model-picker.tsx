"use client";

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
}: {
  models: AiTryOnBuiltInModel[];
  locale: "ru" | "en";
  selectedModelId: string | null;
  customerPreviewUrl: string | null;
  uploading: boolean;
  t: (key: string) => string;
  onFileChange: (file: File | null) => void;
  onSelectModel: (modelId: string) => void;
}) {
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

  return (
    <section className="space-y-4">
      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("aiTryOn.uploadPhoto")}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t("aiTryOn.uploadHint")}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              data-testid="ai-try-on-upload-input"
            />
            {uploading ? t("aiTryOn.uploading") : t("aiTryOn.uploadPhoto")}
          </label>
        </div>
        {customerPreviewUrl ? (
          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-white">
            <FallbackImage
              src={customerPreviewUrl}
              alt="Try-on reference preview"
              className="h-56 w-full object-cover"
              testId="ai-try-on-upload-preview"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{t("aiTryOn.chooseModel")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t("aiTryOn.chooseModelHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => {
            const active = selectedModelId === model.modelId;
            return (
              <button
                key={model.modelId}
                type="button"
                onClick={() => onSelectModel(model.modelId)}
                className={`overflow-hidden rounded-[1.5rem] border text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_10px_30px_rgba(203,17,171,0.16)]"
                    : "border-[var(--border)] bg-white"
                }`}
                data-testid={`ai-try-on-model-${model.modelId}`}
              >
                <FallbackImage
                  src={model.imageUrl}
                  alt={locale === "ru" ? model.labelRu : model.labelEn}
                  className="h-72 w-full bg-[linear-gradient(180deg,#fff7f8_0%,#f8efe8_100%)] object-contain p-3"
                />
                <div className="space-y-1 px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
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
