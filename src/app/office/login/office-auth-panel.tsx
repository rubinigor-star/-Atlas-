"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { OfficeLoginForm } from "./office-login-form";
import styles from "./office-login.module.css";

type AuthView = "login" | "forgot" | "register";

type LoginState = {
  errorCode: string;
  error: string;
  lockSeconds: number;
  attempts: number;
  verification: string;
  registered: boolean;
  verified: boolean;
  reset: boolean;
  forgotSent: boolean;
  registerError: string;
};

const copy = {
  ru: {
    login: { panel:"Панель организаторов", title:"Вход для организаторов", subtitle:"Управление мероприятиями, заказами, командой и входом гостей.", email:"Email", password:"Пароль", submit:"Войти в кабинет", forgot:"Забыли пароль?", create:"Создать аккаунт организатора", back:"Вернуться на сайт", attempts:"Осталось попыток", lock:"Слишком много попыток входа. Новая попытка через", resendTitle:"Повторная отправка подтверждения", resendHelp:"Введите email, который использовали при регистрации.", resendButton:"Отправить письмо ещё раз" },
    forgot: { panel:"Восстановление доступа", title:"Забыли пароль?", subtitle:"Укажите рабочий email. Если аккаунт существует, мы отправим ссылку для создания нового пароля.", submit:"Отправить ссылку", back:"Вернуться ко входу", sent:"Проверьте почту. Сообщение отправлено, если этот email зарегистрирован." },
    register: { panel:"Регистрация организатора", title:"Создайте рабочий кабинет", subtitle:"После подтверждения email вы сможете создать организацию, команду и первые мероприятия.", firstName:"Имя", lastName:"Фамилия", phone:"Телефон", email:"Email", password:"Пароль", passwordHint:"Минимум 10 символов.", organization:"Название организации или бизнеса", businessType:"Тип бизнеса", choose:"Выберите", sole:"Индивидуальный предприниматель", company:"Компания", nonprofit:"Некоммерческая организация", privatePerson:"Частное лицо", country:"Страна", consent:"Я принимаю условия Atlas One", consentText:"Я ознакомился и согласен с", terms:"условиями использования для организаторов", privacy:"политикой конфиденциальности", submit:"Создать кабинет", back:"Уже есть аккаунт? Войти" },
    notices: { registeredSent:"Аккаунт создан. Проверьте входящие и папку «Спам» для подтверждения email.", registeredFailed:"Аккаунт создан, но письмо подтверждения отправить не удалось.", resent:"Если аккаунт существует и ещё не подтвержден, новое письмо отправлено.", already:"Этот email уже подтвержден. Можно войти.", invalid:"Введите корректный email.", verified:"Email подтвержден. Теперь можно войти.", reset:"Пароль обновлен." },
  },
  he: {
    login: { panel:"פאנל מארגנים", title:"כניסה למארגנים", subtitle:"ניהול אירועים, הזמנות, צוות וכניסת אורחים.", email:"דוא״ל", password:"סיסמה", submit:"כניסה למערכת", forgot:"שכחתם סיסמה?", create:"יצירת חשבון מארגן", back:"חזרה לאתר", attempts:"מספר הניסיונות שנותרו", lock:"יותר מדי ניסיונות כניסה. ניתן לנסות שוב בעוד", resendTitle:"שליחה חוזרת של אישור", resendHelp:"הזינו את כתובת הדוא״ל שבה השתמשתם בהרשמה.", resendButton:"שליחת המייל מחדש" },
    forgot: { panel:"שחזור גישה", title:"שכחתם סיסמה?", subtitle:"הזינו את כתובת הדוא״ל. אם החשבון קיים, נשלח קישור ליצירת סיסמה חדשה.", submit:"שליחת קישור", back:"חזרה לכניסה", sent:"בדקו את תיבת הדואר. אם הכתובת רשומה, נשלחה הודעה." },
    register: { panel:"הרשמת מארגן", title:"יצירת סביבת עבודה", subtitle:"לאחר אישור הדוא״ל תוכלו ליצור ארגון, צוות ואירועים.", firstName:"שם פרטי", lastName:"שם משפחה", phone:"טלפון", email:"דוא״ל", password:"סיסמה", passwordHint:"לפחות 10 תווים.", organization:"שם הארגון או העסק", businessType:"סוג העסק", choose:"בחירה", sole:"עוסק עצמאי", company:"חברה", nonprofit:"עמותה", privatePerson:"אדם פרטי", country:"מדינה", consent:"אני מאשר את תנאי Atlas One", consentText:"קראתי ואני מסכים ל", terms:"תנאי השימוש למארגנים", privacy:"מדיניות הפרטיות", submit:"יצירת חשבון", back:"כבר יש לכם חשבון? כניסה" },
    notices: { registeredSent:"החשבון נוצר. בדקו את תיבת הדואר ואת תיקיית הספאם לאישור הדוא״ל.", registeredFailed:"החשבון נוצר, אך שליחת הודעת האישור נכשלה.", resent:"אם החשבון קיים וטרם אושר, נשלחה הודעה חדשה.", already:"כתובת הדוא״ל כבר אושרה. ניתן להיכנס.", invalid:"הזינו כתובת דוא״ל תקינה.", verified:"כתובת הדוא״ל אושרה. כעת ניתן להיכנס.", reset:"הסיסמה עודכנה." },
  },
  en: {
    login: { panel:"Organizer panel", title:"Organizer login", subtitle:"Manage events, orders, your team, and guest entry.", email:"Email", password:"Password", submit:"Log in", forgot:"Forgot password?", create:"Create organizer account", back:"Return to website", attempts:"Attempts remaining", lock:"Too many login attempts. Try again in", resendTitle:"Resend verification", resendHelp:"Enter the email address used during registration.", resendButton:"Resend email" },
    forgot: { panel:"Account recovery", title:"Forgot password?", subtitle:"Enter your work email. If the account exists, we will send a link to create a new password.", submit:"Send recovery link", back:"Return to login", sent:"Check your inbox. A message was sent if this email is registered." },
    register: { panel:"Organizer registration", title:"Create your workspace", subtitle:"After verifying your email, you can create your organization, team, and first events.", firstName:"First name", lastName:"Last name", phone:"Phone", email:"Email", password:"Password", passwordHint:"At least 10 characters.", organization:"Organization or business name", businessType:"Business type", choose:"Choose", sole:"Sole proprietor", company:"Company", nonprofit:"Nonprofit organization", privatePerson:"Private individual", country:"Country", consent:"I accept the Atlas One terms", consentText:"I have read and agree to the", terms:"organizer terms of use", privacy:"privacy policy", submit:"Create account", back:"Already have an account? Log in" },
    notices: { registeredSent:"Account created. Check your inbox and spam folder to verify your email.", registeredFailed:"The account was created, but the verification email could not be sent.", resent:"If the account exists and is not verified, a new email was sent.", already:"This email is already verified. You can log in.", invalid:"Enter a valid email.", verified:"Email verified. You can now log in.", reset:"Password updated." },
  },
} as const;

export function OfficeAuthPanel({ initialView, state }: { initialView: AuthView; state: LoginState }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [view, setView] = useState<AuthView>(initialView);

  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get("view");
      setView(next === "forgot" || next === "register" ? next : "login");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function show(next: AuthView) {
    setView(next);
    const url = next === "login" ? "/office/login" : `/office/login?view=${next}`;
    window.history.pushState({}, "", url);
  }

  const heading = view === "forgot" ? text.forgot : view === "register" ? text.register : text.login;

  return <div className={`${styles.cardFrame} ${view === "register" ? styles.registerFrame : ""}`} data-auth-view={view}>
    <section className={`${styles.card} ${view === "register" ? styles.registerCard : ""}`}>
      <header className={`${styles.brand} ${view === "register" ? styles.registerBrand : ""}`}>
        <p className={styles.kicker}>{heading.panel}</p>
        <h1 className={`${styles.title} ${view === "forgot" ? styles.singleLineTitle : ""} ${view === "register" ? styles.registerTitle : ""}`}>{heading.title}</h1>
        <p className={styles.subtitle}>{heading.subtitle}</p>
      </header>

      {view === "login" && <>
        {state.registered&&state.verification==="sent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.registeredSent}</div>}
        {state.registered&&state.verification==="failed"&&<div className={styles.notice} style={{background:"#fff7ed",color:"#9a3412"}}>{text.notices.registeredFailed}</div>}
        {state.verification==="resent"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.resent}</div>}
        {state.verification==="already"&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.already}</div>}
        {state.verification==="invalid"&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{text.notices.invalid}</div>}
        {state.verified&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.verified}</div>}
        {state.reset&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.notices.reset}</div>}
        {state.error&&state.errorCode!=="LOCKED"&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{state.error}{state.errorCode==="INVALID_CREDENTIALS"&&state.attempts>0?` ${text.login.attempts}: ${state.attempts}.`:""}</div>}
        {(state.verification==="failed"||state.errorCode==="EMAIL_NOT_VERIFIED")&&<form method="post" action="/api/office/auth/resend-verification" className={styles.resend}>
          <div><strong>{text.login.resendTitle}</strong><p>{text.login.resendHelp}</p></div>
          <div className={styles.field}><label>{text.login.email}</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          <button className={styles.secondaryButton}>{text.login.resendButton}</button>
        </form>}
        <OfficeLoginForm emailLabel={text.login.email} passwordLabel={text.login.password} loginLabel={text.login.submit} lockSeconds={state.lockSeconds} lockMessage={text.login.lock}/>
        <div className={styles.links}><button type="button" onClick={()=>show("forgot")}>{text.login.forgot}</button><button type="button" onClick={()=>show("register")}>{text.login.create}</button></div>
        <Link href="/" className={styles.backLink}>{text.login.back}</Link>
      </>}

      {view === "forgot" && <>
        {state.forgotSent&&<div className={styles.notice} style={{background:"#ecfdf3",color:"#166534"}}>{text.forgot.sent}</div>}
        <form method="post" action="/api/office/auth/forgot-password" className={styles.form}>
          <div className={styles.field}><label>{text.login.email}</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          <button className={styles.primaryButton}>{text.forgot.submit}</button>
        </form>
        <button type="button" className={styles.backLink} onClick={()=>show("login")}>{text.forgot.back}</button>
      </>}

      {view === "register" && <>
        {state.registerError&&<div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}}>{state.registerError}</div>}
        <form method="post" action="/api/office/auth/register" className={`${styles.form} ${styles.registerForm}`}>
          <div className={styles.registerGrid}>
            <div className={styles.field}><label>{text.register.firstName}</label><input className={styles.input} name="firstName" autoComplete="given-name" required /></div>
            <div className={styles.field}><label>{text.register.lastName}</label><input className={styles.input} name="lastName" autoComplete="family-name" required /></div>
            <div className={styles.field}><label>{text.register.phone}</label><input className={styles.input} type="tel" name="phone" autoComplete="tel" required /></div>
            <div className={styles.field}><label>{text.register.email}</label><input className={styles.input} type="email" name="email" autoComplete="email" required /></div>
          </div>
          <div className={styles.field}><label>{text.register.password}</label><input className={styles.input} type="password" name="password" minLength={10} autoComplete="new-password" required /><small>{text.register.passwordHint}</small></div>
          <div className={styles.field}><label>{text.register.organization}</label><input className={styles.input} name="organizationName" required /></div>
          <div className={styles.registerGrid}>
            <div className={styles.field}><label>{text.register.businessType}</label><select className={styles.input} name="businessType" required defaultValue=""><option value="" disabled>{text.register.choose}</option><option value="Sole proprietor">{text.register.sole}</option><option value="Company">{text.register.company}</option><option value="Nonprofit organization">{text.register.nonprofit}</option><option value="Private individual">{text.register.privatePerson}</option></select></div>
            <div className={styles.field}><label>{text.register.country}</label><input className={styles.input} name="country" defaultValue="Israel" required /></div>
          </div>
          <label className={styles.consent}><input type="checkbox" name="acceptedTerms" required /><span><strong>{text.register.consent}</strong><small>{text.register.consentText} <Link href="/legal/organizer-terms" target="_blank">{text.register.terms}</Link> {locale === "he" ? "ו" : locale === "ru" ? "и" : "and"} <Link href="/legal/privacy" target="_blank">{text.register.privacy}</Link>.</small></span></label>
          <button className={styles.primaryButton}>{text.register.submit}</button>
        </form>
        <button type="button" className={styles.backLink} onClick={()=>show("login")}>{text.register.back}</button>
      </>}
    </section>
  </div>;
}
