import { readFile, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl = process.env.DIRECT_URL ?? "";

if (!process.env.VERCEL) {
  console.log("Skipping PostgreSQL schema preparation outside Vercel.");
  process.exit(0);
}

if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection string on Vercel.");
}

let schema = await readFile(schemaPath, "utf8");
schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');

if (directUrl && !schema.includes('directUrl = env("DIRECT_URL")')) {
  schema = schema.replace(
    'url      = env("DATABASE_URL")',
    'url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")',
  );
}

await writeFile(schemaPath, schema);
console.log("Prepared Prisma schema for Supabase PostgreSQL.");
