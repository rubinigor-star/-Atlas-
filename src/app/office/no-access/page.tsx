import { AdminShell } from "@/components/admin-shell";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const staff = await getCurrentStaff();
  return <AdminShell><section className="panel" style={{maxWidth:760}}><span className="eyebrow">Access control</span><h1>Доступ пока не назначен</h1><p className="muted">Ваш рабочий аккаунт активирован, но для него ещё не выбраны доступные инструменты. Обратитесь к владельцу или администратору организации.</p>{staff?.eventScope==="NONE"&&<p className="muted">Доступ к мероприятиям также пока отключён.</p>}</section></AdminShell>;
}
