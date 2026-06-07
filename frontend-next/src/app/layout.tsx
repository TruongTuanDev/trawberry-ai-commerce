import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { I18nBootstrap } from "@/components/i18n/i18n-bootstrap";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/i18n/config";
import { getRecommendationFlags } from "@/lib/recommendation-flags";
import { getVisualSearchFlags } from "@/lib/visual-search-flags";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans-app",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-app",
  display: "swap",
});

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
  const visualSearchFlags = getVisualSearchFlags();

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body
        className="min-h-screen"
        data-public-recommendations-enabled={String(
          recommendationFlags.publicRecommendationsEnabled,
        )}
        data-recommendation-tracking-enabled={String(
          recommendationFlags.recommendationTrackingEnabled,
        )}
        data-recommendation-explainability-enabled={String(
          recommendationFlags.recommendationExplainabilityEnabled,
        )}
        data-recommendation-qa-tools-enabled={String(
          recommendationFlags.recommendationQaToolsEnabled,
        )}
        data-recommendation-analytics-tuning-enabled={String(
          recommendationFlags.recommendationAnalyticsTuningEnabled,
        )}
        data-public-visual-search-enabled={String(
          visualSearchFlags.publicVisualSearchEnabled,
        )}
        data-visual-search-tracking-enabled={String(
          visualSearchFlags.visualSearchTrackingEnabled,
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
