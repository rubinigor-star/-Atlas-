import Link from "next/link";
import { hypResultFromUrl } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

export default async function HypResultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const url = new URL("https://www.atlas-one.co/payments/hyp/result");
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, item));
    else if (typeof value === "string") url.searchParams.set(key, value);
  }
  const result = hypResultFromUrl(url);
  const atlasOrder = typeof params.atlasOrder === "string" ? params.atlasOrder : result.orderId;

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div className="panel" style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
        <span className="eyebrow">ATLAS ONE · HYP</span>
        <h1 style={{ margin: 0 }}>{result.success ? "Оплата подтверждена" : "Получен ответ от Hyp"}</h1>
        <div className="toast" style={result.success ? { background: "#ecfdf3", color: "#166534" } : { background: "#fff7ed", color: "#9a3412" }}>
          {result.success ? "Тестовое списание 1 ₪ прошло успешно." : "Платёж не подтверждён как успешный. Посмотрите код ответа ниже."}
        </div>
        <div className="panel" style={{ background: "#f8fafc", display: "grid", gap: 10 }}>
          <div className="row between"><span className="muted">Заказ Atlas</span><strong>{atlasOrder || "—"}</strong></div>
          <div className="row between"><span className="muted">Код Hyp</span><strong>{result.code || "—"}</strong></div>
          <div className="row between"><span className="muted">ID транзакции</span><strong>{result.transactionId || "—"}</strong></div>
          <div className="row between"><span className="muted">Сумма</span><strong>{result.amount || "1.00"} ₪</strong></div>
          <div className="row between"><span className="muted">Карта</span><strong>{result.cardMask || "—"}</strong></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Эта тестовая страница намеренно не выпускает билеты. После успешного теста интеграция будет подключена к обычному checkout Atlas.</p>
        <Link className="btn dark" href="/payments/hyp/test">Повторить тест</Link>
        <Link className="btn secondary" href="/">Вернуться на сайт</Link>
      </div>
    </main>
  );
}
