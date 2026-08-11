"use client";

import { FormEvent, useState } from "react";

type Mode = "login" | "activate" | "forgot" | "reset";

export function PromoterAuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { action: mode };
    if (mode === "login" || mode === "forgot") payload.email = String(form.get("email") || "");
    if (mode === "login" || mode === "activate" || mode === "reset") payload.password = String(form.get("password") || "");
    if (mode === "activate" || mode === "reset") payload.token = token || "";
    const response = await fetch("/api/promoter/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(data.error || "Ошибка"); return; }
    if (data.redirect) { window.location.assign(data.redirect); return; }
    setMessage(data.message || "Готово");
  }

  const title = mode === "login" ? "Вход для промоутера" : mode === "activate" ? "Создайте пароль" : mode === "forgot" ? "Восстановление доступа" : "Новый пароль";
  const button = mode === "login" ? "Войти" : mode === "activate" ? "Активировать аккаунт" : mode === "forgot" ? "Отправить письмо" : "Сохранить новый пароль";

  return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f4f5f7",padding:24,fontFamily:"Arial,sans-serif"}}>
    <div style={{width:"100%",maxWidth:430,background:"white",borderRadius:20,padding:30,boxShadow:"0 20px 60px rgba(16,24,40,.08)"}}>
      <div style={{fontSize:13,letterSpacing:".12em",textTransform:"uppercase",color:"#667085",marginBottom:8}}>Atlas One · Promoter</div>
      <h1 style={{fontSize:28,margin:"0 0 8px"}}>{title}</h1>
      <p style={{color:"#667085",lineHeight:1.5}}>{mode === "activate" ? "Это одноразовая активация. После неё вход будет только по email и вашему паролю." : mode === "forgot" ? "Укажите email вашего promoter-аккаунта." : mode === "reset" ? "Придумайте новый пароль минимум из 8 символов." : "Используйте email и пароль, созданный при активации."}</p>
      <form onSubmit={submit}>
        {(mode === "login" || mode === "forgot") && <label style={{display:"block",marginTop:18}}>Email<input name="email" type="email" required autoComplete="email" style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #d0d5dd",borderRadius:10,marginTop:7}}/></label>}
        {(mode === "login" || mode === "activate" || mode === "reset") && <label style={{display:"block",marginTop:18}}>Пароль<input name="password" type="password" required minLength={mode === "login" ? 1 : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #d0d5dd",borderRadius:10,marginTop:7}}/></label>}
        {error && <div style={{marginTop:16,padding:11,borderRadius:10,background:"#fef3f2",color:"#b42318"}}>{error}</div>}
        {message && <div style={{marginTop:16,padding:11,borderRadius:10,background:"#ecfdf3",color:"#067647"}}>{message}</div>}
        <button disabled={loading} style={{width:"100%",marginTop:22,padding:13,border:0,borderRadius:10,background:"#ff5c45",color:"white",fontWeight:700,cursor:"pointer"}}>{loading ? "Подождите..." : button}</button>
      </form>
      {mode === "login" && <div style={{marginTop:18,textAlign:"center"}}><a href="/promoter/forgot-password" style={{color:"#344054"}}>Забыли пароль?</a></div>}
      {mode !== "login" && mode !== "activate" && <div style={{marginTop:18,textAlign:"center"}}><a href="/promoter/login" style={{color:"#344054"}}>Вернуться ко входу</a></div>}
    </div>
  </div>;
}
