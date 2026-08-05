const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
const atlasDatabaseEnv = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

// Atlas currently uses one shared database for Production and Preview.
// Keep validating that the variable is explicitly configured, but do not
// block Preview merely because it points to the same database as Production.
const sharedDatabaseModes = new Set(["production", "shared", "preview"]);

if ((vercelEnv === "preview" || vercelEnv === "production") && !sharedDatabaseModes.has(atlasDatabaseEnv || "")) {
  throw new Error(
    `[Atlas database safety] Deployment blocked: ATLAS_DATABASE_ENV must be explicitly set to "production", "shared", or "preview". Received "${atlasDatabaseEnv || "missing"}".`,
  );
}

console.log(
  `[Atlas database safety] Shared database mode accepted: vercel=${vercelEnv || "local"}, database=${atlasDatabaseEnv || "local"}.`,
);
