import { z } from "zod";

export const checkoutSchema = z.object({
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  tableId: z.string().nullable().optional(),
  seatIds: z.array(z.string().min(1)).max(10).optional(),
  customer: z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().min(7).max(30),
    birthDate: z.string().date(),
    city: z.string().trim().min(2).max(120),
    facebook: z.string().trim().min(2).max(250),
    instagram: z.string().trim().min(2).max(250),
  }),
  eligibilityAnswer: z.string().max(1000).optional(),
  promoCode: z.string().optional(),
  referralCode: z.string().optional(),
  promoterCode: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});

export const checkinSchema = z.object({ code: z.string().min(8).max(200) });

export const createEventSchema = z.object({
  title: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(20),
  startsAt: z.string().datetime(),
  doorsOpenAt: z.string().datetime(),
  venueName: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(4).max(250),
  categoryName: z.string().min(2),
  categoryDescription: z.string().max(500).optional(),
  categoryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"),
  priceMinor: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  mapEnabled: z.boolean().default(false),
  pricingMode: z.enum(["FIXED", "SCHEDULED"]).default("FIXED"),
  salesStart: z.string().datetime(),
  salesEnd: z.string().datetime(),
  earlyBirdPriceMinor: z.number().int().nonnegative().optional(),
  earlyBirdEndsAt: z.string().datetime().optional(),
  maxPerOrder: z.number().int().min(1).max(20).default(10),
  salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]).default("INSTANT"),
  approvalInstructions: z.string().max(1000).nullish().transform((value) => value ?? undefined),
}).superRefine((value, context) => {
  const eventStart = new Date(value.startsAt).getTime();
  const doorsOpen = new Date(value.doorsOpenAt).getTime();
  const salesStart = new Date(value.salesStart).getTime();
  const salesEnd = new Date(value.salesEnd).getTime();
  if (doorsOpen > eventStart) context.addIssue({ code: z.ZodIssueCode.custom, path: ["doorsOpenAt"], message: "Открытие дверей не может быть позже начала мероприятия" });
  if (salesStart >= salesEnd || salesEnd > eventStart) context.addIssue({ code: z.ZodIssueCode.custom, path: ["salesEnd"], message: "Период продаж должен завершаться не позже начала мероприятия" });
  if (value.pricingMode === "SCHEDULED") {
    if (value.earlyBirdPriceMinor === undefined || !value.earlyBirdEndsAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["earlyBirdEndsAt"], message: "Для цены по расписанию заполните раннюю цену и дату её окончания" });
    else {
      const earlyEnd = new Date(value.earlyBirdEndsAt).getTime();
      if (earlyEnd <= salesStart || earlyEnd >= salesEnd) context.addIssue({ code: z.ZodIssueCode.custom, path: ["earlyBirdEndsAt"], message: "Окончание ранней цены должно находиться внутри периода продаж" });
    }
  }
});