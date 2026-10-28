// QA-15: admin forms post a `returnTo` so notices land on the page the owner was on.
// Only same-site /admin paths are accepted (no open redirect).

const NOTICE_PARAMS = ["error", "success", "count", "wait"];

export function adminPath(value: string | null | undefined, fallback: string) {
  if (!value || value.length > 300) return fallback;
  if (!/^\/admin(?:[/?#]|$)/.test(value) || value.includes("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "http://admin.local");
    if (url.origin !== "http://admin.local") return fallback;
    const result = `${url.pathname}${url.search}`;
    return isSafeAdminPath(result) ? result : fallback;
  } catch {
    return fallback;
  }
}

/**
 * SEC-22: the parser strips tabs and newlines and resolves "..", so the raw checks above
 * aren't enough on their own ("/admin/../\t/evil.com" parses to "//evil.com"). The
 * OUTPUT must be a single-slash path under /admin, with no "//" or "\" anywhere.
 */
function isSafeAdminPath(path: string) {
  return /^\/admin(?:[/?]|$)/.test(path) && !path.includes("//") && !path.includes("\\");
}

/** Sets query params on an /admin path, replacing any old notice params. */
export function withParams(path: string, params: Record<string, string>) {
  const url = new URL(path, "http://admin.local");
  for (const name of NOTICE_PARAMS) url.searchParams.delete(name);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return `${url.pathname}${url.search}${url.hash}`;
}
