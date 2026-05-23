import { Suspense } from "react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export function PublicShell({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "hero";
}) {
  return (
    <div
      className="grain-overlay min-h-screen"
      data-testid="public-shell"
      style={{
        background:
          tone === "hero"
            ? "radial-gradient(circle at top left, rgba(203,17,171,0.16), transparent 24%), radial-gradient(circle at 85% 10%, rgba(161,0,255,0.14), transparent 20%), linear-gradient(180deg, #f4f2fb 0%, #ffffff 38%, #fff7fd 100%)"
            : undefined,
      }}
    >
      <div className="relative z-10 flex min-h-screen flex-col">
        <Suspense fallback={<div className="h-[110px]" />}>
          <PublicHeader />
        </Suspense>
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </div>
  );
}
