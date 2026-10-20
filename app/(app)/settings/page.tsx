import { requirePageUser } from "@/lib/auth/currentUser";
import { getKeyStatuses, type ApiKeyKind } from "@/lib/apiKeys";
import { ApiKeyForm } from "@/components/ApiKeyForm";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<ApiKeyKind, string> = {
  scrapeDo:
    "Used for every Amazon search and every contact lookup (finding a brand's website, email and phone).",
  searchApi:
    "Used for Ad Library searches (finding who is running Meta ads for a product). The contact lookups for Ad Library brands use your scrape.do key.",
};

export default async function SettingsPage() {
  const user = await requirePageUser();
  const keys = await getKeyStatuses(user.id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your own API keys and everything you start runs on them, so the credits come out of your own accounts.
          Without one, searches use the team&apos;s shared key.
        </p>
      </div>

      {keys.map((key) => (
        <ApiKeyForm
          key={key.kind}
          kind={key.kind}
          label={key.label}
          description={DESCRIPTIONS[key.kind]}
          state={key.state}
          hint={key.hint}
          hasSaved={key.hasSaved}
        />
      ))}
    </div>
  );
}
