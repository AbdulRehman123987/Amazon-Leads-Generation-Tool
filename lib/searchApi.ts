/**
 * Client wrapper for SearchAPI.io's Meta Ad Library engine — the single
 * entry point for every call to it, mirroring lib/scrapeDo.ts's role for
 * scrape.do. UNVERIFIED against live output: built from
 * https://www.searchapi.io/docs/meta-ad-library-api with no API key
 * available at write time. If results look wrong once a real
 * SEARCHAPI_API_KEY is in place, this is the file to check first —
 * particularly parseSearchResponse's field mapping.
 */

const SEARCHAPI_BASE_URL = "https://www.searchapi.io/api/v1/search";
const REQUEST_TIMEOUT_MS = 30_000;

export interface MetaAdLibraryAd {
  adArchiveId: string;
  isActive: boolean;
  pageId: string;
  pageName: string;
  pageProfileUri: string | null;
  pageProfilePicture: string | null;
  pageLikeCount: number | null;
  pageCategory: string | null;
  bodyText: string | null;
}

export interface MetaAdLibrarySearchResult {
  ads: MetaAdLibraryAd[];
  nextPageToken: string | null;
  totalResults: number | null;
}

export class SearchApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "SearchApiError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseSearchResponse(json: unknown): MetaAdLibrarySearchResult {
  const data = asRecord(json);
  const rawAds = Array.isArray(data.ads) ? data.ads : [];

  const ads: MetaAdLibraryAd[] = rawAds
    .map((raw): MetaAdLibraryAd | null => {
      const ad = asRecord(raw);
      const pageId = typeof ad.page_id === "string" ? ad.page_id : null;
      const pageName = typeof ad.page_name === "string" ? ad.page_name : null;
      if (!pageId || !pageName) return null;

      const snapshot = asRecord(ad.snapshot);
      const body = asRecord(snapshot.body);
      const categories = Array.isArray(snapshot.page_categories) ? snapshot.page_categories : [];

      return {
        adArchiveId: typeof ad.ad_archive_id === "string" ? ad.ad_archive_id : "",
        // active_status=active is requested server-side, but a missing/undefined
        // field shouldn't silently read as "not active" — only an explicit
        // `false` should exclude it.
        isActive: ad.is_active !== false,
        pageId,
        pageName,
        pageProfileUri: typeof snapshot.page_profile_uri === "string" ? snapshot.page_profile_uri : null,
        pageProfilePicture:
          typeof snapshot.page_profile_picture_url === "string" ? snapshot.page_profile_picture_url : null,
        pageLikeCount: typeof snapshot.page_like_count === "number" ? snapshot.page_like_count : null,
        pageCategory: typeof categories[0] === "string" ? categories[0] : null,
        bodyText: typeof body.text === "string" ? body.text : null,
      };
    })
    .filter((ad): ad is MetaAdLibraryAd => ad !== null);

  const pagination = asRecord(data.pagination);
  const searchInfo = asRecord(data.search_information);

  return {
    ads,
    nextPageToken: typeof pagination.next_page_token === "string" ? pagination.next_page_token : null,
    totalResults: typeof searchInfo.total_results === "number" ? searchInfo.total_results : null,
  };
}

/**
 * Searches the Meta Ad Library for ads matching `keyword`. Defaults to only
 * currently-active ads (active_status=active) since that's the whole point
 * of this app's "N ads currently running" filter.
 */
export async function searchMetaAdLibrary(
  keyword: string,
  options: { activeStatus?: "active" | "inactive" | "all"; pageToken?: string } = {}
): Promise<MetaAdLibrarySearchResult> {
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SEARCHAPI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const params = new URLSearchParams({
    engine: "meta_ad_library",
    q: keyword,
    api_key: apiKey,
    active_status: options.activeStatus ?? "active",
  });
  if (options.pageToken) params.set("next_page_token", options.pageToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SEARCHAPI_BASE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new SearchApiError(
      isAbort
        ? `SearchAPI.io request timed out after ${REQUEST_TIMEOUT_MS}ms searching for "${keyword}"`
        : `SearchAPI.io request failed for "${keyword}": ${(err as Error).message}`,
      0
    );
  }
  clearTimeout(timer);

  const body = await response.text();
  if (!response.ok) {
    throw new SearchApiError(
      `SearchAPI.io returned ${response.status} for "${keyword}": ${body.slice(0, 300)}`,
      response.status,
      body
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new SearchApiError(
      `SearchAPI.io returned a non-JSON response for "${keyword}"`,
      response.status,
      body.slice(0, 300)
    );
  }

  return parseSearchResponse(json);
}
