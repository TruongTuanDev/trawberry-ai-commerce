"use client";

type TryOnFormState = {
  heightCm: string;
  weightKg: string;
  gender: "male" | "female" | "other";
  bodyType: "slim" | "regular" | "large";
  bodyTraits: string[];
  consentAccepted: boolean;
};

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

      <label className="block space-y-2 text-sm text-[var(--foreground)]">
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
