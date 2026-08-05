export function assertSafeDatabaseEnvironment(): void {
  const deploymentEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const declaredDatabaseEnvironment = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

  // During the current development stage, Preview and Production intentionally
  // share the same database. Preview must therefore not be blocked when it uses
  // the Production connection string.
  if (deploymentEnvironment === "preview") {
    console.log(
      `[Atlas database safety] Preview is allowed to use the shared Production database. ATLAS_DATABASE_ENV=${declaredDatabaseEnvironment || "missing"}.`,
    );
    return;
  }

  if (deploymentEnvironment === "production" && declaredDatabaseEnvironment !== "production") {
    throw new Error(
      "[Atlas database safety] Production deployment requires the Production database environment.",
    );
  }
}
