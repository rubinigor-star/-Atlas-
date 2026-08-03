import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const REFLEX_EVENT_ID = 'cms499jws001ljc6l6sf4e9is';
const DEMO_SLUGS = [
  'test-pricing-fixed-calm',
  'test-pricing-scheduled-soon',
  'test-pricing-low-stock',
  'test-pricing-social-proof',
  'test-pricing-maximum',
  'test-pricing-mixed',
  'jazz-nights',
  'magic-adventure',
  'techno-united',
  'sunset-sessions',
  'stand-up-night',
  'neon-dreams',
  'echoes-of-light',
];

try {
  const result = await db.$transaction(async (tx) => {
    const reflex = await tx.event.findUnique({
      where: { id: REFLEX_EVENT_ID },
      select: { id: true, slug: true, title: true, status: true, startsAt: true },
    });

    if (!reflex) {
      throw new Error(`Reflex source event ${REFLEX_EVENT_ID} was not found`);
    }

    const updatedReflex = await tx.event.update({
      where: { id: REFLEX_EVENT_ID },
      data: {
        slug: 'reflex-26-11-tel-aviv-reading-3',
        title: 'Группа REFLEX | 26.11 | Tel Aviv Reading 3',
        description: 'Группа REFLEX в Тель-Авиве. 26 ноября 2026, Reading 3.',
        startsAt: new Date('2026-11-26T13:30:00.000Z'),
        status: 'PUBLISHED',
      },
      select: { id: true, slug: true, title: true, status: true, startsAt: true },
    });

    const hidden = await tx.event.updateMany({
      where: {
        slug: { in: DEMO_SLUGS },
      },
      data: { status: 'DRAFT' },
    });

    return { before: reflex, reflex: updatedReflex, hiddenCount: hidden.count };
  });

  console.log(`ATLAS_APPROVED_EVENT_RESTORE ${JSON.stringify(result)}`);
} finally {
  await db.$disconnect();
}
