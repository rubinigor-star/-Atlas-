import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const accidentalShowcaseSlugs = [
  "echoes-of-light",
  "neon-dreams",
  "stand-up-night",
  "sunset-sessions",
  "techno-united",
  "magic-adventure",
  "jazz-nights",
  "pool-party",
];

try {
  const result = await db.event.updateMany({
    where: { slug: { in: accidentalShowcaseSlugs } },
    data: { status: "DRAFT" },
  });
  console.log(`Disabled ${result.count} accidental showcase event(s).`);
} finally {
  await db.$disconnect();
}
