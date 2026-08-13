import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";
import { getServerI18n } from "@/lib/server-locale";
import { OfficeLanguageControl } from "./office-login-branding";
import { OfficeLoginForm } from "./office-login-form";
import styles from "./office-login.module.css";
import brandingStyles from "./office-login-branding.module.css";

export const dynamic = "force-dynamic";

const copy = {
  ru: {
    panel: "Панель организаторов",
    title: "Вход для организаторов",
    subtitle: "Управление мероприятиями, заказами, командой и входом гостей.",
    email: "Email",
    password: "Пароль",
    login: "Войти в кабинет",
    forgot: "Забыли пароль?",
    create: "Создать аккаунт организатора",
    back: "Вернуться на сайт",
    attemptsLeft: "Осталось попыток",
    lockMessage: "Слишком много попыток входа. Новая попытка через",
    resendTitle: "Повторная отправка подтверждения",
    resendHelp: "Введите email, который использовали при регистрации.",
    resendButton: "Отправить письмо ещё раз",
    notices: {
      registeredSent: "Аккаунт создан. Письмо подтверждения принято почтовым сервисом. Проверьте входящие и папку «Спам».",
      registeredFailed: "Аккаунт создан, но письмо подтверждения отправить не удалось. Повторите отправку ниже. Войти до подтверждения email нельзя.",
      resent: "Если аккаунт существует и ещё не подтверждён, новое письмо отправлено.",
      already: "Этот email уже подтверждён. Можно войти.",
      invalid: "Введите корректный email для повторной отправки.",
      verified: "Email подтверждён. Теперь можно войти.",
      reset: "Пароль обновлён.",
    },
    errors: {
      INVALID_CREDENTIALS: "Неверный email или пароль.",
      PASSWORD_NOT_SET: "Для этого аккаунта ещё не создан пароль. Используйте восстановление доступа.",
      EMAIL_NOT_VERIFIED: "Сначала подтвердите email по ссылке из письма.",
      LOCKED: "Слишком много попыток входа.",
      TOKEN_EXPIRED: "Ссылка недействительна или срок её действия истёк.",
    },
  },
  he: {
    panel: "פאנל מארגנים",
    title: "כניסה למארגנים",
    subtitle: "ניהול אירועים, הזמנות, צוות וכניסת אורחים.",
    email: "דוא״ל",
    password: "סיסמה",
    login: "כניסה למערכת",
    forgot: "שכחתם סיסמה?",
    create: "יצירת חשבון מארגן",
    back: "חזרה לאתר",
    attemptsLeft: "מספר הניסיונות שנותרו",
    lockMessage: "יותר מדי ניסיונות כניסה. ניתן לנסות שוב בעוד",
    resendTitle: "שליחה חוזרת של אישור",
    resendHelp: "הזינו את כתובת הדוא״ל שבה השתמשתם בהרשמה.",
    resendButton: "שליחת המייל מחדש",
    notices: {
      registeredSent: "החשבון נוצר. הודעת האישור נשלחה. בדקו את תיבת הדואר ואת תיקיית הספאם.",
      registeredFailed: "החשבון נוצר, אך שליחת הודעת האישור נכשלה. נסו לשלוח אותה שוב למטה. לא ניתן להיכנס לפני אישור הדוא״ל.",
      resent: "אם החשבון קיים ועדיין לא אושר, נשלחה הודעה חדשה.",
      already: "כתובת הדוא״ל כבר אושרה. ניתן להיכנס.",
      invalid: "הזינו כתובת דוא״ל תקינה לשליחה חוזרת.",
      verified: "כתובת הדוא״ל אושרה. כעת ניתן להיכנס.",
      reset: "הסיסמה עודכנה.",
    },
    errors: {
      INVALID_CREDENTIALS: "כתובת הדוא״ל או הסיסמה שגויות.",
      PASSWORD_NOT_SET: "עדיין לא הוגדרה סיסמה לחשבון זה. השתמשו בשחזור הגישה.",
      EMAIL_NOT_VERIFIED: "יש לאשר תחילה את כתובת הדוא״ל באמצעות הקישור שנשלח.",
      LOCKED: "בוצעו יותר מדי ניסיונות כניסה.",
      TOKEN_EXPIRED: "הקישור אינו תקין או שפג תוקפו.",
    },
  },
  en: {
    panel: "Organizer panel",
    title: "Organizer login",
    subtitle: "Manage events, orders, your team, and guest entry.",
    email: "Email",
    password: "Password",
    login: "Log in",
    forgot: "Forgot password?",
    create: "Create organizer account",
    back: "Return to website",
    attemptsLeft: "Attempts remaining",
    lockMessage: "Too many login attempts. Try again in",
    resendTitle: "Resend verification",
    resendHelp: "Enter the email address used during registration.",
    resendButton: "Resend email",
    notices: {
      registeredSent: "Your account was created. Check your inbox and spam folder for the verification email.",
      registeredFailed: "Your account was created, but the verification email could not be sent. Try again below. You cannot log in until your email is verified.",
      resent: "If the account exists and is not yet verified, a new email has been sent.",
      already: "This email is already verified. You can log in.",
      invalid: "Enter a valid email address to resend verification.",
      verified: "Email verified. You can now log in.",
      reset: "Password updated.",
    },
    errors: {
      INVALID_CREDENTIALS: "Incorrect email or password.",
      PASSWORD_NOT_SET: "A password has not been created for this account. Use account recovery.",
      EMAIL_NOT_VERIFIED: "Verify your email using the link sent to you before logging in.",
      LOCKED: "Too many login attempts.",
      TOKEN_EXPIRED: "The link is invalid or has expired.",
    },
  },
} as const;

export default async function OfficeLoginPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const [{ locale }, params] = await Promise.all([getServerI18n(), searchParams]);
  const text = copy[locale];
  const errorCode = typeof params.error === "string" ? params.error : "";
  const error = errorCode && errorCode in text.errors ? text.errors[errorCode as keyof typeof text.errors] : "";
  const lockSeconds = errorCode === "LOCKED" ? Math.max(0, Math.min(60, Number.parseInt(typeof params.retryAfter === "string" ? params.retryAfter : "60", 10) || 60)) : 0;
  const attempts = Math.max(0, Math.min(2, Number.parseInt(typeof params.attempts === "string" ? params.attempts : "", 10)));
  const verification = typeof params.verification === "string" ? params.verification : "";
  const showResend = verification === "failed" || params.error === "EMAIL_NOT_VERIFIED";

  return <main className={styles.page}>
    <div className={brandingStyles.loginTopbar}>
      <AtlasLogo />
      <OfficeLanguageControl />
    </div>

    <div className={styles.cardFrame}>
      <section className={styles.card}>
        <header className={styles.brand}>
          <img className={styles.logo} src="/branding/atlas-backstage-logo.svg" alt="Atlas One Backstage" />
          <p className={styles.kicker}>{text.panel}</p>
          <h1 className={styles.title}>{text.title}</h1>
          <p className={styles.subtitle}>{text.subtitle}</p>
        </header>

        {params.registered&&verification==="sent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.registeredSent}</div>}
        {params.registered&&verification==="failed"&&<div className={styles.notice} style={{background:"#fff7ed",color:"#9a3412"}}>{text.notices.registeredFailed}</div>}
        {verification==="resent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.resent}</div>}
        {verification==="already"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.already}</div>}
        {verification==="invalid"&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{text.notices.invalid}</div>}
        {params.verified&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.verified}</div>}
        {params.reset&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.reset}</div>}
        {error&&errorCode!=="LOCKED"&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{error}{errorCode==="INVALID_CREDENTIALS"&&attempts>0?` ${text.attemptsLeft}: ${attempts}.`:""}</div>}

        {showResend&&<form method="post" action="/api/office/auth/resend-verification" className={styles.resend}>
          <div><strong>{text.resendTitle}</strong><p>{text.resendHelp}</p></div>
          <div className={styles.field}><label>{text.email}</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          <button className={styles.secondaryButton}>{text.resendButton}</button>
        </form>}

        <OfficeLoginForm emailLabel={text.email} passwordLabel={text.password} loginLabel={text.login} lockSeconds={lockSeconds} lockMessage={text.lockMessage}/>

        <div className={styles.links}><Link href="/office/forgot-password">{text.forgot}</Link><Link href="/office/register">{text.create}</Link></div>
        <Link href="/" className={styles.backLink}>{text.back}</Link>
      </section>
    </div>
  </main>;
}
