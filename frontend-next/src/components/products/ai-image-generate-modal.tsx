"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import type {
  AiCredits,
  AiStylePreset,
  AiTaskType,
  ProductImage,
} from "@/lib/seller-api";

const TASK_TYPE_OPTIONS: Array<{ value: AiTaskType; label: string }> = [
  { value: "PRODUCT_MODEL_IMAGE", label: "Product model image" },
  { value: "TRY_ON", label: "Try-on" },
  { value: "BACKGROUND_REPLACE", label: "Background replace" },
  { value: "DETAIL_SHOT", label: "Detail shot" },
];

const STYLE_PRESET_OPTIONS: Array<{ value: AiStylePreset; label: string }> = [
  { value: "MAIN_COVER", label: "Main cover" },
  { value: "STUDIO", label: "Studio" },
  { value: "LIFESTYLE", label: "Lifestyle" },
  { value: "WALKING", label: "Walking" },
  { value: "BACK_VIEW", label: "Back view" },
  { value: "DETAIL", label: "Detail" },
  { value: "TRY_ON", label: "Try-on" },
];

const aiImageFormSchema = z.object({
  inputFrontImageId: z.string().min(1, "Choose a front product image."),
  inputBackImageId: z.string().optional(),
  inputModelImageId: z.string().optional(),
  quantity: z.coerce.number().min(1).max(10),
  taskType: z.enum(["PRODUCT_MODEL_IMAGE", "TRY_ON", "BACKGROUND_REPLACE", "DETAIL_SHOT"]),
  stylePreset: z.enum(["MAIN_COVER", "STUDIO", "LIFESTYLE", "WALKING", "BACK_VIEW", "DETAIL", "TRY_ON"]),
  prompt: z.string().max(1200).optional().or(z.literal("")),
});

type AiImageFormValues = z.input<typeof aiImageFormSchema>;
type AiImageFormOutput = z.output<typeof aiImageFormSchema>;

function inferFrontImage(images: ProductImage[]) {
  return (
    images.find((image) => image.imageType === "FRONT")?.id ??
    images.find((image) => image.isMain)?.id ??
    images[0]?.id ??
    ""
  );
}

export function AiImageGenerateModal({
  open,
  productTitle,
  images,
  credits,
  submitError,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  productTitle: string;
  images: ProductImage[];
  credits: AiCredits | null;
  submitError?: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    inputFrontImageId: string;
    inputBackImageId?: string;
    inputModelImageId?: string;
    quantity: number;
    taskType: AiTaskType;
    stylePreset: AiStylePreset;
    prompt: string;
  }) => Promise<void>;
}) {
  const form = useForm<AiImageFormValues, unknown, AiImageFormOutput>({
    resolver: zodResolver(aiImageFormSchema),
    defaultValues: {
      inputFrontImageId: inferFrontImage(images),
      inputBackImageId: images.find((image) => image.imageType === "BACK")?.id ?? "",
      inputModelImageId: images.find((image) => image.imageType === "MODEL_REFERENCE")?.id ?? "",
      quantity: 1,
      taskType: "PRODUCT_MODEL_IMAGE",
      stylePreset: "STUDIO",
      prompt: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      inputFrontImageId: inferFrontImage(images),
      inputBackImageId: images.find((image) => image.imageType === "BACK")?.id ?? "",
      inputModelImageId: images.find((image) => image.imageType === "MODEL_REFERENCE")?.id ?? "",
      quantity: 1,
      taskType: "PRODUCT_MODEL_IMAGE",
      stylePreset: "STUDIO",
      prompt: "",
    });
  }, [form, images, open]);

  const [quantity, taskType, stylePreset, inputFrontImageId] = useWatch({
    control: form.control,
    name: ["quantity", "taskType", "stylePreset", "inputFrontImageId"],
  });

  const remainingCredits = credits?.remainingCredits ?? 0;
  const creditCost = typeof quantity === "number" ? quantity : 1;
  const insufficientCredit = remainingCredits < creditCost;

  const eligibleFrontImages = useMemo(
    () => images.filter((image) => image.imageType !== "MODEL_REFERENCE"),
    [images],
  );
  const eligibleBackImages = useMemo(
    () => images.filter((image) => image.id !== inputFrontImageId),
    [images, inputFrontImageId],
  );
  const modelReferenceImages = useMemo(
    () => images.filter((image) => image.imageType === "MODEL_REFERENCE"),
    [images],
  );

  const previewSummary = useMemo(() => {
    return `${creditCost} credit${creditCost > 1 ? "s" : ""} for ${taskType ?? "PRODUCT_MODEL_IMAGE"} / ${stylePreset ?? "STUDIO"} on ${productTitle}`;
  }, [creditCost, productTitle, stylePreset, taskType]);

  if (!open) {
    return null;
  }

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      inputFrontImageId: values.inputFrontImageId,
      inputBackImageId: values.inputBackImageId || undefined,
      inputModelImageId: values.inputModelImageId || undefined,
      quantity: values.quantity,
      taskType: values.taskType,
      stylePreset: values.stylePreset,
      prompt: values.prompt || "",
    });

    form.reset({
      inputFrontImageId: inferFrontImage(images),
      inputBackImageId: images.find((image) => image.imageType === "BACK")?.id ?? "",
      inputModelImageId: images.find((image) => image.imageType === "MODEL_REFERENCE")?.id ?? "",
      quantity: 1,
      taskType: "PRODUCT_MODEL_IMAGE",
      stylePreset: "STUDIO",
      prompt: "",
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,18,20,0.55)] p-3 sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">AI Generate</p>
            <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
              Generate AI Image
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{previewSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 px-5 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">AI Credits</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metric label="Remaining" value={String(remainingCredits)} />
                <Metric label="Cost" value={String(creditCost)} />
                <Metric label="After task" value={String(Math.max(remainingCredits - creditCost, 0))} />
              </div>
              {insufficientCredit ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Remaining credits are lower than the requested quantity.
                </p>
              ) : null}
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Task Preview</p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                NestJS will create a shop-scoped task, queue the worker, poll status, then let you attach completed images back into the product gallery.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <SelectField
              id="inputFrontImageId"
              label="Front product image"
              error={form.formState.errors.inputFrontImageId?.message}
              register={form.register("inputFrontImageId")}
              options={eligibleFrontImages.map((image) => ({
                value: image.id,
                label: `${image.imageType} image #${image.sortOrder + 1}${image.isMain ? " (main)" : ""}`,
              }))}
              placeholder="Select front image"
            />
            <SelectField
              id="inputBackImageId"
              label="Back product image"
              register={form.register("inputBackImageId")}
              options={eligibleBackImages.map((image) => ({
                value: image.id,
                label: `${image.imageType} image #${image.sortOrder + 1}`,
              }))}
              placeholder="Optional back image"
            />
            <SelectField
              id="inputModelImageId"
              label="Model reference image"
              register={form.register("inputModelImageId")}
              options={modelReferenceImages.map((image) => ({
                value: image.id,
                label: `Model reference #${image.sortOrder + 1}`,
              }))}
              placeholder="Optional model reference"
              helpText="Upload a product image with type MODEL_REFERENCE first if you want to reuse it here."
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[140px_1fr_1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="quantity">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                max={10}
                {...form.register("quantity")}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <SelectField
              id="taskType"
              label="Task type"
              register={form.register("taskType")}
              options={TASK_TYPE_OPTIONS}
            />
            <SelectField
              id="stylePreset"
              label="Style preset"
              register={form.register("stylePreset")}
              options={STYLE_PRESET_OPTIONS}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor="prompt">
              Additional prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              placeholder="Optional guidance such as neutral pose, clean background, focus on product texture."
              {...form.register("prompt")}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Product consistency is still enforced by the backend prompt builder and selected input images.
            </p>
          </div>

          {submitError ? (
            <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{submitError}</div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || insufficientCredit || !eligibleFrontImages.length}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating task..." : "Create AI task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SelectField({
  id,
  label,
  register,
  options,
  placeholder,
  error,
  helpText,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  helpText?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        {...register}
        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
      >
        <option value="">{placeholder ?? `Select ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-sm text-[var(--accent)]">{error}</p> : null}
      {helpText ? <p className="mt-2 text-xs text-[var(--muted)]">{helpText}</p> : null}
    </div>
  );
}
