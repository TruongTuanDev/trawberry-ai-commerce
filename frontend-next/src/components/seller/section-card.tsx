import { clsx } from "clsx";

export function SectionCard({
  title,
  eyebrow,
  description,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("card-panel rounded-[1.75rem] p-6", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{eyebrow}</p>
      ) : null}
      <div className="mt-2">
        <h2 className="font-[family-name:var(--font-mono-app)] text-2xl font-bold text-[var(--foreground)]">
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
