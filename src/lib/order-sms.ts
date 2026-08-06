import { db } from "@/lib/db";
import { sendSms019 } from "@/lib/sms-019";

function baseUrl() {
  return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}

export function getSmsPriceMinor() {
  const value = Number(process.env.SMS_PRICE_MINOR ?? "20");
  return Number.isInteger(value) && value >= 0 ? value : 20;
}

export async function sendOrderTicketSms(publicId: string) {
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: true, tickets: true },
  });

  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "PAID") throw new Error("Билет можно отправить только после оплаты");
  if (!order.tickets.length) throw new Error("В заказе ещё нет билетов");

  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const message = `Atlas One: билеты на ${order.event.title}. Заказ ${order.publicId}. Открыть билеты: ${orderUrl}`;
  const result = await sendSms019({
    phone: order.customerPhone,
    message,
    campaignName: `ticket-${order.publicId}`,
  });

  if (!result.ok) {
    throw new Error(result.providerMessage || `019SMS error ${result.status}`);
  }

  return {
    recipient: order.customerPhone,
    providerStatus: result.providerStatus ?? null,
    priceMinor: getSmsPriceMinor(),
  };
}
