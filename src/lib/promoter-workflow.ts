import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const PUBLIC_ORIGIN = (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
let ready: Promise<void> | null = null;

export async function ensurePromoterWorkflowRuntime() {
  if (!ready) ready = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterAutomationSetting" (
      "promoterId" TEXT PRIMARY KEY,
      "autoAssignAllEvents" BOOLEAN NOT NULL DEFAULT false,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterNotification" (
      "linkId" TEXT PRIMARY KEY,
      "status" TEXT NOT NULL DEFAULT 'NOT_SENT',
      "sentAt" TIMESTAMP(3),
      "lastAttemptAt" TIMESTAMP(3),
      "error" TEXT
    )`);
  })().catch(error => { ready = null; throw error; });
  return ready;
}

export async function getPromoterAutomation(promoterIds: string[]) {
  await ensurePromoterWorkflowRuntime();
  if (!promoterIds.length) return new Map<string, boolean>();
  const rows = await db.$queryRawUnsafe<Array<{ promoterId: string; autoAssignAllEvents: boolean }>>(
    `SELECT "promoterId","autoAssignAllEvents" FROM "PromoterAutomationSetting" WHERE "promoterId" = ANY($1::text[])`,
    promoterIds,
  );
  return new Map(rows.map(row => [row.promoterId, Boolean(row.autoAssignAllEvents)]));
}

export async function setPromoterAutomation(promoterId: string, autoAssignAllEvents: boolean) {
  await ensurePromoterWorkflowRuntime();
  await db.$executeRawUnsafe(
    `INSERT INTO "PromoterAutomationSetting" ("promoterId","autoAssignAllEvents","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT ("promoterId") DO UPDATE SET "autoAssignAllEvents"=EXCLUDED."autoAssignAllEvents","updatedAt"=CURRENT_TIMESTAMP`,
    promoterId,
    autoAssignAllEvents,
  );
}

export async function getPromoterNotifications(linkIds: string[]) {
  await ensurePromoterWorkflowRuntime();
  if (!linkIds.length) return new Map<string, { status: string; sentAt: Date | null; error: string | null }>();
  const rows = await db.$queryRawUnsafe<Array<{ linkId: string; status: string; sentAt: Date | null; error: string | null }>>(
    `SELECT "linkId","status","sentAt","error" FROM "PromoterNotification" WHERE "linkId" = ANY($1::text[])`,
    linkIds,
  );
  return new Map(rows.map(row => [row.linkId, { status: row.status, sentAt: row.sentAt, error: row.error }]));
}

function newCode(name: string, slug: string) {
  const base = `${name}-${slug}`.toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "PROMOTER";
  return `${base}-${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 40);
}

export async function assignPromoterToEvent(promoterId: string, eventId: string) {
  const [promoter, event] = await Promise.all([
    db.promoter.findUnique({ where: { id: promoterId } }),
    db.event.findUnique({ where: { id: eventId } }),
  ]);
  if (!promoter || !promoter.active || promoter.name.startsWith("__")) throw new Error("Промоутер не найден или архивирован");
  if (!event || event.organizationId !== promoter.organizationId) throw new Error("Мероприятие не относится к организации промоутера");
  const existing = await db.promoterLink.findFirst({ where: { promoterId, eventId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return db.promoterLink.create({
    data: {
      eventId,
      promoterId,
      label: `${promoter.name} · ${event.title}`,
      code: newCode(promoter.name, event.slug),
      allocationType: "EVENT",
      maxPerOrder: 10,
      commissionBps: promoter.defaultCommissionBps,
      exclusive: false,
      active: true,
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function fromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@") ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}

export async function sendPromoterLinkEmail(linkId: string, force = false) {
  await ensurePromoterWorkflowRuntime();
  const link = await db.promoterLink.findUnique({ where: { id: linkId }, include: { promoter: true, event: { include: { venue: true } } } });
  if (!link || link.promoter.name.startsWith("__")) throw new Error("Ссылка промоутера не найдена");
  if (!link.promoter.email) throw new Error("У промоутера не указан email");
  const existing = await getPromoterNotifications([link.id]);
  if (!force && existing.get(link.id)?.status === "SENT") return existing.get(link.id)!;
  const recipient = process.env.RESEND_TEST_TO || link.promoter.email;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const shareUrl = `${PUBLIC_ORIGIN}/events/${link.event.slug}?channel=${encodeURIComponent(link.code)}`;
  const commission = (link.commissionBps / 100).toFixed(2).replace(/\.00$/, "");
  await db.$executeRawUnsafe(
    `INSERT INTO "PromoterNotification" ("linkId","status","lastAttemptAt","error") VALUES ($1,'SENDING',CURRENT_TIMESTAMP,NULL)
     ON CONFLICT ("linkId") DO UPDATE SET "status"='SENDING',"lastAttemptAt"=CURRENT_TIMESTAMP,"error"=NULL`,
    link.id,
  );
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [recipient],
        subject: `Ваша ссылка для продвижения - ${link.event.title}`,
        html: `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,sans-serif;color:#101828"><div style="max-width:620px;margin:auto;background:white;border-radius:18px;overflow:hidden"><div style="background:#081426;color:white;padding:28px"><div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.7">Atlas One · Promoter</div><h1 style="margin:10px 0 0;font-size:26px">Новое мероприятие для продвижения</h1></div><div style="padding:28px"><p>Привет, ${escapeHtml(link.promoter.name)}!</p><p>Вы назначены промоутером мероприятия <strong>${escapeHtml(link.event.title)}</strong>.</p><p><strong>Дата:</strong> ${link.event.startsAt.toLocaleString("ru-RU")}<br><strong>Место:</strong> ${escapeHtml(link.event.venue.name)}, ${escapeHtml(link.event.venue.city)}${link.commissionBps ? `<br><strong>Ваша комиссия:</strong> ${commission}%` : ""}</p><p>Используйте именно вашу персональную ссылку во всех публикациях и сообщениях. Переходы, заказы и продажи по ней автоматически учитываются в Atlas.</p><div style="text-align:center;margin:28px 0"><a href="${shareUrl}" style="display:inline-block;background:#ff5c45;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Открыть мою ссылку продаж</a></div><div style="font-size:12px;color:#667085;word-break:break-all">${shareUrl}</div><p style="margin-top:28px;color:#667085;font-size:13px">Если у вас уже была ссылка на другое мероприятие, продолжайте использовать каждую ссылку только для соответствующего события.</p></div></div></body></html>`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`);
    await db.$executeRawUnsafe(`UPDATE "PromoterNotification" SET "status"='SENT',"sentAt"=CURRENT_TIMESTAMP,"lastAttemptAt"=CURRENT_TIMESTAMP,"error"=NULL WHERE "linkId"=$1`, link.id);
    return { status: "SENT", sentAt: new Date(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка отправки";
    await db.$executeRawUnsafe(`UPDATE "PromoterNotification" SET "status"='ERROR',"lastAttemptAt"=CURRENT_TIMESTAMP,"error"=$2 WHERE "linkId"=$1`, link.id, message);
    throw error;
  }
}

export async function assignAutoPromotersToEvent(eventId: string) {
  await ensurePromoterWorkflowRuntime();
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Мероприятие не найдено");
  const rows = await db.$queryRawUnsafe<Array<{ promoterId: string }>>(
    `SELECT s."promoterId" FROM "PromoterAutomationSetting" s JOIN "Promoter" p ON p."id"=s."promoterId" WHERE s."autoAssignAllEvents"=TRUE AND p."active"=TRUE AND p."organizationId"=$1 AND p."name" NOT LIKE '__%'`,
    event.organizationId,
  );
  const links = [];
  for (const row of rows) links.push(await assignPromoterToEvent(row.promoterId, event.id));
  return links;
}

export async function notifyEventPromoters(eventId: string, force = false) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event || event.status !== "PUBLISHED") return { sent: 0, errors: 0 };
  const links = await db.promoterLink.findMany({ where: { eventId, active: true, promoter: { active: true, NOT: { name: { startsWith: "__" } } } }, include: { promoter: true } });
  let sent = 0; let errors = 0;
  for (const link of links) {
    if (!link.promoter.email) { errors++; continue; }
    try { await sendPromoterLinkEmail(link.id, force); sent++; } catch { errors++; }
  }
  return { sent, errors };
}
