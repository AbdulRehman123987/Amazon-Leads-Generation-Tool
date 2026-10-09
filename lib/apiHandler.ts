import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { ApiErrorResponse } from "@/lib/types";

/**
 * Wraps a Route Handler so it (1) requires a signed-in user — a 401 `{ error }`
 * otherwise, even if Proxy let the request through — and (2) turns any thrown
 * error (validation errors we throw ourselves, or unexpected ones like a DB
 * connection failure) into a proper `{ error }` JSON response instead of
 * Next's default HTML error page. Only the sign-in/out routes skip it.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      if (!(await getCurrentUser())) {
        const body: ApiErrorResponse = { error: "Not signed in" };
        return NextResponse.json(body, { status: 401 });
      }
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
