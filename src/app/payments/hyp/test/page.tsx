import Link from "next/link";

export const dynamic = "force-dynamic";

const copy = {
  title: "Тест оплаты Hyp",
  text: "Эта страница создаёт отдельную реальную оплату на 1 ₪ через Hyp. Она не создаёт билет и не изменяет существующие заказы Atlas.",
  warning: "Будет выполнено настоящее списание 1 ₪. Для теста используйте свою карту, Apple Pay или Google Pay.",
  start: "Перейти к оплате 1 ₪",
};

export default async function HypTestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <div className="panel" style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 18 }}>
        <span className="eyebrow">ATLAS ONE · HYP</span>
        <h1 style={{ margin: 0 }}>{copy.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{copy.text}</p>
        <div className="toast" style={{ background: "#fff7ed", color: "#9a3412" }}>{copy.warning}</div>
        {params.error && <div className="toast" style={{ background: "#fff1f0", color: "#b42318", overflowWrap: "anywhere" }}>{params.error}</div>}
        <Link className="btn dark" href="/api/payments/hyp/test">{copy.start}</Link>
        <Link className="btn secondary" href="/">Вернуться на сайт</Link>
      </div>
    </main>
  );
}
