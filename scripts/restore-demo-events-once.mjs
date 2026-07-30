import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DEMO_ORGANIZER_EMAIL = "demo.organizer@atlas-one.co";
const EVENT_SLUGS = [
  "pool-party",
  "jazz-nights",
  "sunset-sessions",
  "magic-adventure",
  "igor-test-payment",
  "noa-electric-tel-aviv",
  "neon-dreams",
  "echoes-of-light",
  "stand-up-night",
  "techno-united",
  "malina",
];

try {
  const demoUser = await db.user.findUnique({
    where: { email: DEMO_ORGANIZER_EMAIL },
    select: { organizationId: true },
  });

  if (!demoUser?.organizationId) {
    throw new Error("Demo Organizer organization is not configured");
  }

  const existing = await db.event.findMany({
    where: { slug: { in: EVENT_SLUGS } },
    select: { id: true, slug: true, title: true, organizationId: true },
  });

  for (const event of existing) {
    if (event.organizationId === demoUser.organizationId) continue;
    await db.event.update({
      where: { id: event.id },
      data: { organizationId: demoUser.organizationId },
    });
    console.log(`Restored ${event.slug}: ${event.title}`);
  }

  const missing = EVENT_SLUGS.filter((slug) => !existing.some((event) => event.slug === slug));
  console.log(`Restored ${existing.length - missing.length} existing event(s) to Demo Organizer.`);
  if (missing.length) console.warn(`Missing event slugs: ${missing.join(", ")}`);
} finally {
  await db.$disconnect();
}
