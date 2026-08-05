const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
const atlasDatabaseEnv = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

if (vercelEnv === "preview" && atlasDatabaseEnv !== "preview") {
  throw new Error(
    `[Atlas database safety] Preview deployment blocked: ATLAS_DATABASE_ENV must equal "preview", received "${atlasDatabaseEnv || "missing"}".`,
  );
}

if (vercelEnv === "production" && atlasDatabaseEnv !== "production") {
  throw new Error(
    `[Atlas database safety] Production deployment blocked: ATLAS_DATABASE_ENV must equal "production", received "${atlasDatabaseEnv || "missing"}".`,
  );
}

console.log(
  `[Atlas database safety] Environment accepted: vercel=${vercelEnv || "local"}, database=${atlasDatabaseEnv || "local"}, sharedDatabase=true.`,
);
