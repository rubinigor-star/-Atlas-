"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";

const copy = {
  ru: { request: "Заявка на билет", checkout: "Checkout", reviewData: "Данные для рассмотрения", contact: "Контактные данные", name: "Имя и фамилия", phone: "Телефон", promo: "Промокод", extra: "Дополнительная информация для организатора", extraPlaceholder: "Например, номер клубной карты или кто вас пригласил", promoPlaceholder: "Например, ATLAS10", reviewFirst: "Сначала проверка организатором", testPayment: "Тестовая оплата", reviewHelp: "Сейчас деньги не списываются. После одобрения вы получите возможность оплатить заказ и получить билет.", paymentHelp: "Данные карты не требуются. Будет создан демонстрационный оплаченный заказ.", sending: "Отправляем...", send: "Отправить заявку организатору", confirm: "Подтвердить тестовый заказ", requested: "Запрашиваемый билет", order: "Ваш заказ", quantity: "Количество", afterApproval: "К оплате после одобрения", total: "Итого", error: "Не удалось отправить данные" },
  he: { request: "בקשה לכרטיס", checkout: "תשלום", reviewData: "פרטים לבדיקת המפיק", contact: "פרטי קשר", name: "שם מלא", phone: "טלפון", promo: "קוד הטבה", extra: "מידע נוסף למפיק", extraPlaceholder: "לדוגמה, מספר כרטיס מועדון או מי הזמין אתכם", promoPlaceholder: "לדוגמה, ATLAS10", reviewFirst: "תחילה בדיקת המפיק", testPayment: "תשלום ניסיון", reviewHelp: "לא מתבצע חיוב כעת. לאחר האישור ניתן יהיה לשלם ולקבל כרטיס.", paymentHelp: "אין צורך בפרטי אשראי. תיווצר הזמנת ניסיון ששולמה.", sending: "שולח...", send: "שליחת בקשה למפיק", confirm: "אישור הזמנת ניסיון", requested: "הכרטיס המבוקש", order: "ההזמנה שלך", quantity: "כמות", afterApproval: "לתשלום לאחר אישור", total: "סה״כ", error: "לא ניתן לשלוח את הנתונים" },
};

type CheckoutFormProps = {
  eventId: string;
  categoryId: string;
  quantity: number;
  tableId?: string;
  seatIds?: string[];
  total: number;
  title: string;
  label: string;
  salesMode: "INSTANT" | "APPROVAL_REQUIRED";
  approvalInstructions?: string | null;
};

export function CheckoutForm(props: CheckoutFormProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = copy[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const approvalRequired = props.salesMode === "APPROVAL_REQUIRED";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: props.eventId,
        categoryId: props.categoryId,
        quantity: props.quantity,
        tableId: props.tableId || null,
        seatIds: props.seatIds || undefined,
        promoCode: promo || undefined,
        eligibilityAnswer: form.get("eligibilityAnswer") || undefined,
        customer: {
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || text.error);
      setBusy(false);
      return;
    }
    router.push(`/orders/${data.orderId}`);
  }

  return (
    <form onSubmit={submit} className={`checkout ${busy ? "loading" : ""}`}>
      <section>
        <span className="eyebrow">{approvalRequired ? text.request : text.checkout}</span>
        <h1>{approvalRequired ? text.reviewData : text.contact}</h1>
        <div className="panel form">
          <div className="field">
            <label>{text.name}</label>
            <input className="input" name="name" required minLength={2} autoComplete="name" />
          </div>
          <div className="field">
            <label>{text.phone}</label>
            <input className="input" name="phone" required autoComplete="tel" placeholder="+972..." />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" name="email" required type="email" autoComplete="email" />
          </div>
          {approvalRequired && (
            <div className="field">
              <label>{props.approvalInstructions || text.extra}</label>
              <textarea
                name="eligibilityAnswer"
                rows={4}
                required
                placeholder={text.extraPlaceholder}
              />
            </div>
          )}
          {!approvalRequired && (
            <div className="field">
              <label>{text.promo}</label>
              <input
                className="input"
                value={promo}
                onChange={(event) => setPromo(event.target.value.toUpperCase())}
                placeholder={text.promoPlaceholder}
              />
            </div>
          )}
          <div className="panel" style={{ background: approvalRequired ? "#fff8e8" : "#f8fafc" }}>
            <strong>{approvalRequired ? text.reviewFirst : text.testPayment}</strong>
            <p className="muted">
              {approvalRequired
                ? text.reviewHelp
                : text.paymentHelp}
            </p>
          </div>
          {error && <div className="toast">{error}</div>}
          <button className="btn" disabled={busy}>
            {busy
              ? text.sending
              : approvalRequired
                ? text.send
                : text.confirm}
          </button>
        </div>
      </section>
      <aside className="panel summary">
        <span className="pill">{approvalRequired ? text.requested : text.order}</span>
        <h2>{props.title}</h2>
        <p>{props.label}</p>
        <div className="row between">
          <span className="muted">{text.quantity}</span>
          <strong>{props.quantity}</strong>
        </div>
        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "18px 0" }} />
        <div className="row between">
          <strong>{approvalRequired ? text.afterApproval : text.total}</strong>
          <strong style={{ fontSize: 25 }}>{money(props.total)}</strong>
        </div>
      </aside>
    </form>
  );
}
