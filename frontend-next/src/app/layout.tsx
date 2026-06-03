import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { I18nBootstrap } from "@/components/i18n/i18n-bootstrap";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/i18n/config";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

export const metadata: Metadata = {
 title: "Skidkaberry AI Commerce",
  description: "Next-gen smart marketplace and automated seller workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const recommendationFlags = getRecommendationFlags();

  return (
    <html lang="en">
      <body
        className="min-h-screen"
        data-public-recommendations-enabled={String(
          recommendationFlags.publicRecommendationsEnabled,
        )}
        data-recommendation-tracking-enabled={String(
          recommendationFlags.recommendationTrackingEnabled,
        )}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
        <AuthBootstrap />
        <I18nBootstrap initialLocale={initialLocale} />
      </body>
    </html>
  );
}
