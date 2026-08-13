import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";
import { ORGANIZER_AGREEMENT_VERSION } from "@/lib/organizer-compliance";

export default async function OfficeRegisterPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const error = params.error === "EMAIL_EXISTS" ? "Аккаунт с таким email уже существует." : params.error ? "Проверьте заполненные данные." : "";
  return <main className="container" style={{maxWidth:760,paddingTop:48,paddingBottom:80}}>
    <div className="panel form" style={{padding:32}}>
      <AtlasLogo office />
      <div><span className="eyebrow">Регистрация организатора</span><h1>Создайте рабочий кабинет</h1><p className="muted">Договор Atlas подписывается электронным подтверждением при регистрации. Банковские реквизиты и налоговые документы можно добавить позже, они понадобятся только перед первой выплатой.</p></div>
      {error&&<div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>{error}</div>}
      <form method="post" action="/api/office/auth/register" className="form">
        <div className="form-grid two"><div className="field"><label>Имя</label><input className="input" name="firstName" autoComplete="given-name" required /></div><div className="field"><label>Фамилия</label><input className="input" name="lastName" autoComplete="family-name" required /></div></div>
        <div className="form-grid two"><div className="field"><label>Телефон</label><input className="input" type="tel" name="phone" autoComplete="tel" required /></div><div className="field"><label>Email</label><input className="input" type="email" name="email" autoComplete="email" required /></div></div>
        <div className="field"><label>Пароль</label><input className="input" type="password" name="password" minLength={10} autoComplete="new-password" required /><small className="muted">Минимум 10 символов.</small></div>
        <div className="field"><label>Название организации или бизнеса</label><input className="input" name="organizationName" required /></div>
        <div className="form-grid two"><div className="field"><label>Тип бизнеса</label><select name="businessType" required defaultValue=""><option value="" disabled>Выберите</option><option value="Индивидуальный предприниматель">Индивидуальный предприниматель</option><option value="Компания">Компания</option><option value="Некоммерческая организация">Некоммерческая организация</option><option value="Частное лицо">Частное лицо</option></select></div><div className="field"><label>Страна</label><input className="input" name="country" defaultValue="Israel" required /></div></div>
        <label className="option" style={{alignItems:"flex-start"}}><span><strong>Подписываю договор Atlas One</strong><small>Нажимая подтверждение, я принимаю <Link href="/legal/organizer-terms" target="_blank" style={{textDecoration:"underline"}}>условия для организаторов</Link> и <Link href="/legal/privacy" target="_blank" style={{textDecoration:"underline"}}>политику конфиденциальности</Link>. Atlas сохранит имя, email, дату и время принятия, версию договора {ORGANIZER_AGREEMENT_VERSION} и цифровой хэш текста.</small></span><input type="checkbox" name="acceptedTerms" required /></label>
        <button className="btn dark">Подписать и создать кабинет</button>
      </form>
      <Link href="/office/login">Уже есть аккаунт? Войти</Link>
    </div>
  </main>;
}
