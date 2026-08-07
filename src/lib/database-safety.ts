export function assertSafeDatabaseEnvironment(): void {
  const deploymentEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const declaredDatabaseEnvironment = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

  // Temporary development mode: Atlas is still operating with demo data.
  // Preview may use the shared database so development is not blocked.
  // Before live customer data or real ticket scanning is enabled, Preview and
  // Production must be moved back to separate databases and this guard tightened.
  if (deploymentEnvironment === "preview") {
    console.warn(
      `[Atlas database safety] DEVELOPMENT MODE: Preview may use the shared database. ATLAS_DATABASE_ENV=${declaredDatabaseEnvironment || "missing"}.`,
    );
    return;
  }

  if (deploymentEnvironment === "production" && declaredDatabaseEnvironment && declaredDatabaseEnvironment !== "production") {
    throw new Error(
      "[Atlas database safety] Production deployment requires ATLAS_DATABASE_ENV=production when the marker is configured.",
    );
  }
}
