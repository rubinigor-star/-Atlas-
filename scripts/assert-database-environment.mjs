const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
const atlasDatabaseEnv = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

// Temporary development mode: Preview and Production intentionally share the
// same database. Do not block Preview deployments based on database URLs or
// ATLAS_DATABASE_ENV until a separate Preview database is introduced.
if (vercelEnv === "preview") {
  console.warn(
    `[Atlas database safety] Preview is allowed to use the shared Production database. ATLAS_DATABASE_ENV=${atlasDatabaseEnv || "missing"}.`,
  );
}

// Keep the Production marker check so an accidental non-production setting
// cannot silently reach the live deployment. Missing marker is tolerated for
// now because the project is operating with one shared database configuration.
if (vercelEnv === "production" && atlasDatabaseEnv && atlasDatabaseEnv !== "production") {
  throw new Error(
    `[Atlas database safety] Production deployment blocked: ATLAS_DATABASE_ENV must equal "production" when set, received "${atlasDatabaseEnv}".`,
  );
}

console.log(
  `[Atlas database safety] Environment accepted: vercel=${vercelEnv || "local"}, database=${atlasDatabaseEnv || "shared"}.`,
);
