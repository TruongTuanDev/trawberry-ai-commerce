import { SectionCard } from "@/components/seller/section-card";

export default function SellerSettingsPage() {
  return (
    <SectionCard
      eyebrow="Workspace"
      title="Settings"
      description="This area will host shop metadata, integration settings, and auth hardening follow-ups such as cookie-based sessions."
    >
      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 text-sm leading-6 text-[var(--muted)]">
        Shop switcher and settings forms are intentionally left as placeholders for this bootstrap pass.
      </div>
    </SectionCard>
  );
}
