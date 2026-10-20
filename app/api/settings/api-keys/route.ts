import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandling } from "@/lib/apiHandler";
import { requireUser } from "@/lib/auth/currentUser";
import { API_KEY_KINDS, checkApiKey, isApiKeyKind, maskKey } from "@/lib/apiKeys";
import { encryptSecret } from "@/lib/secretBox";
import type {
  ApiErrorResponse,
  RemoveApiKeyRequest,
  SaveApiKeyRequest,
  SaveApiKeyResponse,
} from "@/lib/types";

function badRequest(message: string) {
  const error: ApiErrorResponse = { error: message };
  return NextResponse.json(error, { status: 400 });
}

async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// Saves (or replaces) the signed-in person's own key. It is always their own:
// the account comes from the session, never from the request.
export const PUT = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const body = await readBody<SaveApiKeyRequest>(request);
  if (!body) return badRequest("Invalid JSON body");
  if (!isApiKeyKind(body.kind)) return badRequest("Unknown key type");
  const { label, column } = API_KEY_KINDS[body.kind];

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (key.length < 8 || key.length > 200 || /\s/.test(key)) {
    return badRequest(`That doesn't look like a ${label} key. Copy the whole token, with no spaces.`);
  }

  // Ask the service first, so a typo is caught now instead of in the middle of a job.
  const check = await checkApiKey(body.kind, key);
  if (check.result === "invalid") {
    return badRequest(`${label} doesn't accept this key. Check you copied the whole token.`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { [column]: encryptSecret(key) } });

  const response: SaveApiKeyResponse = {
    ok: true,
    hint: maskKey(key),
    verified: check.result === "valid",
    creditsLeft: check.result === "valid" ? check.creditsLeft : null,
  };
  return NextResponse.json(response);
});

export const DELETE = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const body = await readBody<RemoveApiKeyRequest>(request);
  if (!body) return badRequest("Invalid JSON body");
  if (!isApiKeyKind(body.kind)) return badRequest("Unknown key type");

  await prisma.user.update({ where: { id: user.id }, data: { [API_KEY_KINDS[body.kind].column]: null } });
  return NextResponse.json({ ok: true });
});
