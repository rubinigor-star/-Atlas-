import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { OrderRefundError, refundOrder, type OrderRefundInput } from "@/lib/order-refund-service";
import { resolveStaffLocale, type Locale } from "@/lib/i18n";

const copy={
  ru:{order:"Заказ не найден",paid:"Возврат доступен только для оплаченного заказа",reason:"Укажите причину возврата",mode:"Выберите тип возврата",hyp:"Исходная транзакция HYP не найдена",hypId:"Идентификатор исходной операции HYP не сохранён. Возврат не отправлен.",nothing:"По заказу больше нечего возвращать",payer:"Выберите, кто оплачивает комиссию отмены",zero:"Сумма возврата после комиссии равна нулю",amount:"Некорректная сумма возврата",full:"Полный возврат выполняется только через отмену заказа",processing:"Этот возврат уже обрабатывается",event:"Мероприятие не найдено",forbidden:"Недостаточно прав",failed:"Не удалось выполнить возврат",available:"Доступно к возврату"},
  he:{order:"ההזמנה לא נמצאה",paid:"ניתן לבצע החזר רק עבור הזמנה ששולמה",reason:"יש לציין את סיבת ההחזר",mode:"יש לבחור סוג החזר",hyp:"עסקת HYP המקורית לא נמצאה",hypId:"מזהה עסקת HYP המקורית לא נשמר ולכן ההחזר לא נשלח",nothing:"לא נותר סכום שניתן להחזיר עבור ההזמנה",payer:"יש לבחור מי נושא בעמלת הביטול",zero:"סכום ההחזר לאחר העמלה הוא אפס",amount:"סכום ההחזר אינו תקין",full:"החזר מלא מתבצע רק דרך ביטול ההזמנה",processing:"ההחזר הזה כבר נמצא בטיפול",event:"האירוע לא נמצא",forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לבצע את ההחזר",available:"זמין להחזר"},
  en:{order:"Order not found",paid:"Refunds are available only for paid orders",reason:"Enter a refund reason",mode:"Select a refund type",hyp:"Original HYP transaction not found",hypId:"The original HYP transaction identifier was not saved, so the refund was not sent",nothing:"There is no remaining amount to refund",payer:"Select who pays the cancellation fee",zero:"The refund amount after the fee is zero",amount:"Invalid refund amount",full:"A full refund must be processed as an order cancellation",processing:"This refund is already being processed",event:"Event not found",forbidden:"Insufficient permission",failed:"Could not process the refund",available:"Available to refund"},
} as const;
function localeFor(actor:Awaited<ReturnType<typeof requireEventAccess>>):Locale{return resolveStaffLocale({memberOverride:actor.interfaceLocaleOverride,userPreference:actor.preferredLocale,organizationDefault:actor.organization?.defaultStaffLocale});}
function localize(error:unknown,locale:Locale){const raw=error instanceof Error?error.message:"";const c=copy[locale];if(raw==="FORBIDDEN")return c.forbidden;if(raw==="Заказ не найден")return c.order;if(raw.includes("только для оплаченного заказа"))return c.paid;if(raw.includes("причину возврата"))return c.reason;if(raw==="REFUND_MODE_REQUIRED")return c.mode;if(raw.includes("транзакция HYP не найдена"))return c.hyp;if(raw.includes("Идентификатор исходной операции HYP"))return c.hypId;if(raw.includes("больше нечего возвращать"))return c.nothing;if(raw==="CANCELLATION_FEE_PAYER_REQUIRED")return c.payer;if(raw.includes("после комиссии равна нулю"))return c.zero;if(raw.includes("Некорректная сумма"))return c.amount;if(raw.includes("Полный возврат возможен"))return c.full;if(raw.includes("уже обрабатывается"))return c.processing;if(raw==="Мероприятие не найдено")return c.event;const available=/Доступно к возврату ([\d.]+ ₪)/.exec(raw);if(available)return `${c.available}: ${available[1]}`;return c.failed;}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let locale:Locale="ru";
  try {
    const order = await db.order.findUnique({ where: { publicId: id }, select: { eventId: true } });
    if (!order) return NextResponse.json({ error: copy[locale].order }, { status: 404 });
    const actor=await requireEventAccess("ORDER_MANAGE", order.eventId);locale=localeFor(actor);
    const body = await request.json().catch(() => null) as OrderRefundInput | null;
    return NextResponse.json(await refundOrder(id, body || {}, {actorId:actor.id}));
  } catch (error) {
    console.error("admin.order.refund_failed",{publicId:id,message:error instanceof Error?error.message:"UNKNOWN_REFUND_ERROR"});
    const status = error instanceof OrderRefundError ? error.status : error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: localize(error,locale) }, { status });
  }
}
