"use client";

import { useEffect, useState } from "react";
import {
  getAdminAiTryOnSettings,
  updateAdminAiTryOnSettings,
  type AdminAiTryOnSettings,
} from "@/lib/admin-api";

type FormState = {
  enabled: boolean;
  providerMode: "mock" | "demo" | "openai";
  guestDailyLimit: string;
  customerDailyLimit: string;
  requireConsent: boolean;
  supportedCategories: string;
};

export function AdminAiSettingsPageClient() {
  const [form, setForm] = useState<FormState>({
    enabled: false,
    providerMode: "mock",
    guestDailyLimit: "3",
    customerDailyLimit: "5",
    requireConsent: true,
    supportedCategories: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrateForm = (settings: AdminAiTryOnSettings) => {
    setForm({
      enabled: settings.enabled,
      providerMode: settings.providerMode,
      guestDailyLimit: String(settings.guestDailyLimit),
      customerDailyLimit: String(settings.customerDailyLimit),
      requireConsent: settings.requireConsent,
      supportedCategories: settings.supportedCategories.join(", "),
    });
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const settings = await getAdminAiTryOnSettings();
        if (!mounted) return;
        hydrateForm(settings);
        setError(null);
      } catch (requestError) {
        if (!mounted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load AI settings.",
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
  }, []);

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
        supportedCategories: form.supportedCategories
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      hydrateForm(saved);
      setMessage("AI settings saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save AI settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
        <p className="text-sm text-[var(--muted)]">Loading AI settings...</p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-ai-settings-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          AI Settings
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          Marketplace AI try-on
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Control the public AI try-on flow, provider mode, rate limits, consent,
          and supported categories from one admin-only screen.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
          <label className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Enable AI Try-On</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Keep the public button visible, but gate the full flow here.</p>
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
              <span className="font-medium">Provider mode</span>
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
                <option value="mock">Mock</option>
                <option value="demo">Demo</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Require consent</span>
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
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Guest daily limit</span>
              <input
                value={form.guestDailyLimit}
                onChange={(event) => setForm((current) => ({ ...current, guestDailyLimit: event.target.value }))}
                inputMode="numeric"
                className="public-input"
                data-testid="admin-ai-settings-guest-limit"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--foreground)]">
              <span className="font-medium">Customer daily limit</span>
              <input
                value={form.customerDailyLimit}
                onChange={(event) => setForm((current) => ({ ...current, customerDailyLimit: event.target.value }))}
                inputMode="numeric"
                className="public-input"
                data-testid="admin-ai-settings-customer-limit"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-[var(--foreground)]">
            <span className="font-medium">Supported categories</span>
            <textarea
              value={form.supportedCategories}
              onChange={(event) => setForm((current) => ({ ...current, supportedCategories: event.target.value }))}
              rows={5}
              className="public-input min-h-32"
              placeholder="jackets, dresses, pants"
              data-testid="admin-ai-settings-supported-categories"
            />
            <span className="text-xs text-[var(--muted)]">Use comma-separated slugs or names. Leave empty to allow all public-ready products with images.</span>
          </label>

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
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Runtime notes
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
            <li>Mock and Demo stay fully local and deterministic for stable E2E and defense demos.</li>
            <li>OpenAI mode stays on the same backend to ai-service provider path and never exposes API keys to the browser.</li>
            <li>Rate limits are enforced server-side for both guests and authenticated customers.</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
