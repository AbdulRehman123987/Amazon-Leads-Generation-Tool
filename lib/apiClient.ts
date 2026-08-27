async function requestJson<TResponse>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<TResponse> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as TResponse;
}

export const postJson = <TResponse>(url: string, body: unknown) =>
  requestJson<TResponse>(url, "POST", body);

export const patchJson = <TResponse>(url: string, body: unknown) =>
  requestJson<TResponse>(url, "PATCH", body);
