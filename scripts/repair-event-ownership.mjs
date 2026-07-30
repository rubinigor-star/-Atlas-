import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DEMO_ORGANIZER_EMAIL = "demo.organizer@atlas-one.co";
const ORIGIN_ACTIONS = ["EVENT_CREATED", "EVENT_CLONED"];

try {
  const demoUser = await db.user.findUnique({
    where: { email: DEMO_ORGANIZER_EMAIL },
    select: { organizationId: true },
  });

  if (!demoUser?.organizationId) {
    console.log("Demo organizer is not configured; event ownership repair is not needed.");
    process.exit(0);
  }

  const demoOrganizationId = demoUser.organizationId;
  const candidateEvents = await db.event.findMany({
    where: { organizationId: demoOrganizationId },
    select: { id: true, title: true },
  });

  let repaired = 0;

  for (const event of candidateEvents) {
    const origin = await db.auditLog.findFirst({
      where: {
        entityType: "Event",
        entityId: event.id,
        action: { in: ORIGIN_ACTIONS },
        organizationId: { not: demoOrganizationId },
      },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });

    if (!origin) continue;

    const organizationExists = await db.organization.count({
      where: { id: origin.organizationId },
    });
    if (!organizationExists) continue;

    await db.event.update({
      where: { id: event.id },
      data: { organizationId: origin.organizationId },
    });
    repaired += 1;
    console.log(`Restored event ownership: ${event.title} -> ${origin.organizationId}`);
  }

  console.log(`Event ownership repair complete. Restored ${repaired} event(s).`);
} finally {
  await db.$disconnect();
}
