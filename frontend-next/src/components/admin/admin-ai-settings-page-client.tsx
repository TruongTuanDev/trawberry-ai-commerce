"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRecommendedCategoryIds,
  parseSupportedCategoryValues,
} from "@/lib/ai-try-on-supported-categories";
import {
  getAdminAiTryOnSettings,
  getAdminCategories,
  updateAdminAiTryOnSettings,
  type AdminAiTryOnSettings,
  type AdminCategoryOption,
} from "@/lib/admin-api";
import { useI18n } from "@/i18n/use-i18n";

type FormState = {
  enabled: boolean;
  providerMode: "mock" | "demo" | "openai";
  guestDailyLimit: string;
  customerDailyLimit: string;
  requireConsent: boolean;
  selectedCategoryIds: string[];
  unknownCategories: string[];
  categorySearch: string;
};

function unique(values: string[]) {
  return [...new Set(values)];
}

export function AdminAiSettingsPageClient() {
  const { t } = useI18n("admin");
  const [form, setForm] = useState<FormState>({
    enabled: false,
    providerMode: "mock",
    guestDailyLimit: "3",
    customerDailyLimit: "5",
    requireConsent: true,
    selectedCategoryIds: [],
    unknownCategories: [],
    categorySearch: "",
  });
  const [categories, setCategories] = useState<AdminCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<Pick<
    AdminAiTryOnSettings,
    "providerConfigured" | "aiServiceReachable" | "providerSafeErrorCode"
  > | null>(null);

  const selectedCount = form.selectedCategoryIds.length + form.unknownCategories.length;
  const hasUnknownCategories = form.unknownCategories.length > 0;
  const recommendedCategoryIds = useMemo(
    () => getRecommendedCategoryIds(categories),
    [categories],
  );
  const filteredCategories = useMemo(() => {
    const query = form.categorySearch.trim().toLowerCase();
    if (!query) {
      return categories;
    }

    return categories.filter((category) =>
      category.name.toLowerCase().includes(query),
    );
  }, [categories, form.categorySearch]);

  const hydrateForm = (
    settings: AdminAiTryOnSettings,
    nextCategories: AdminCategoryOption[],
  ) => {
    const parsed = parseSupportedCategoryValues(
      settings.supportedCategories,
      nextCategories,
    );
    setForm((current) => ({
      ...current,
      enabled: settings.enabled,
      providerMode: settings.providerMode,
      guestDailyLimit: String(settings.guestDailyLimit),
      customerDailyLimit: String(settings.customerDailyLimit),
      requireConsent: settings.requireConsent,
      selectedCategoryIds: parsed.knownIds,
      unknownCategories: parsed.unknownValues,
    }));
    setRuntime({
      providerConfigured: settings.providerConfigured,
      aiServiceReachable: settings.aiServiceReachable,
      providerSafeErrorCode: settings.providerSafeErrorCode,
    });
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [settings, nextCategories] = await Promise.all([
          getAdminAiTryOnSettings(),
          getAdminCategories(),
        ]);
        if (!mounted) return;
        setCategories(nextCategories);
        hydrateForm(settings, nextCategories);
        setError(null);
      } catch (requestError) {
        if (!mounted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("adminAiSettings.loadFailed"),
        );
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
  }, [t]);

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      selectedCategoryIds: checked
        ? unique([...current.selectedCategoryIds, categoryId])
        : current.selectedCategoryIds.filter((value) => value !== categoryId),
    }));
  };

  const toggleUnknownCategory = (value: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      unknownCategories: checked
        ? unique([...current.unknownCategories, value])
        : current.unknownCategories.filter((entry) => entry !== value),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await updateAdminAiTryOnSettings({
        enabled: form.enabled,
        providerMode: form.providerMode,
        guestDailyLimit: Number(form.guestDailyLimit || 0),
        customerDailyLimit: Number(form.customerDailyLimit || 0),
        requireConsent: form.requireConsent,
        supportedCategories: unique([
          ...form.selectedCategoryIds,
          ...form.unknownCategories,
        ]),
      });
      hydrateForm(saved, categories);
      setMessage(t("adminAiSettings.saved"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("adminAiSettings.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
        <p className="text-sm text-[var(--muted)]">{t("adminAiSettings.loading")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-ai-settings-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {t("adminAiSettings.eyebrow")}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          {t("adminAiSettings.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {t("adminAiSettings.description")}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
          <label className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{t("adminAiSettings.enableLabel")}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t("adminAiSettings.enableHint")}</p>
            </div>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              data-testid="admin-ai-settings-enabled"
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">{t("adminAiSettings.providerModeLabel")}</span>
              <select
                value={form.providerMode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    providerMode: event.target.value as FormState["providerMode"],
                  }))
                }
                className="public-input"
                data-testid="admin-ai-settings-provider-mode"
              >
                <option value="mock">{t("adminAiSettings.providerModes.mock")}</option>
                <option value="demo">{t("adminAiSettings.providerModes.demo")}</option>
                <option value="openai">{t("adminAiSettings.providerModes.openai")}</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">{t("adminAiSettings.requireConsentLabel")}</span>
              <select
                value={form.requireConsent ? "true" : "false"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requireConsent: event.target.value === "true",
                  }))
                }
                className="public-input"
                data-testid="admin-ai-settings-require-consent"
              >
                <option value="true">{t("common.yes")}</option>
                <option value="false">{t("common.no")}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">{t("adminAiSettings.guestDailyLimitLabel")}</span>
              <input
                value={form.guestDailyLimit}
                onChange={(event) => setForm((current) => ({ ...current, guestDailyLimit: event.target.value }))}
                inputMode="numeric"
                className="public-input"
                data-testid="admin-ai-settings-guest-limit"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">{t("adminAiSettings.customerDailyLimitLabel")}</span>
              <input
                value={form.customerDailyLimit}
                onChange={(event) => setForm((current) => ({ ...current, customerDailyLimit: event.target.value }))}
                inputMode="numeric"
                className="public-input"
                data-testid="admin-ai-settings-customer-limit"
              />
            </label>
          </div>

          <section
            className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4"
            data-testid="admin-ai-settings-supported-categories"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    {t("adminAiSettings.supportedCategoriesLabel")}
                  </h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                    {t("adminAiSettings.selectedCount", { count: selectedCount })}
                  </span>
                </div>
                <p className="max-w-3xl text-xs leading-6 text-[var(--muted)]">
                  {t("adminAiSettings.supportedCategoriesHelp")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      selectedCategoryIds: unique(recommendedCategoryIds),
                    }))
                  }
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  data-testid="admin-ai-settings-select-recommended"
                >
                  {t("adminAiSettings.selectRecommended")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      selectedCategoryIds: [],
                      unknownCategories: [],
                    }))
                  }
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  data-testid="admin-ai-settings-clear-all"
                >
                  {t("adminAiSettings.clearAll")}
                </button>
              </div>
            </div>

            {categories.length > 8 ? (
              <input
                value={form.categorySearch}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categorySearch: event.target.value,
                  }))
                }
                className="public-input"
                placeholder={t("adminAiSettings.categorySearchPlaceholder")}
                data-testid="admin-ai-settings-category-search"
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const checked = form.selectedCategoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-[1.25rem] border px-4 py-3 transition ${
                      checked
                        ? "border-[var(--accent)] bg-white shadow-sm"
                        : "border-[var(--border)] bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleCategory(category.id, event.target.checked)}
                      className="mt-1"
                      data-testid={`admin-ai-settings-supported-category-${category.id}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {category.name}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {t("adminAiSettings.categoryCount", { count: category.productCount })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {filteredCategories.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                {t("adminAiSettings.noCategoriesFound")}
              </div>
            ) : null}

            {hasUnknownCategories ? (
              <div className="space-y-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">{t("adminAiSettings.unknownTitle")}</p>
                  <p className="mt-1 text-xs leading-6 text-amber-800">{t("adminAiSettings.unknownHelp")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.unknownCategories.map((value) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900"
                    >
                      <input
                        type="checkbox"
                        checked
                        onChange={(event) => toggleUnknownCategory(value, event.target.checked)}
                        data-testid={`admin-ai-settings-unknown-category-${value}`}
                      />
                      <span>{value}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {message ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="admin-ai-settings-success">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="admin-ai-settings-error">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="admin-ai-settings-save"
            >
              {saving ? t("adminAiSettings.saving") : t("adminAiSettings.save")}
            </button>
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t("adminAiSettings.runtimeNotesTitle")}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
            <li>{t("adminAiSettings.runtimeNotes.mock")}</li>
            <li>{t("adminAiSettings.runtimeNotes.openai")}</li>
            <li>{t("adminAiSettings.runtimeNotes.limits")}</li>
          </ul>
          {form.providerMode === "openai" ? (
            <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
              <p className="font-semibold">{t("adminAiSettings.openAiHint")}</p>
              <p className="mt-2" data-testid="admin-ai-settings-openai-status">
                {t("adminAiSettings.openAiStatus", {
                  status:
                    runtime?.aiServiceReachable === false
                      ? t("adminAiSettings.runtimeStatus.unreachable")
                      : runtime?.providerConfigured
                        ? t("adminAiSettings.runtimeStatus.configured")
                        : t("adminAiSettings.runtimeStatus.notConfigured"),
                })}
              </p>
              {runtime?.providerSafeErrorCode ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t("adminAiSettings.safeStatusCode", {
                    code: runtime.providerSafeErrorCode,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
