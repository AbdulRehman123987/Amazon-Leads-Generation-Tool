import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LayoutDashboard, Search, History, Package, Building2, Megaphone, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";
import { ToastProvider } from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth/currentUser";

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

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Proxy already turned away anyone without a genuine session cookie; this
  // catches a genuine cookie whose account has since been deleted. (A layout
  // isn't re-run on client-side navigation, so the API routes check again.)
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");

  return (
    <>
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-600/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">Lead Scraper</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-slate-200/70 p-3">
          <p className="truncate px-3 text-xs text-slate-500" title={user.email}>
            {user.email}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-gradient-to-b from-slate-50 to-white px-8 py-8">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </>
  );
}
