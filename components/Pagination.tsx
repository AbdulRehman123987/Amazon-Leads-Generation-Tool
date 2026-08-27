import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  hasNext,
  buildHref,
}: {
  page: number;
  hasNext: boolean;
  buildHref: (page: number) => string;
}) {
  const baseClass =
    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors";
  const enabledClass = "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50";
  const disabledClass = "border-slate-100 text-slate-300 pointer-events-none";

  return (
    <div className="flex items-center gap-3">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className={`${baseClass} ${enabledClass}`}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </span>
      )}
      <span className="text-sm font-medium text-slate-500">Page {page}</span>
      {hasNext ? (
        <Link href={buildHref(page + 1)} className={`${baseClass} ${enabledClass}`}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>
          Next
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
