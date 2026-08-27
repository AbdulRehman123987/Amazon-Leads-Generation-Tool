import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";

/**
 * Wraps a Route Handler so any thrown error (validation errors we throw
 * ourselves, or unexpected ones like a DB connection failure) becomes a
 * proper `{ error }` JSON response instead of Next's default HTML error page.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      const body: ApiErrorResponse = {
        error: err instanceof Error ? err.message : "Unexpected server error",
      };
      return NextResponse.json(body, { status: 500 });
    }
  };
}
