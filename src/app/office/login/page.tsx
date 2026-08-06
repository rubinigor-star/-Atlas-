import Link from "next/link";
import { OfficeLanguageControl } from "./office-login-branding";
import styles from "./office-login.module.css";
import brandingStyles from "./office-login-branding.module.css";

export const dynamic = "force-dynamic";

const errors: Record<string,string> = {
  INVALID_CREDENTIALS: "Неверный email или пароль.",
  PASSWORD_NOT_SET: "Для этого аккаунта ещё не создан пароль. Используйте восстановление доступа.",
  EMAIL_NOT_VERIFIED: "Сначала подтвердите email по ссылке из письма.",
  LOCKED: "Слишком много попыток входа. Попробуйте снова через 15 минут.",
  TOKEN_EXPIRED: "Ссылка недействительна или срок её действия истёк.",
};

export default async function OfficeLoginPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? errors[params.error] : "";
  const verification = typeof params.verification === "string" ? params.verification : "";
  const showResend = verification === "failed" || params.error === "EMAIL_NOT_VERIFIED";

  return <main className={styles.page}>
    <div className={brandingStyles.loginTopbar}>
      <Link href="/" className={brandingStyles.siteLogo} aria-label="Atlas One">
        <img src="/atlas-one-logo-dark.png" alt="Atlas One" />
      </Link>
      <OfficeLanguageControl />
    </div>

    <div className={styles.cardFrame}>
      <section className={styles.card}>
        <header className={styles.brand}>
          <img className={styles.logo} src="/branding/atlas-backstage-logo.svg" alt="Atlas One Backstage" />
          <p className={styles.kicker}>ATLAS ONE OFFICE</p>
          <h1 className={styles.title}>Вход для организаторов</h1>
          <p className={styles.subtitle}>Управление мероприятиями, заказами, командой и входом гостей.</p>
        </header>

        {params.registered&&verification==="sent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>Аккаунт создан. Письмо подтверждения принято почтовым сервисом. Проверьте входящие и папку «Спам».</div>}
        {params.registered&&verification==="failed"&&<div className={styles.notice} style={{background:"#fff7ed",color:"#9a3412"}}>Аккаунт создан, но письмо подтверждения отправить не удалось. Повторите отправку ниже. Войти до подтверждения email нельзя.</div>}
        {verification==="resent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>Если аккаунт существует и ещё не подтверждён, новое письмо отправлено.</div>}
        {verification==="already"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>Этот email уже подтверждён. Можно войти.</div>}
        {verification==="invalid"&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>Введите корректный email для повторной отправки.</div>}
        {params.verified&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>Email подтверждён. Теперь можно войти.</div>}
        {params.reset&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>Пароль обновлён.</div>}
        {error&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{error}</div>}

        {showResend&&<form method="post" action="/api/office/auth/resend-verification" className={styles.resend}>
          <div><strong>Повторная отправка подтверждения</strong><p>Введите email, который использовали при регистрации.</p></div>
          <div className={styles.field}><label>Email</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          <button className={styles.secondaryButton}>Отправить письмо ещё раз</button>
        </form>}

        <form method="post" action="/api/office/auth/login" className={styles.form}>
          <div className={styles.field}><label>Email</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          <div className={styles.field}><label>Пароль</label><input className={styles.input} type="password" name="password" autoComplete="current-password" required /></div>
          <button className={styles.primaryButton}>Войти в кабинет</button>
        </form>

        <div className={styles.links}><Link href="/office/forgot-password">Забыли пароль?</Link><Link href="/office/register">Создать аккаунт организатора</Link></div>
        <Link href="/" className={styles.backLink}>Вернуться на сайт</Link>
      </section>
    </div>
  </main>;
}
