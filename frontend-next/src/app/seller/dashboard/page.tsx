import { SectionCard } from "@/components/seller/section-card";

const metrics = [
  { label: "Open orders", value: "27", tone: "text-[var(--accent)]" },
  { label: "Products synced", value: "184", tone: "text-[var(--success)]" },
  { label: "Image tasks", value: "12", tone: "text-[var(--warning)]" },
];

export default function SellerDashboardPage() {
  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Overview"
        title="Dashboard"
        description="This seller dashboard is the first Next.js shell for the migration. Replace placeholders with live KPI calls as NestJS modules expand."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{metric.label}</p>
              <p className={`mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold ${metric.tone}`}>
                {metric.value}
              </p>
            </article>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        eyebrow="Migration status"
        title="Parallel rollout"
        description="Angular remains untouched. This Next.js area is ready to absorb seller flows incrementally while NestJS replaces Spring Boot modules."
      />
    </div>
  );
}
