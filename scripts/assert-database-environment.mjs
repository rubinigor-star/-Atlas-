const PRODUCTION_SUPABASE_PROJECT_REF = "hiyzvmdmluoyqireysla";

const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
const atlasDatabaseEnv = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();
const databaseUrls = [
  process.env.DATABASE_URL,
  process.env.DIRECT_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_PRISMA_URL,
].filter(Boolean);

const pointsToProductionSupabase = databaseUrls.some((value) =>
  value.toLowerCase().includes(PRODUCTION_SUPABASE_PROJECT_REF),
);

if (vercelEnv === "preview") {
  if (atlasDatabaseEnv !== "preview") {
    throw new Error(
      `[Atlas database safety] Preview deployment blocked: ATLAS_DATABASE_ENV must equal "preview", received "${atlasDatabaseEnv || "missing"}".`,
    );
  }

  if (pointsToProductionSupabase) {
    throw new Error(
      "[Atlas database safety] Preview deployment blocked: database URL points to the Production Supabase project.",
    );
  }
}

if (vercelEnv === "production" && atlasDatabaseEnv !== "production") {
  throw new Error(
    `[Atlas database safety] Production deployment blocked: ATLAS_DATABASE_ENV must equal "production", received "${atlasDatabaseEnv || "missing"}".`,
  );
}

console.log(
  `[Atlas database safety] Environment accepted: vercel=${vercelEnv || "local"}, database=${atlasDatabaseEnv || "local"}.`,
);
