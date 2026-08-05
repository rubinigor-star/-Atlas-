import { readFile, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);

if (!process.env.VERCEL) {
  console.log("Skipping PostgreSQL schema preparation outside Vercel.");
  process.exit(0);
}

const isPostgresUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("postgresql://") || value.startsWith("postgres://"));

const pooledCandidates = [
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
];
const directCandidates = [
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
];

const pooledVariable = pooledCandidates.find((name) => isPostgresUrl(process.env[name]));
const directVariable = directCandidates.find(
  (name) => name !== pooledVariable && isPostgresUrl(process.env[name]),
) || null;

console.log("[Atlas database config] PostgreSQL variable availability", {
  vercelEnv: process.env.VERCEL_ENV || "unknown",
  selectedPrimary: pooledVariable || "none",
  selectedDirect: directVariable || "none",
  candidates: Object.fromEntries(
    [...new Set([...pooledCandidates, ...directCandidates])].map((name) => [
      name,
      process.env[name] ? (isPostgresUrl(process.env[name]) ? "postgres" : "invalid") : "missing",
    ]),
  ),
});

if (!pooledVariable) {
  throw new Error(
    "No valid PostgreSQL connection string is available on Vercel. Configure DATABASE_URL, DIRECT_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL for this environment.",
  );
}

let schema = await readFile(schemaPath, "utf8");
schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
schema = schema.replace(
  'url      = env("DATABASE_URL")',
  `url       = env("${pooledVariable}")`,
);

if (directVariable && !schema.includes(`directUrl = env("${directVariable}")`)) {
  schema = schema.replace(
    `url       = env("${pooledVariable}")`,
    `url       = env("${pooledVariable}")\n  directUrl = env("${directVariable}")`,
  );
}

await writeFile(schemaPath, schema);
console.log(
  `Prepared Prisma schema for PostgreSQL using ${pooledVariable}${directVariable ? ` and ${directVariable}` : ""}.`,
);
