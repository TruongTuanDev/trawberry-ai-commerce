"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import { trackOrderByCode } from "@/lib/public-api";

export function OrderTrackPageClient() {
  const { t } = useI18n("customer");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderCode, setOrderCode] = useState(searchParams.get("orderCode") ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!orderCode.trim() || !phone.trim()) {
      setError(getLocalizedErrorMessage({ role: "customer", error: { message: "VALIDATION_ERROR" } }));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tracked = await trackOrderByCode(orderCode.trim(), phone.trim());
      router.push(`/orders/${tracked.orderId}?phone=${encodeURIComponent(phone.trim())}`);
    } catch (err) {
      setError(getLocalizedErrorMessage({ role: "customer", error: err, fallbackKey: "errors.default" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="card-panel rounded-[2.25rem] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("orderTrack.title")}</p>
            <h1 className="text-gradient-primary mt-4 font-[family-name:var(--font-mono-app)] text-4xl font-bold sm:text-5xl">
              {t("orderTrack.hero")}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              {t("orderTrack.description")}
            </p>

            {error ? (
              <div className="mt-6 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {error}
              </div>
            ) : null}

            <div className="mt-8 grid gap-4">
              <Field label={t("orderTrack.orderCode")}>
                <input
                  value={orderCode}
                  onChange={(event) => setOrderCode(event.target.value)}
                  placeholder="ORD-..."
                  className="public-input"
                  data-testid="track-order-code"
                />
              </Field>
              <Field label={t("orderTrack.phone")}>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t("orderTrack.phone")}
                  className="public-input"
                  data-testid="track-order-phone"
                />
              </Field>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                className="public-button-primary mt-2 px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="track-order-submit"
              >
                {loading ? t("orderTrack.tracking") : t("orderTrack.submit")}
              </button>
            </div>
          </section>

          <section className="card-panel rounded-[2.25rem] bg-[linear-gradient(180deg,rgba(203,17,171,0.03),rgba(161,0,255,0.05))] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("orderTrack.whatYouCanDo")}</p>
            <div className="mt-6 grid gap-4">
              {[
                t("orderTrack.action1"),
                t("orderTrack.action2"),
                t("orderTrack.action3"),
              ].map((item) => (
                <div key={item} className="rounded-[1.35rem] border border-[var(--border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
