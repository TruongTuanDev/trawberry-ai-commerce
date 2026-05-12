import { SectionCard } from "@/components/seller/section-card";

export default function SellerAiImagesPage() {
  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="AI pipeline"
        title="AI images"
        description="This route is reserved for image generation and virtual try-on flows backed by the NestJS gateway and the future dedicated AI service."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Generate image</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Queue a cleaned studio shot, lifestyle scene, or promotional asset for a product.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Virtual try-on</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Prepare model image and garment asset orchestration against the future AI service.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
