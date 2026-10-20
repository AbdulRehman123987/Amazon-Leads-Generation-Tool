import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in — Lead Scraper" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-600/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">to continue to Lead Scraper</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are created by your admin.
        </p>
      </div>
    </main>
  );
}
