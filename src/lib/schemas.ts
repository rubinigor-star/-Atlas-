import { z } from "zod";

export const checkoutSchema = z.object({
  eventId: z.string().min(1),
  categoryId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  tableId: z.string().nullable().optional(),
  seatIds: z.array(z.string().min(1)).max(10).optional(),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7),
  }),
  eligibilityAnswer: z.string().max(1000).optional(),
  promoCode: z.string().optional(),
  referralCode: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});

export const checkinSchema = z.object({ code: z.string().min(8).max(200) });

export const createEventSchema = z.object({
  title: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(20),
  startsAt: z.string().datetime(),
  venueName: z.string().min(2),
  city: z.string().min(2),
  categoryName: z.string().min(2),
  priceMinor: z.number().int().positive(),
  capacity: z.number().int().positive(),
  salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]).default("INSTANT"),
  approvalInstructions: z.string().max(1000).optional(),
});
