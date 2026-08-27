/**
 * Normalize an unknown thrown value into a readable, agent-friendly message.
 * Google/Gaxios errors carry `status`/`code` plus an `errors[]` array with
 * `reason`/`message` — surfacing those lets the model react instead of seeing
 * only a bare `err.message`.
 */
export function formatError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "number") return `Error ${err}`;

  const e = err as {
    status?: number;
    code?: number | string;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    response?: { status?: number };
  };

  const status =
    e.status ?? (typeof e.code === "number" ? e.code : undefined) ?? e.response?.status;

  const details = Array.isArray(e.errors)
    ? e.errors
        .map((x) => x?.reason || x?.message)
        .filter(Boolean)
        .join("; ")
    : undefined;

  const base = e.message || "Unknown error";
  const parts: string[] = [];
  if (status != null) parts.push(`status ${status}`);
  if (details) parts.push(details);

  return parts.length ? `[${parts.join(" | ")}] ${base}` : base;
}
