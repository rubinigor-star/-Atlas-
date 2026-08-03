const PRODUCTION_DATABASE_MARKER = "hiyzvmdmluoyqireysla";

export function assertSafeDatabaseEnvironment(): void {
  const deploymentEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const declaredDatabaseEnvironment = process.env.ATLAS_DATABASE_ENV?.trim().toLowerCase();
  const configuredDatabaseValues = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
  ].filter((value): value is string => Boolean(value));

  const productionDatabaseSelected = configuredDatabaseValues.some((value) =>
    value.toLowerCase().includes(PRODUCTION_DATABASE_MARKER),
  );

  if (deploymentEnvironment === "preview") {
    if (declaredDatabaseEnvironment !== "preview" || productionDatabaseSelected) {
      throw new Error(
        "[Atlas database safety] Preview access to the Production database is forbidden.",
      );
    }
  }

  if (deploymentEnvironment === "production" && declaredDatabaseEnvironment !== "production") {
    throw new Error(
      "[Atlas database safety] Production deployment requires the Production database environment.",
    );
  }
}
