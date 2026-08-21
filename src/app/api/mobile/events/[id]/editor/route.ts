import { NextResponse } from "next/server";
import { z } from "zod";
import type { StaffPermission } from "@prisma/client";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { eventTypeValues } from "@/lib/event-type";
import { eventLanguageValues, catalogVisibilityValues } from "@/lib/event-language";
import {
  getMobileEditorState,
  saveBasics,
  createCategory,
  updateCategory,
  setCategoryVisibility,
  setPricingStrategy,
  setAdmissionMode,
  saveLayout,
  saveSalesMode,
  saveCheckoutForm,
  saveCommercialTerms,
  setPublishStatus,
  setArchiveState,
} from "@/lib/mobile-event-editor";

const presentation = z.object({
  shortDescription: z.string().max(100),
  ageRestriction: z.enum(["Детское", "3+", "6+", "12+", "14+", "16+", "18+", "Без ограничений"]),
  doorsOpenTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  runtimeMinutes: z.number().int().min(0).max(720),
  intermissionCount: z.number().int().min(0).max(5),
  galleryEnabled: z.boolean(),
  galleryUrls: z.array(z.string().url()).max(6),
  faqEnabled: z.boolean(),
  faq: z.array(z.object({ question: z.string().max(180), answer: z.string().max(1200) })).max(15),
});
const mediaItem = z.object({ type: z.enum(["VIDEO", "LINK"]), url: z.string().url(), title: z.string().max(120).optional() });
const basics = z.object({
  action: z.literal("basics"),
  title: z.string().min(3).max(50), description: z.string().min(20), posterUrl: z.string().min(1), startsAt: z.string().datetime(),
  venueName: z.string().min(2).max(160), city: z.string().min(2).max(120), address: z.string().min(3).max(300),
  presentation, media: z.array(mediaItem).max(20), eventTypes: z.array(z.enum(eventTypeValues)).min(1),
  language: z.object({ primaryLanguage: z.enum(eventLanguageValues), catalogVisibility: z.enum(catalogVisibilityValues) }),
});
const categoryBase = z.object({
  name: z.string().min(2).max(160), description: z.string().max(500).optional(), priceMinor: z.number().int().nonnegative(), capacity: z.number().int().positive(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/), pricingMode: z.enum(["FIXED", "SCHEDULED"]), salesStart: z.string().datetime(), salesEnd: z.string().datetime(),
  earlyBirdPriceMinor: z.number().int().nonnegative().optional(), earlyBirdEndsAt: z.string().datetime().optional(), maxPerOrder: z.number().int().min(1).max(20), salesStrategy: z.enum(["STANDARD", "BUY_ONE_GET_ONE"]).default("STANDARD"),
});
const categoryCreate = categoryBase.extend({ action: z.literal("category-create") });
const categoryUpdate = categoryBase.extend({ action: z.literal("category-update"), categoryId: z.string().min(1) });
const categoryVisibility = z.object({ action: z.literal("category-visibility"), categoryId: z.string().min(1), hidden: z.boolean() });
const pricingStrategy = z.object({ action: z.literal("pricing-strategy"), categoryId: z.string().min(1), intensity: z.enum(["CALM", "STANDARD", "ACTIVE", "MAXIMUM"]), showCountdown: z.boolean(), showNextPrice: z.boolean(), showStageRemaining: z.boolean(), showTotalRemaining: z.boolean(), showSoldCount: z.boolean() });
const admission = z.object({ action: z.literal("admission"), mapEnabled: z.boolean() });
const layoutObject = z.object({
  id: z.string().optional(), label: z.string().min(1).max(30), objectType: z.enum(["TABLE", "ROUND_TABLE", "SOFA", "ROW", "ZONE", "STAGE", "BAR", "TEXT"]),
  seats: z.number().int().min(0).max(50), priceMode: z.enum(["WHOLE_TABLE", "PER_SEAT"]), priceMinor: z.number().int().nonnegative(),
  x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100), rotation: z.number().int().min(0).max(359), width: z.number().int().min(40).max(800), height: z.number().int().min(30).max(600),
  categoryId: z.string().min(1).nullable(), seatAssignments: z.array(z.object({ position: z.number().int().min(1).max(50), categoryId: z.string().min(1).nullable() })).max(50),
});
const layout = z.object({ action: z.literal("layout"), objects: z.array(layoutObject).max(300) });
const sales = z.object({ action: z.literal("sales"), salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]), approvalInstructions: z.string().max(1000).optional(), rejectionMessage: z.string().max(2000).optional() });
const guestField = z.object({ visible: z.boolean(), required: z.boolean() });
const guestFields = z.object({ firstName: guestField, lastName: guestField, phone: guestField, email: guestField, birthDate: guestField, city: guestField, facebook: guestField, instagram: guestField });
const question = z.object({ id: z.string().min(1), label: z.string().min(1).max(300), type: z.enum(["TEXT", "TEXTAREA", "SELECT", "CHECKBOX", "PHONE", "EMAIL", "DATE"]), required: z.boolean(), placeholder: z.string().max(300).optional(), options: z.array(z.string().min(1).max(120)).max(50).optional() });
const checkout = z.object({ action: z.literal("checkout-form"), guestFields, questions: z.array(question).max(50) });
const commercial = z.object({ action: z.literal("commercial"), useOrganizerDefaults: z.boolean(), serviceFeePayer: z.enum(["BUYER", "ORGANIZER"]) });
const status = z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "PUBLISHED"]) });
const archive = z.object({ action: z.literal("archive"), archiveAction: z.enum(["archive", "restore"]) });
const actionSchema = z.discriminatedUnion("action", [basics, categoryCreate, categoryUpdate, categoryVisibility, pricingStrategy, admission, layout, sales, checkout, commercial, status, archive]);

async function authorize(request: Request, eventId: string, permission: "EVENT_VIEW" | "EVENT_MANAGE" | "TICKET_MANAGE") {
  const actor = await getMobileStaff(request);
  if (!actor) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  if (!actor.permissionSet.has(permission)) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, organizationId: true } });
  if (!event) return { error: NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 }) } as const;
  const organizationAccess = actor.role === "ADMIN" || Boolean(actor.organizationId && actor.organizationId === event.organizationId);
  const scoped = actor.eventAccess.length > 0;
  const eventAccess = actor.eventAccess.some((access) => access.eventId === eventId);
  if (!organizationAccess || (scoped && !eventAccess)) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  return { actor, event } as const;
}

async function authorizeEventHub(request: Request, eventId: string) {
  const actor = await getMobileStaff(request);
  if (!actor) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  const eventHubPermissions: StaffPermission[] = ["EVENT_VIEW", "EVENT_MANAGE", "TICKET_MANAGE", "ORDER_VIEW", "REQUEST_REVIEW", "ORDER_MANAGE", "SCAN"];
  const canOpen = actor.role === "ADMIN" || eventHubPermissions.some((permission) => actor.permissionSet.has(permission));
  if (!canOpen) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, organizationId: true } });
  if (!event) return { error: NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 }) } as const;
  const organizationAccess = actor.role === "ADMIN" || Boolean(actor.organizationId && actor.organizationId === event.organizationId);
  const scoped = actor.eventAccess.length > 0;
  const eventAccess = actor.eventAccess.some((access) => access.eventId === eventId);
  if (!organizationAccess || (scoped && !eventAccess)) return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  return { actor, event } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeEventHub(request, id);
  if ("error" in auth) return auth.error;
  const editor = await getMobileEditorState(id);
  if (!editor) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  return NextResponse.json({ ...editor, permissions: Array.from(auth.actor.permissionSet) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const ticketActions = new Set(["category-create", "category-update", "category-visibility", "pricing-strategy", "layout"]);
    const auth = await authorize(request, id, ticketActions.has(body.action) ? "TICKET_MANAGE" : "EVENT_MANAGE");
    if ("error" in auth) return auth.error;
    if (body.action === "basics") {
      const { action: _action, ...value } = body; await saveBasics(id, value, auth.actor.id);
    } else if (body.action === "category-create") {
      const { action: _action, ...value } = body; await createCategory(id, value);
    } else if (body.action === "category-update") {
      const { action: _action, ...value } = body; await updateCategory(id, value);
    } else if (body.action === "category-visibility") {
      await setCategoryVisibility(id, body.categoryId, body.hidden);
    } else if (body.action === "pricing-strategy") {
      await setPricingStrategy(id, body.categoryId, body);
    } else if (body.action === "admission") {
      await setAdmissionMode(id, body.mapEnabled);
    } else if (body.action === "layout") {
      await saveLayout(id, body.objects);
    } else if (body.action === "sales") {
      await saveSalesMode(id, body);
    } else if (body.action === "checkout-form") {
      await saveCheckoutForm(id, body.guestFields, body.questions);
    } else if (body.action === "commercial") {
      await saveCommercialTerms(id, auth.actor, body);
    } else if (body.action === "status") {
      await setPublishStatus(id, body.status);
    } else if (body.action === "archive") {
      await setArchiveState(id, auth.actor.id, body.archiveAction);
    }
    const editor = await getMobileEditorState(id);
    return NextResponse.json({ ...editor, permissions: Array.from(auth.actor.permissionSet) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Проверьте обязательные поля", details: error.flatten() }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить изменения" }, { status: 400 });
  }
}
