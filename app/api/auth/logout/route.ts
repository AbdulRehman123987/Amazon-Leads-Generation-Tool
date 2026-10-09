import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSecureRequest, sessionCookieOptions } from "@/lib/auth/session";

function clearSession(response: NextResponse, request: Request) {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(isSecureRequest(request)), maxAge: 0 });
  return response;
}

// Public (see proxy.ts): signing out must work even when the session is no
// longer valid.
export async function POST(request: Request) {
  return clearSession(NextResponse.json({ ok: true }), request);
}

// Used by the app layout when a signed cookie belongs to an account that has
// been deleted: clears it and lands on the sign-in page, instead of looping.
export async function GET(request: Request) {
  return clearSession(
    new NextResponse(null, { status: 307, headers: { Location: "/login" } }),
    request
  );
}
