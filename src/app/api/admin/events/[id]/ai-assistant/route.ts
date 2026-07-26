import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";

const inputSchema = z.object({ prompt: z.string().min(5).max(4000) });

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
        required: ["title", "detail", "risk"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          risk: { type: "string", enum: ["safe", "review"] },
        },
      },
    },
  },
} as const;

function demoPlan(prompt: string, event: { title: string; categories: Array<{ name: string; capacity: number; priceMinor: number }> }) {
  const lower = prompt.toLowerCase();
  const changes: Array<{ title: string; detail: string; risk: "safe" | "review" }> = [];
  if (lower.includes("категор") || lower.includes("dance") || lower.includes("vip") || lower.includes("билет")) changes.push({ title: "Проверить категории билетов", detail: "Помощник подготовит создание или обновление категорий, цен, вместимости и лимита на заказ.", risk: "review" });
  if (lower.includes("пол") || lower.includes("имя") || lower.includes("телефон") || lower.includes("email")) changes.push({ title: "Настроить данные покупателя", detail: "Будут подготовлены обязательные и дополнительные поля формы оформления заказа.", risk: "safe" });
  if (lower.includes("шаблон") || lower.includes("classic") || lower.includes("билет")) changes.push({ title: "Выбрать оформление билета", detail: "Будет предложен подходящий шаблон из существующей коллекции Atlas без изменения уже выданных билетов.", risk: "safe" });
  if (lower.includes("продаж") || lower.includes("одобр")) changes.push({ title: "Проверить режим продаж", detail: "Помощник сверит мгновенную продажу или продажу по одобрению и покажет последствия изменения.", risk: "review" });
  if (!changes.length) changes.push({ title: "Проверить текущее мероприятие", detail: `Будут проанализированы настройки «${event.title}», существующие категории и готовность к продаже.`, risk: "safe" });
  return {
    summary: "Интерфейс помощника уже работает в демонстрационном режиме. После подключения API-ключа этот запрос будет обработан моделью с учётом реальных настроек мероприятия.",
    notes: ["До подтверждения никакие данные мероприятия не изменяются.", `Сейчас найдено категорий: ${event.categories.length}.`],
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
    const { prompt } = inputSchema.parse(await req.json());
    const event = await db.event.findUnique({
      where: { id },
      include: { venue: true, categories: { include: { priceTiers: true } } },
    });
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

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: "You are Atlas AI, an event setup assistant inside a ticketing platform. Reply in Russian. Analyze the current event and prepare a concise, safe plan. Never claim changes were applied. Prefer stable fixed-price configurations. Flag changes to published events, prices, capacities, or active sales as review. Do not propose dynamic pricing unless explicitly requested.",
        input: `CURRENT EVENT:\n${JSON.stringify(context)}\n\nUSER REQUEST:\n${prompt}`,
        text: { format: { type: "json_schema", name: "atlas_event_plan", strict: true, schema: planSchema } },
      }),
    });
    const payload = await openAiResponse.json();
    if (!openAiResponse.ok) {
      const message = (payload as { error?: { message?: string } }).error?.message || "OpenAI API не ответил";
      throw new Error(message);
    }
    const text = extractOutputText(payload);
    if (!text) throw new Error("OpenAI вернул пустой план");
    const plan = JSON.parse(text) as { summary: string; notes: string[]; changes: Array<{ title: string; detail: string; risk: "safe" | "review" }> };
    return NextResponse.json({ plan: { ...plan, mode: "live" as const } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обработать запрос" }, { status: 400 });
  }
}
