const ALLOWED_DATABASE_ENVIRONMENTS = new Set(["production", "preview", "shared"]);

export function assertSafeDatabaseEnvironment(): void {
  const deploymentEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const declaredDatabaseEnvironment = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

  if (!declaredDatabaseEnvironment || !ALLOWED_DATABASE_ENVIRONMENTS.has(declaredDatabaseEnvironment)) {
    throw new Error(
      `[Atlas database safety] ATLAS_DATABASE_ENV must be one of production, preview or shared. Received "${declaredDatabaseEnvironment || "missing"}".`,
    );
  }

  if (
    deploymentEnvironment === "production" &&
    declaredDatabaseEnvironment !== "production" &&
    declaredDatabaseEnvironment !== "shared"
  ) {
    throw new Error(
      "[Atlas database safety] Production deployment requires ATLAS_DATABASE_ENV=production or shared.",
    );
  }

  if (
    deploymentEnvironment === "preview" &&
    declaredDatabaseEnvironment !== "preview" &&
    declaredDatabaseEnvironment !== "shared" &&
    declaredDatabaseEnvironment !== "production"
  ) {
    throw new Error(
      "[Atlas database safety] Preview deployment requires ATLAS_DATABASE_ENV=preview, shared or production.",
    );
  }
}
