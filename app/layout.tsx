import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amazon Lead Scraper",
  description:
    "Find low-performing Amazon products, identify their brands, and build a contact list for outreach.",
};

// Just the document shell, shared by the sign-in page and the app. The sidebar
// lives in app/(app)/layout.tsx so the sign-in page doesn't get it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
