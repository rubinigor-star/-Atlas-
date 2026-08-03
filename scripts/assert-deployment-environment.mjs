const vercelEnv = process.env.VERCEL_ENV;
const databaseEnv = process.env.ATLAS_DATABASE_ENV;

if (!vercelEnv) {
  console.log('[deployment-guard] Local build detected, skipping Vercel environment check.');
  process.exit(0);
}

if (!databaseEnv) {
  console.error('[deployment-guard] ATLAS_DATABASE_ENV is missing.');
  console.error('[deployment-guard] Set it to production for Production and preview for Preview.');
  process.exit(1);
}

const expected = vercelEnv === 'production' ? 'production' : 'preview';

if (databaseEnv !== expected) {
  console.error(
    `[deployment-guard] Refusing ${vercelEnv} deployment: ATLAS_DATABASE_ENV=${databaseEnv}, expected ${expected}.`,
  );
  console.error('[deployment-guard] This prevents Preview deployments from writing to the Production database.');
  process.exit(1);
}

console.log(`[deployment-guard] OK: ${vercelEnv} deployment uses ${databaseEnv} database.`);
