import { readFile, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);

if (!process.env.VERCEL) {
  console.log("Skipping PostgreSQL schema preparation outside Vercel.");
  process.exit(0);
}

const pooledVariable = process.env.POSTGRES_PRISMA_URL
  ? "POSTGRES_PRISMA_URL"
  : "DATABASE_URL";
const directVariable = process.env.POSTGRES_URL_NON_POOLING
  ? "POSTGRES_URL_NON_POOLING"
  : process.env.DIRECT_URL
    ? "DIRECT_URL"
    : null;
const pooledUrl = process.env[pooledVariable] ?? "";

if (!pooledUrl.startsWith("postgresql://") && !pooledUrl.startsWith("postgres://")) {
  throw new Error(`${pooledVariable} must be a PostgreSQL connection string on Vercel.`);
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
  `Prepared Prisma schema for Supabase PostgreSQL using ${pooledVariable}${directVariable ? ` and ${directVariable}` : ""}.`,
);