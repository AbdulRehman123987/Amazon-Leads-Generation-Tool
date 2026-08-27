/**
 * Adapter seam for a future paid email-finding provider (Hunter.io or
 * similar). Nothing calls this yet — the regex/mailto extractor in
 * extractContact.ts is the only active email source. Wire this in once
 * HUNTER_API_KEY is set, by implementing hunterProvider.lookup() to call
 * Hunter's Domain Search / Email Finder API and having the enrichment runner
 * fall back to it when the regex extractor comes up empty.
 */

export interface EmailLookupResult {
  email: string | null;
  confidence: number | null;
}

export interface EmailProvider {
  name: string;
  lookup(input: { domain: string; companyName: string }): Promise<EmailLookupResult>;
}

export const hunterProvider: EmailProvider = {
  name: "hunter",
  async lookup() {
    throw new Error(
      "Hunter.io provider not implemented — set HUNTER_API_KEY and implement " +
        "lib/enrichment/emailProvider.ts's hunterProvider.lookup()."
    );
  },
};
