const vercelEnv = process.env.VERCEL_ENV;
const databaseEnv = process.env.ATLAS_DATABASE_ENV;

if (!vercelEnv) {
  console.log('[deployment-guard] Local build detected, skipping Vercel environment check.');
  process.exit(0);
}

if (!databaseEnv) {
  console.error('[deployment-guard] ATLAS_DATABASE_ENV is missing.');
  console.error('[deployment-guard] Set it to production or preview.');
  process.exit(1);
}

if (vercelEnv === 'production') {
  if (databaseEnv !== 'production') {
    console.error(
      `[deployment-guard] Refusing Production deployment: ATLAS_DATABASE_ENV=${databaseEnv}, expected production.`,
    );
    process.exit(1);
  }

  console.log('[deployment-guard] OK: Production deployment uses Production database.');
  process.exit(0);
}

if (databaseEnv === 'preview') {
  console.log('[deployment-guard] OK: Preview deployment uses isolated Preview database.');
  process.exit(0);
}

if (databaseEnv === 'production') {
  console.warn('[deployment-guard] SHARED DATABASE MODE: Preview deployment uses Production database.');
  console.warn('[deployment-guard] Build must not run migrations, db push, seed, or data bootstrap commands.');
  process.exit(0);
}

console.error(
  `[deployment-guard] Refusing ${vercelEnv} deployment: unsupported ATLAS_DATABASE_ENV=${databaseEnv}.`,
);
process.exit(1);
