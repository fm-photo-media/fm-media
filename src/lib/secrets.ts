// SEC-6 / SEC-20: values that appear in .env.example, the README or old code. They are
// public (the repo is public), so production refuses them as secrets.
const PLACEHOLDER_SECRETS = new Set(
  [
    "change-me",
    "replace-with-a-long-random-secret",
    "replace-with-32-plus-random-characters",
    "replace-with-16-plus-characters",
    "local-development-secret",
    "local-development-session-secret-not-for-production",
    "fm-media-rate-limit"
  ].map((value) => value.toLowerCase())
);

export function isPlaceholderSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_SECRETS.has(normalized) || normalized.startsWith("replace-with-");
}
