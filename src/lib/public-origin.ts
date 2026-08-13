const DEFAULT_PUBLIC_ORIGIN = "https://www.atlas-one.co";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function getCanonicalOrigin() {
  const configured = process.env.CANONICAL_APP_URL?.trim();
  return configured ? normalizeOrigin(configured) : DEFAULT_PUBLIC_ORIGIN;
}

export function getPublicOrigin() {
  const vercelEnv = process.env.VERCEL_ENV;
  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelEnv === "preview" && vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return normalizeOrigin(configured);

  return DEFAULT_PUBLIC_ORIGIN;
}
