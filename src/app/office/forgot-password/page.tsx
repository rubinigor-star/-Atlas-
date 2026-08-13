import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";
import { getServerI18n } from "@/lib/server-locale";
import { OfficeLanguageControl } from "../login/office-login-branding";
import styles from "../login/office-login.module.css";
import brandingStyles from "../login/office-login-branding.module.css";

export const dynamic = "force-dynamic";

const copy = {
  ru: {
    panel: "Восстановление доступа",
    title: "Забыли пароль?",
    subtitle: "Укажите рабочий email. Если аккаунт существует, мы отправим ссылку для создания нового пароля.",
    email: "Email",
    submit: "Отправить ссылку",
    back: "Вернуться ко входу",
    sent: "Проверьте почту. Сообщение отправлено, если этот email зарегистрирован.",
  },
  he: {
    panel: "שחזור גישה",
    title: "שכחתם סיסמה?",
    subtitle: "הזינו את כתובת הדוא״ל של החשבון. אם החשבון קיים, נשלח קישור ליצירת סיסמה חדשה.",
    email: "דוא״ל",
    submit: "שליחת קישור",
    back: "חזרה לכניסה",
    sent: "בדקו את תיבת הדואר. אם כתובת הדוא״ל רשומה, נשלחה אליה הודעה.",
  },
  en: {
    panel: "Account recovery",
    title: "Forgot password?",
    subtitle: "Enter your work email. If the account exists, we will send a link to create a new password.",
    email: "Email",
    submit: "Send recovery link",
    back: "Return to login",
    sent: "Check your inbox. A message was sent if this email is registered.",
  },
} as const;

export default async function OfficeForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const [{ locale }, params] = await Promise.all([getServerI18n(), searchParams]);
  const text = copy[locale];

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

        {params.sent && <div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.sent}</div>}

        <form method="post" action="/api/office/auth/forgot-password" className={styles.form}>
          <div className={styles.field}>
            <label>{text.email}</label>
            <input className={styles.input} type="email" name="email" autoComplete="email" required />
          </div>
          <button className={styles.primaryButton}>{text.submit}</button>
        </form>

        <Link href="/office/login" className={styles.backLink}>{text.back}</Link>
      </section>
    </div>
  </main>;
}
