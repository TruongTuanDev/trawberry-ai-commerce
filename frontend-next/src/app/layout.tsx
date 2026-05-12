import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";

const dmSans = DM_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-mono-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Strawberry Seller Center",
  description: "Next.js seller workspace running in parallel with the Angular application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">{children}<AuthBootstrap /></body>
    </html>
  );
}
