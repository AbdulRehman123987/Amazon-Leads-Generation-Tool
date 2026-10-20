import { avatarColorFor } from "@/lib/avatarColor";
import type { TeamMemberStats } from "@/lib/teamStats";

// The four ways a brand's contact lookup can stand — the same colors as the
// status badges everywhere else.
const STATUS_COLUMNS = [
  { key: "found", label: "Found", dot: "bg-emerald-500", bar: "bg-emerald-500", hint: "Website and email found" },
  { key: "partial", label: "Partial", dot: "bg-amber-500", bar: "bg-amber-400", hint: "Only a website or only an email found" },
  { key: "notFound", label: "Not found", dot: "bg-rose-500", bar: "bg-rose-400", hint: "Looked up, nothing found" },
  { key: "pending", label: "Pending", dot: "bg-slate-400", bar: "bg-slate-300", hint: "Not looked up yet, or being looked up now" },
] as const;

const HEADER = "px-4 py-2.5 font-medium whitespace-nowrap";
const CELL = "px-4 py-3.5 tabular-nums";

function Count({ value }: { value: number }) {
  return value === 0 ? <span className="text-slate-300">0</span> : <>{value.toLocaleString()}</>;
}

function KeyChip({ label, saved }: { label: string; saved: boolean }) {
  return (
    <span
      title={saved ? `Has saved their own ${label} key` : `No own ${label} key — uses the shared one`}
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        saved ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}

function StatusBar({ stats }: { stats: TeamMemberStats }) {
  if (stats.brands === 0) return null;
  return (
    <div
      className="mt-1.5 flex h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
      title={STATUS_COLUMNS.map((col) => `${col.label} ${stats[col.key]}`).join(" · ")}
    >
      {STATUS_COLUMNS.map(
        (col) =>
          stats[col.key] > 0 && (
            <div
              key={col.key}
              className={col.bar}
              style={{ width: `${(stats[col.key] / stats.brands) * 100}%` }}
            />
          )
      )}
    </div>
  );
}

/** Admin dashboard: what each person has searched, found, and where their lookups stand. */
export function TeamStats({ rows }: { rows: TeamMemberStats[] }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Team activity</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Per person: searches run, brands found, and how their contact lookups stand. Everything from before
          accounts owned their own data counts under the admin.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-400">
              <th className="px-6 py-2.5 font-medium">Employee</th>
              <th className={HEADER}>Searches</th>
              <th className={HEADER}>Products</th>
              <th className={HEADER}>Brands</th>
              {STATUS_COLUMNS.map((col) => (
                <th key={col.key} className={HEADER} title={col.hint}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} aria-hidden />
                    {col.label}
                  </span>
                </th>
              ))}
              <th className={HEADER} title="Brands that have an email address">With email</th>
              <th className={HEADER} title="Brands that went out in a CSV export">Exported</th>
              <th className={HEADER} title="Advertisers found in the Ad Library, and how many of them have contact details">
                Ad Library
              </th>
              <th
                className={HEADER}
                title="Whether they saved their own scrape.do and SearchAPI.io keys (otherwise they use the shared ones)"
              >
                Own keys
              </th>
              <th className={HEADER}>Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((stats) => {
              const name = stats.email ?? "Unassigned";
              const searches = stats.amazonSearches + stats.adLibrarySearches;
              return (
                <tr key={stats.userId ?? "unassigned"} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColorFor(name)}`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[220px] truncate font-medium text-slate-800" title={name}>
                            {name}
                          </span>
                          {stats.role === "ADMIN" && (
                            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                              Admin
                            </span>
                          )}
                        </div>
                        {stats.userId === null && (
                          <p className="text-[11px] text-slate-400">Left behind by deleted accounts</p>
                        )}
                        {stats.activeJobs > 0 && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                            {stats.activeJobs} running
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={CELL}>
                    <div className="font-semibold text-slate-900">
                      <Count value={searches} />
                    </div>
                    {searches > 0 && (
                      <div className="whitespace-nowrap text-[11px] font-normal text-slate-400">
                        {stats.amazonSearches} Amazon · {stats.adLibrarySearches} Ad Library
                      </div>
                    )}
                  </td>
                  <td className={CELL}>
                    <Count value={stats.products} />
                  </td>
                  <td className={CELL}>
                    <div className="font-semibold text-slate-900">
                      <Count value={stats.brands} />
                    </div>
                    <StatusBar stats={stats} />
                  </td>
                  {STATUS_COLUMNS.map((col) => (
                    <td key={col.key} className={CELL}>
                      <Count value={stats[col.key]} />
                    </td>
                  ))}
                  <td className={CELL}>
                    <Count value={stats.withEmail} />
                  </td>
                  <td className={CELL}>
                    <Count value={stats.exported} />
                  </td>
                  <td className={CELL}>
                    <Count value={stats.adLibraryBrands} />
                    {stats.adLibraryBrands > 0 && (
                      <div className="whitespace-nowrap text-[11px] text-slate-400">
                        {stats.adLibraryWithContact} with contact
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {stats.userId === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <KeyChip label="scrape.do" saved={stats.hasScrapeDoKey} />
                        <KeyChip label="SearchAPI" saved={stats.hasSearchApiKey} />
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                    {stats.lastActiveAt ? stats.lastActiveAt.toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
