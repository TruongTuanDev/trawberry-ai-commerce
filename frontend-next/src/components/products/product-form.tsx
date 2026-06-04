"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/i18n/use-i18n";
import type { ProductDetail, UpdateProductPayload } from "@/lib/seller-api";

const productFormSchema = z.object({
  localTitle: z.string().max(500).optional().or(z.literal("")),
  localDescription: z.string().optional().or(z.literal("")),
  seoSlug: z.string().max(500).optional().or(z.literal("")),
  visibility: z.string().min(1),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function ProductForm({
  product,
  saving,
  onSubmit,
}: {
  product: ProductDetail;
  saving: boolean;
  onSubmit: (payload: UpdateProductPayload) => Promise<void>;
}) {
  const { t } = useI18n("seller");
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      localTitle: product.localTitle ?? "",
      localDescription: product.localDescription ?? "",
      seoSlug: product.seoSlug ?? "",
      visibility: product.visibility ?? "ACTIVE",
    },
  });

  useEffect(() => {
    form.reset({
      localTitle: product.localTitle ?? "",
      localDescription: product.localDescription ?? "",
      seoSlug: product.seoSlug ?? "",
      visibility: product.visibility ?? "ACTIVE",
    });
  }, [form, product]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await onSubmit({
        localTitle: values.localTitle || undefined,
        localDescription: values.localDescription || undefined,
        seoSlug: values.seoSlug || undefined,
        visibility: values.visibility,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("seller.products.form.saveFailed"));
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("seller.products.form.metadata")}</p>
        <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
          {t("seller.products.form.title")}
        </h2>
      </div>

      <div className="grid gap-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="localTitle">
            {t("seller.products.form.localTitle")}
          </label>
          <input
            id="localTitle"
            {...form.register("localTitle")}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
            data-testid="product-local-title"
          />
          {form.formState.errors.localTitle ? (
            <p className="mt-2 text-sm text-[var(--accent)]">{form.formState.errors.localTitle.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="localDescription">
            {t("seller.products.form.localDescription")}
          </label>
          <textarea
            id="localDescription"
            rows={5}
            {...form.register("localDescription")}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
            data-testid="product-local-description"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="seoSlug">
              {t("seller.products.form.seoSlug")}
            </label>
            <input
              id="seoSlug"
              {...form.register("seoSlug")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              data-testid="product-seo-slug"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="visibility">
              {t("seller.products.form.visibility")}
            </label>
            <select
              id="visibility"
              {...form.register("visibility")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              data-testid="product-visibility"
            >
              <option value="ACTIVE">{t("seller.products.filters.statusOptions.active")}</option>
              <option value="INACTIVE">{t("seller.products.filters.statusOptions.inactive")}</option>
              <option value="DRAFT">{t("seller.products.filters.statusOptions.draft")}</option>
              <option value="ARCHIVED">{t("seller.products.filters.statusOptions.archived")}</option>
            </select>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{formError}</div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="product-save"
        >
          {saving ? t("seller.products.form.saving") : t("seller.products.form.saveChanges")}
        </button>
      </div>
    </form>
  );
}
