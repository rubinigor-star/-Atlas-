import Link from "next/link";
import { redirect } from "next/navigation";
import { AtlasLogo } from "@/components/atlas-logo";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errors: Record<string,string> = {
  INVALID_CREDENTIALS: "Неверный email или пароль.",
  PASSWORD_NOT_SET: "Для этого аккаунта ещё не создан пароль. Используйте восстановление доступа.",
  EMAIL_NOT_VERIFIED: "Сначала подтвердите email по ссылке из письма.",
  LOCKED: "Слишком много попыток входа. Попробуйте снова через 15 минут.",
  TOKEN_EXPIRED: "Ссылка недействительна или срок её действия истёк.",
};

export default async function OfficeLoginPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const currentStaff = await getCurrentStaff();
  if (currentStaff) redirect(currentStaff.role === "ADMIN" ? "/platform" : "/office");

  const params = await searchParams;
  const error = typeof params.error === "string" ? errors[params.error] : "";
  const verification = typeof params.verification === "string" ? params.verification : "";
  const showResend = verification === "failed" || params.error === "EMAIL_NOT_VERIFIED";

  return <main className="container" style={{maxWidth:540,paddingTop:60,paddingBottom:80}}>
    <div className="panel form" style={{padding:32}}>
      <AtlasLogo office />
      <div><span className="eyebrow">ATLAS ONE OFFICE</span><h1>Вход для организаторов</h1><p className="muted">Управление мероприятиями, заказами, командой и входом гостей.</p></div>
      {params.registered&&verification==="sent"&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Аккаунт создан. Письмо подтверждения принято почтовым сервисом. Проверьте входящие и папку «Спам».</div>}
      {params.registered&&verification==="failed"&&<div className="toast" style={{background:"#fff7ed",color:"#9a3412"}}>Аккаунт создан, но письмо подтверждения отправить не удалось. Повторите отправку ниже. Войти до подтверждения email нельзя.</div>}
      {verification==="resent"&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Если аккаунт существует и ещё не подтверждён, новое письмо отправлено.</div>}
      {verification==="already"&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Этот email уже подтверждён. Можно войти.</div>}
      {verification==="invalid"&&<div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>Введите корректный email для повторной отправки.</div>}
      {params.verified&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Email подтверждён. Теперь можно войти.</div>}
      {params.reset&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Пароль обновлён.</div>}
      {error&&<div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>{error}</div>}

      {showResend&&<form method="post" action="/api/office/auth/resend-verification" className="form" style={{padding:"16px",border:"1px solid #fed7aa",borderRadius:14,background:"#fffaf5"}}>
        <div><strong>Повторная отправка подтверждения</strong><p className="muted" style={{margin:"6px 0 0"}}>Введите email, который использовали при регистрации.</p></div>
        <div className="field"><label>Email</label><input className="input" type="email" name="email" autoComplete="email" required /></div>
        <button className="btn secondary">Отправить письмо ещё раз</button>
      </form>}

      <form method="post" action="/api/office/auth/login" className="form">
        <div className="field"><label>Email</label><input className="input" type="email" name="email" autoComplete="email" required /></div>
        <div className="field"><label>Пароль</label><input className="input" type="password" name="password" autoComplete="current-password" required /></div>
        <button className="btn dark">Войти в кабинет</button>
      </form>
      <div className="row between" style={{flexWrap:"wrap"}}><Link href="/office/forgot-password">Забыли пароль?</Link><Link href="/office/register">Создать аккаунт организатора</Link></div>
      <Link href="/" className="btn secondary">Вернуться на сайт</Link>
    </div>
  </main>;
}
