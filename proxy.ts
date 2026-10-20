import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Everything except the sign-in page and its endpoints needs a signed-in user.
// This only checks that the session cookie is genuine and unexpired (no
// database, so it stays cheap on every request, prefetches included); the
// check that the account still exists is in lib/auth/currentUser.ts, used by
// the app layout and the API routes.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

// Proxy redirects must be absolute URLs. Built from the Host header the browser
// actually used, not request.url: behind Docker or a reverse proxy that can
// carry the server's own hostname (0.0.0.0), which the browser can't reach.
function redirectTo(request: NextRequest, path: string) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, origin), 307);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let signedIn: boolean;
  try {
    signedIn = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value) !== null;
  } catch (err) {
    // AUTH_SECRET missing — say so instead of failing every page with a blank error.
    return new NextResponse((err as Error).message, { status: 500 });
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return pathname === "/login" && signedIn ? redirectTo(request, "/") : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return redirectTo(request, pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
