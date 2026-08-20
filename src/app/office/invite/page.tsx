import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";
import { verifyOfficeActionToken } from "@/lib/auth";

export default async function StaffInvitePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  const token = params.token || "";
  const payload = token ? verifyOfficeActionToken(token, "invite") : null;
  if (!payload) {
    return <main className="container" style={{maxWidth:680,paddingTop:48,paddingBottom:80}}><div className="panel form" style={{padding:32}}><AtlasLogo office/><h1>Приглашение недействительно</h1><p className="muted">Ссылка устарела или уже недоступна. Попросите владельца организации отправить новое приглашение.</p><Link className="btn secondary" href="/office/login">Перейти ко входу</Link></div></main>;
  }
  const weak = params.error === "WEAK_PASSWORD";
  return <main className="container" style={{maxWidth:680,paddingTop:48,paddingBottom:80}}><div className="panel form" style={{padding:32}}><AtlasLogo office/><div><span className="eyebrow">Staff invitation</span><h1>Активируйте рабочий доступ</h1><p className="muted">Аккаунт: <strong>{payload.email}</strong>. Создайте личный пароль. После активации вы сможете войти только в те разделы и мероприятия, которые разрешены вашей ролью.</p></div>{weak&&<div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>Пароль должен содержать минимум 10 символов.</div>}<form method="post" action="/api/office/auth/accept-invite" className="form"><input type="hidden" name="token" value={token}/><label className="field"><span>Новый пароль</span><input className="input" type="password" name="password" minLength={10} autoComplete="new-password" required/></label><button className="btn dark">Активировать аккаунт</button></form></div></main>;
}
