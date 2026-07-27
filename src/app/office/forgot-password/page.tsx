import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";

export default async function OfficeForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  return <main className="container" style={{maxWidth:540,paddingTop:60,paddingBottom:80}}><div className="panel form" style={{padding:32}}>
    <AtlasLogo office /><div><span className="eyebrow">Восстановление доступа</span><h1>Забыли пароль?</h1><p className="muted">Укажите рабочий email. Если аккаунт существует, мы отправим ссылку для создания нового пароля.</p></div>
    {params.sent&&<div className="toast" style={{background:"#ecfdf3",color:"#166534"}}>Проверьте почту. Сообщение отправлено, если этот email зарегистрирован.</div>}
    <form method="post" action="/api/office/auth/forgot-password" className="form"><div className="field"><label>Email</label><input className="input" type="email" name="email" autoComplete="email" required /></div><button className="btn dark">Отправить ссылку</button></form>
    <Link href="/office/login">Вернуться ко входу</Link>
  </div></main>;
}
