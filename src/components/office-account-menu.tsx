"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, ExternalLink, LogOut } from "lucide-react";

export function OfficeAccountMenu({ currentEmail, currentName, compact = false }: { currentEmail: string; currentName: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  useEffect(() => { const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event); }; window.addEventListener("beforeinstallprompt", handler); return () => window.removeEventListener("beforeinstallprompt", handler); }, []);
  async function install() { if (!installEvent) return; await (installEvent as Event & { prompt: () => Promise<void> }).prompt(); setInstallEvent(null); }
  return <div className={`office-account ${compact ? "compact" : ""}`}>
    <button onClick={() => setOpen(value => !value)} aria-expanded={open}><span>{currentName.split(" ").map(part => part[0]).slice(0, 2).join("")}</span>{!compact && <div><strong>{currentName}</strong><small>{currentEmail}</small></div>}</button>
    {open && <div className="office-account-popover">
      <strong>Рабочий аккаунт</strong>
      <div style={{padding:"8px 10px"}}><strong>{currentName}</strong><small style={{display:"block"}}>{currentEmail}</small></div>
      {installEvent && <button onClick={() => void install()}><Download size={16}/><span>Установить Atlas Office<small>Добавить приложение на устройство</small></span></button>}
      <Link href="/"><ExternalLink size={16}/><span>Открыть сайт покупателей</span></Link>
      <form method="post" action="/api/office/auth/logout"><button type="submit"><LogOut size={16}/><span>Выйти из кабинета</span></button></form>
    </div>}
  </div>;
}
