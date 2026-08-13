import { AtlasLogo } from "@/components/atlas-logo";
import { getServerI18n } from "@/lib/server-locale";
import { OfficeAuthPanel } from "./office-auth-panel";
import { OfficeLanguageControl } from "./office-login-branding";
import styles from "./office-login.module.css";
import brandingStyles from "./office-login-branding.module.css";

export const dynamic = "force-dynamic";

const errors = {
  ru: {
    INVALID_CREDENTIALS: "Неверный email или пароль.",
    PASSWORD_NOT_SET: "Для этого аккаунта ещё не создан пароль. Используйте восстановление доступа.",
    EMAIL_NOT_VERIFIED: "Сначала подтвердите email по ссылке из письма.",
    LOCKED: "Слишком много попыток входа.",
    TOKEN_EXPIRED: "Ссылка недействительна или срок её действия истёк.",
  },
  he: {
    INVALID_CREDENTIALS: "כתובת הדוא״ל או הסיסמה שגויות.",
    PASSWORD_NOT_SET: "עדיין לא הוגדרה סיסמה לחשבון זה. השתמשו בשחזור הגישה.",
    EMAIL_NOT_VERIFIED: "יש לאשר תחילה את כתובת הדוא״ל באמצעות הקישור שנשלח.",
    LOCKED: "בוצעו יותר מדי ניסיונות כניסה.",
    TOKEN_EXPIRED: "הקישור אינו תקין או שפג תוקפו.",
  },
  en: {
    INVALID_CREDENTIALS: "Incorrect email or password.",
    PASSWORD_NOT_SET: "A password has not been created for this account. Use account recovery.",
    EMAIL_NOT_VERIFIED: "Verify your email using the link sent to you before logging in.",
    LOCKED: "Too many login attempts.",
    TOKEN_EXPIRED: "The link is invalid or has expired.",
  },
} as const;

export default async function OfficeLoginPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const [{ locale }, params] = await Promise.all([getServerI18n(), searchParams]);
  const requestedView = typeof params.view === "string" ? params.view : "login";
  const initialView = requestedView === "forgot" || requestedView === "register" ? requestedView : "login";
  const errorCode = typeof params.error === "string" ? params.error : "";
  const dictionary = errors[locale];
  const error = errorCode && errorCode in dictionary ? dictionary[errorCode as keyof typeof dictionary] : "";
  const lockSeconds = errorCode === "LOCKED" ? Math.max(0, Math.min(60, Number.parseInt(typeof params.retryAfter === "string" ? params.retryAfter : "60", 10) || 60)) : 0;
  const attempts = Math.max(0, Math.min(2, Number.parseInt(typeof params.attempts === "string" ? params.attempts : "", 10)));
  const verification = typeof params.verification === "string" ? params.verification : "";
  const registerError = initialView === "register" && errorCode === "EMAIL_EXISTS"
    ? locale === "he" ? "כבר קיים חשבון עם כתובת דוא״ל זו." : locale === "en" ? "An account with this email already exists." : "Аккаунт с таким email уже существует."
    : initialView === "register" && errorCode
      ? locale === "he" ? "בדקו את הנתונים שהוזנו." : locale === "en" ? "Check the information you entered." : "Проверьте заполненные данные."
      : "";

  return <main className={styles.page}>
    <div className={brandingStyles.loginTopbar}>
      <AtlasLogo />
      <OfficeLanguageControl />
    </div>
    <OfficeAuthPanel initialView={initialView} state={{
      errorCode,
      error,
      lockSeconds,
      attempts,
      verification,
      registered:Boolean(params.registered),
      verified:Boolean(params.verified),
      reset:Boolean(params.reset),
      forgotSent:Boolean(params.sent),
      registerError,
    }}/>
  </main>;
}
