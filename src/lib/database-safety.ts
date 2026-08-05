export function assertSafeDatabaseEnvironment(): void {
  const deploymentEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const declaredDatabaseEnvironment = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();

  if (deploymentEnvironment === "preview" && declaredDatabaseEnvironment !== "preview") {
    throw new Error(
      "[Atlas database safety] Preview deployment requires ATLAS_DATABASE_ENV=preview.",
    );
  }

  if (deploymentEnvironment === "production" && declaredDatabaseEnvironment !== "production") {
    throw new Error(
      "[Atlas database safety] Production deployment requires ATLAS_DATABASE_ENV=production.",
    );
  }
}
