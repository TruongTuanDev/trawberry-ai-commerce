import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { ToastProvider } from "@/components/ui/toast-provider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
        <AuthBootstrap />
      </body>
    </html>
  );
}
