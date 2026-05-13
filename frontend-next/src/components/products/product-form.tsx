"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
      setFormError(error instanceof Error ? error.message : "Unable to save product.");
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Metadata</p>
        <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
          Product editor
        </h2>
      </div>

      <div className="grid gap-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="localTitle">
            Local title
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
            Local description
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
              SEO slug
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
              Visibility
            </label>
            <select
              id="visibility"
              {...form.register("visibility")}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              data-testid="product-visibility"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
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
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
