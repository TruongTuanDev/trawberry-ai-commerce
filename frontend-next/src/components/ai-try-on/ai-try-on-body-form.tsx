"use client";

type TryOnFormState = {
  heightCm: string;
  weightKg: string;
  gender: "male" | "female" | "other";
  bodyType: "slim" | "regular" | "large";
  bodyTraits: string[];
  consentAccepted: boolean;
};

const BODY_TRAITS = ["wide_shoulders", "long_legs", "large_belly"] as const;

export function AiTryOnBodyForm({
  values,
  requireConsent,
  t,
  onChange,
}: {
  values: TryOnFormState;
  requireConsent: boolean;
  t: (key: string) => string;
  onChange: (next: TryOnFormState) => void;
}) {
  const toggleTrait = (trait: string) => {
    onChange({
      ...values,
      bodyTraits: values.bodyTraits.includes(trait)
        ? values.bodyTraits.filter((item) => item !== trait)
        : [...values.bodyTraits, trait],
    });
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">{t("aiTryOn.height")}</span>
          <input
            value={values.heightCm}
            onChange={(event) => onChange({ ...values, heightCm: event.target.value })}
            inputMode="numeric"
            className="public-input"
            placeholder="172"
            data-testid="ai-try-on-height"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">{t("aiTryOn.weight")}</span>
          <input
            value={values.weightKg}
            onChange={(event) => onChange({ ...values, weightKg: event.target.value })}
            inputMode="numeric"
            className="public-input"
            placeholder="70"
            data-testid="ai-try-on-weight"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">{t("aiTryOn.gender")}</span>
          <select
            value={values.gender}
            onChange={(event) => onChange({ ...values, gender: event.target.value as TryOnFormState["gender"] })}
            className="public-input"
            data-testid="ai-try-on-gender"
          >
            <option value="female">{t("aiTryOn.genderFemale")}</option>
            <option value="male">{t("aiTryOn.genderMale")}</option>
            <option value="other">{t("aiTryOn.genderOther")}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">{t("aiTryOn.bodyType")}</span>
          <select
            value={values.bodyType}
            onChange={(event) => onChange({ ...values, bodyType: event.target.value as TryOnFormState["bodyType"] })}
            className="public-input"
            data-testid="ai-try-on-body-type"
          >
            <option value="slim">{t("aiTryOn.bodyTypeSlim")}</option>
            <option value="regular">{t("aiTryOn.bodyTypeRegular")}</option>
            <option value="large">{t("aiTryOn.bodyTypeLarge")}</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--foreground)]">{t("aiTryOn.bodyTraits")}</p>
        <div className="flex flex-wrap gap-2">
          {BODY_TRAITS.map((trait) => {
            const active = values.bodyTraits.includes(trait);
            return (
              <button
                key={trait}
                type="button"
                onClick={() => toggleTrait(trait)}
                className={`rounded-full border px-3 py-2 text-sm transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
                data-testid={`ai-try-on-trait-${trait}`}
              >
                {t(`aiTryOn.traits.${trait}`)}
              </button>
            );
          })}
        </div>
      </div>

      {requireConsent ? (
        <label className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={values.consentAccepted}
            onChange={(event) => onChange({ ...values, consentAccepted: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-[var(--border)]"
            data-testid="ai-try-on-consent"
          />
          <span>{t("aiTryOn.consent")}</span>
        </label>
      ) : null}
    </section>
  );
}
