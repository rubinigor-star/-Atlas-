const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
const atlasDatabaseEnv = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

// Temporary development mode: Atlas currently contains demo data only.
// Preview is allowed to use the shared database so development can continue.
// Before real customers or live tickets are introduced, restore strict
// Preview/Production database isolation and point Preview to atlas-preview.
if (vercelEnv === "preview") {
  console.warn(
    `[Atlas database safety] DEVELOPMENT MODE: Preview may use the shared database. ATLAS_DATABASE_ENV=${atlasDatabaseEnv || "missing"}.`,
  );
}

if (vercelEnv === "production" && atlasDatabaseEnv && atlasDatabaseEnv !== "production") {
  throw new Error(
    `[Atlas database safety] Production deployment blocked: ATLAS_DATABASE_ENV must equal "production" when configured, received "${atlasDatabaseEnv}".`,
  );
}

console.log(
  `[Atlas database safety] Environment accepted: vercel=${vercelEnv || "local"}, database=${atlasDatabaseEnv || "shared-demo"}.`,
);
