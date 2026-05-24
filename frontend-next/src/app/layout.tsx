import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { I18nBootstrap } from "@/components/i18n/i18n-bootstrap";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/i18n/config";

const dmSans = DM_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-mono-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Strawberry AI Commerce",
  description: "Public marketplace and seller workspace running on the new Next.js and NestJS stack.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);

  return (
    <html lang="en" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
        <AuthBootstrap />
        <I18nBootstrap initialLocale={initialLocale} />
      </body>
    </html>
  );
}
