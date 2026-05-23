"use client";

import type { AiImageTask } from "@/lib/seller-api";

const statusTone: Record<AiImageTask["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-sky-50 text-sky-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-zinc-100 text-zinc-700",
};

export function AiTaskPanel({
  task,
  pollingActive,
  attachingImageId,
  onAttach,
}: {
  task: AiImageTask;
  pollingActive: boolean;
  attachingImageId: string | null;
  onAttach: (generatedImageId: string) => Promise<void>;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">AI Task</p>
          <h2 className="mt-2 font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
            AI generation status
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {task.prompt || "The backend prompt builder is combining the selected references with the chosen task type and style preset."}
          </p>
        </div>
        <div className={`rounded-full px-4 py-2 text-sm font-semibold ${statusTone[task.status]}`}>{task.status}</div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Metric label="Task type" value={task.taskType} />
        <Metric label="Style" value={task.stylePreset ?? "None"} />
        <Metric label="Quantity" value={String(task.quantity)} />
        <Metric label="Attempts" value={String(task.attemptCount)} />
        <Metric label="Credit Cost" value={String(task.creditCost)} />
        <Metric label="Provider Task" value={task.providerTaskId ?? "Pending"} />
      </div>

      {task.errorMessage ? (
        <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{task.errorMessage}</div>
      ) : null}

      {pollingActive ? (
        <div className="mt-5 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          Polling the NestJS task endpoint every 2 seconds while the worker is processing.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {task.generatedImages.length ? (
          task.generatedImages.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)]">
              <div className="aspect-[4/3] bg-[var(--panel-strong)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.thumbnailUrl ?? image.url ?? image.imageUrl}
                  alt={`AI generated image ${image.id}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                    {image.provider ?? image.storageProvider ?? "unknown"}
                  </span>
                  {image.isSelected ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  <p>
                    Size: {image.width ?? "?"} x {image.height ?? "?"}
                  </p>
                  <p className="mt-1">Created: {new Date(image.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(image.url ?? image.imageUrl, "_blank", "noopener,noreferrer")}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => void onAttach(image.id)}
                    disabled={Boolean(image.attachedImageId) || attachingImageId === image.id}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {image.attachedImageId
                      ? "Attached to product"
                      : attachingImageId === image.id
                        ? "Đang lưu..."
                        : "Attach to product"}
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] px-4 py-10 text-sm text-[var(--muted)]">
            No generated images yet. The page will keep polling until the task reaches a final state.
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
