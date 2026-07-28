import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";

const inputSchema = z.object({ prompt: z.string().min(5).max(4000), locale: z.enum(["ru", "he", "en"]).optional() });

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "notes", "changes"],
  properties: {
    summary: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "detail", "risk", "kind", "selectable", "statusLabel"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          risk: { type: "string", enum: ["safe", "review"] },
          kind: { type: "string", enum: ["draft", "system_change", "advice"] },
          selectable: { type: "boolean" },
          statusLabel: { type: "string" },
        },
      },
    },
  },
} as const;

type PlanItem = {
  id: string;
  title: string;
  detail: string;
  risk: "safe" | "review";
  kind: "draft" | "system_change" | "advice";
  selectable: boolean;
  statusLabel: string;
};

function demoPlan(prompt: string, event: { title: string; categories: Array<{ name: string; capacity: number; priceMinor: number }> }) {
  const lower = prompt.toLowerCase();
  const changes: PlanItem[] = [];
  const add = (item: Omit<PlanItem, "id">) => changes.push({ id: `action-${changes.length + 1}`, ...item });

  if (lower.includes("продвиж") || lower.includes("marketing") || lower.includes("קידום")) {
    add({ title: "Подготовить план публикаций", detail: "Atlas подготовит конкретный календарь публикаций на 7 дней без изменения настроек мероприятия.", risk: "safe", kind: "draft", selectable: true, statusLabel: "Можно подготовить" });
    add({ title: "Подготовить тексты для рассылки", detail: "Будут созданы черновики сообщений. Ничего не будет отправлено автоматически.", risk: "safe", kind: "draft", selectable: true, statusLabel: "Черновик" });
  } else if (lower.includes("категор") || lower.includes("dance") || lower.includes("vip") || lower.includes("билет")) {
    add({ title: "Проверить категории билетов", detail: "Atlas подготовит точный список категорий, цен, вместимости и лимитов для подтверждения.", risk: "review", kind: "system_change", selectable: true, statusLabel: "Требует подтверждения" });
  } else {
    add({ title: "Проверить текущее мероприятие", detail: `Atlas проверит настройки «${event.title}» и покажет только относящиеся к запросу действия.`, risk: "safe", kind: "advice", selectable: false, statusLabel: "Рекомендация" });
  }

  return {
    summary: "Atlas отделяет рекомендации, черновики и изменения системы. Несвязанные действия не добавляются в один план.",
    notes: ["До отдельного подтверждения данные мероприятия не изменяются.", `Сейчас найдено категорий: ${event.categories.length}.`],
    changes,
    mode: "demo" as const,
  };
}

function extractOutputText(response: unknown) {
  const value = response as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (value.output_text) return value.output_text;
  for (const item of value.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) return content.text;
  return "";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireEventAccess("EVENT_VIEW", id);
    const { prompt, locale = "ru" } = inputSchema.parse(await req.json());
    const event = await db.event.findUnique({ where: { id }, include: { venue: true, categories: { include: { priceTiers: true } } } });
    if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ plan: demoPlan(prompt, event) });

    const context = {
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      salesMode: event.salesMode,
      mapEnabled: event.mapEnabled,
      venue: { name: event.venue.name, city: event.venue.city, address: event.venue.address },
      categories: event.categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        priceMinor: category.priceMinor,
        capacity: category.capacity,
        sold: category.sold,
        hidden: category.hidden,
        maxPerOrder: category.maxPerOrder,
        pricingMode: category.pricingMode,
        salesStart: category.salesStart?.toISOString() || null,
        salesEnd: category.salesEnd?.toISOString() || null,
        priceTiers: category.priceTiers.map((tier) => ({ label: tier.label, priceMinor: tier.priceMinor, startsAt: tier.startsAt.toISOString(), endsAt: tier.endsAt.toISOString() })),
      })),
    };

    const language = locale === "he" ? "Hebrew" : locale === "en" ? "English" : "Russian";
    const instructions = `You are Atlas, the working partner of an event organizer inside Atlas Ticketing. Reply in ${language}.

Core behavior:
- Work like an operator who understands the current event, not like a generic chatbot.
- Answer only the organizer's actual request. Never mix unrelated marketing, ticketing, venue-map, promo-code, approval-mode, SMS, email, or pricing changes into one plan.
- If the user asks for promotion, return promotion deliverables only. Do not propose changing sales mode, map settings, prices, dates, capacities, promo codes, or checkout settings unless explicitly requested.
- If the user asks to change the event, return only the exact requested system changes plus necessary safety checks.
- Distinguish three kinds: draft (content Atlas can prepare), system_change (would alter data), advice (informational only).
- selectable=true only for concrete items the organizer can deliberately choose. General advice must be selectable=false.
- Never claim that anything was applied, sent, published, or changed.
- Use short, concrete titles and details. Maximum 6 items.
- Do not invent capabilities or modules that are not present in the supplied event context.
- Prices, capacities, active sales, published events and sales windows are review risk.
- Prefer stable fixed-price configurations. Never propose dynamic pricing unless explicitly requested.`;

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions,
        input: `CURRENT EVENT:\n${JSON.stringify(context)}\n\nORGANIZER REQUEST:\n${prompt}`,
        text: { format: { type: "json_schema", name: "atlas_event_plan", strict: true, schema: planSchema } },
      }),
    });
    const payload = await openAiResponse.json();
    if (!openAiResponse.ok) throw new Error((payload as { error?: { message?: string } }).error?.message || "OpenAI API не ответил");
    const text = extractOutputText(payload);
    if (!text) throw new Error("OpenAI вернул пустой план");
    const plan = JSON.parse(text) as { summary: string; notes: string[]; changes: PlanItem[] };
    return NextResponse.json({ plan: { ...plan, mode: "live" as const } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обработать запрос" }, { status: 400 });
  }
}
