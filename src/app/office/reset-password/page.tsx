import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";

export default async function OfficeResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <main className="container" style={{maxWidth:540,paddingTop:60,paddingBottom:80}}><div className="panel form" style={{padding:32}}>
    <AtlasLogo office /><div><span className="eyebrow">Новый пароль</span><h1>Восстановите доступ</h1><p className="muted">Создайте новый пароль длиной не менее 10 символов.</p></div>
    {params.error&&<div className="toast" style={{background:"#fff1f0",color:"#b42318"}}>Пароль слишком короткий или ссылка недействительна.</div>}
    {token?<form method="post" action="/api/office/auth/reset-password" className="form"><input type="hidden" name="token" value={token}/><div className="field"><label>Новый пароль</label><input className="input" type="password" name="password" minLength={10} autoComplete="new-password" required /></div><button className="btn dark">Сохранить новый пароль</button></form>:<div className="toast">Ссылка восстановления отсутствует.</div>}
    <Link href="/office/login">Вернуться ко входу</Link>
  </div></main>;
}
