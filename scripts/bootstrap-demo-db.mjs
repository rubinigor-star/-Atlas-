import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  const userCount = await db.user.count();

  if (userCount > 0) {
    console.log(`Database already contains ${userCount} user(s); skipping demo seed.`);
    process.exit(0);
  }
} finally {
  await db.$disconnect();
}

console.log("Database is empty; creating the initial Atlas demo organization and event.");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "prisma/seed.ts"],
  { stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
