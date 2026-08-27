import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LayoutDashboard, Search, History, Package, Building2, Megaphone, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ToastProvider } from "@/components/Toast";
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

const ICON_CLASS = "h-4 w-4 shrink-0";

// Icons are rendered into JSX elements here (in the Server Component) rather
// than passed as component references — only serializable elements, not
// component/function values, can cross the Server -> Client Component boundary.
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard className={ICON_CLASS} /> },
  { href: "/scrape/new", label: "New Scrape", icon: <Search className={ICON_CLASS} /> },
  { href: "/jobs", label: "Jobs", icon: <History className={ICON_CLASS} /> },
  { href: "/products", label: "Products", icon: <Package className={ICON_CLASS} /> },
  { href: "/brands", label: "Brands", icon: <Building2 className={ICON_CLASS} /> },
  { href: "/ad-library", label: "Ad Library", icon: <Megaphone className={ICON_CLASS} /> },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full bg-slate-50 text-slate-900">
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-600/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Lead Scraper
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 bg-gradient-to-b from-slate-50 to-white px-8 py-8">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </body>
    </html>
  );
}
