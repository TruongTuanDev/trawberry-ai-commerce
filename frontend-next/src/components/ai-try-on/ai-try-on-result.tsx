"use client";

import { FallbackImage } from "@/components/ui/fallback-image";
import type { AiTryOnTask } from "@/lib/public-api";

export function AiTryOnResult({
  task,
  t,
}: {
  task: AiTryOnTask;
  t: (key: string) => string;
}) {
  const note = task.sizeRecommendation.noteRu ?? task.sizeRecommendation.noteEn ?? task.sizeRecommendation.note;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
        {task.resultImageUrl || task.resultImage?.url ? (
          <FallbackImage
            src={task.resultImageUrl || task.resultImage?.url}
            alt="AI try-on result"
            className="h-full min-h-[360px] w-full object-cover"
            testId="ai-try-on-result-image"
          />
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-rose-600" data-testid="ai-try-on-success-no-image">
            <span className="text-4xl">❌</span>
            <span className="font-semibold text-rose-600">AI generated a recommendation but no image was returned.</span>
          </div>
        )}
      </div>

      <aside className="space-y-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t("aiTryOn.suggestedSize")}
          </p>
          <p className="mt-3 text-2xl font-bold text-[var(--foreground)]" data-testid="ai-try-on-suggested-size">
            {task.sizeRecommendation.recommendedRussianSize ??
              task.sizeRecommendation.recommendedSize ??
              "-"}
          </p>
          {task.sizeRecommendation.recommendedSize &&
          task.sizeRecommendation.recommendedRussianSize ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {task.sizeRecommendation.recommendedSize}
            </p>
          ) : null}
        </div>
        <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
          {note ?? t("aiTryOn.referenceOnly")}
        </div>
        <p className="text-xs leading-6 text-[var(--muted)]">{t("aiTryOn.referenceOnly")}</p>
      </aside>
    </section>
  );
}
