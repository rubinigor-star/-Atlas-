"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, ExternalLink, LogOut } from "lucide-react";

export function OfficeAccountMenu({
  currentName,
  currentRole,
  currentEmail,
  compact = false,
}: {
  currentName: string;
  currentRole?: string;
  currentEmail?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installEvent) return;
    await (installEvent as Event & { prompt: () => Promise<void> }).prompt();
    setInstallEvent(null);
  }

  const initials = currentName
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join("");
  const staffTitle = currentRole ?? "Сотрудник";

  return <div className={`office-account ${compact ? "compact" : ""}`}>
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Открыть меню сотрудника">
      <span>{initials}</span>
      {!compact && <div><strong>{currentName}</strong><small>{staffTitle}</small></div>}
    </button>

    {!compact && <form className="office-logout-direct" method="post" action="/api/office/auth/logout">
      <button type="submit"><LogOut size={16}/><span>Выйти из кабинета</span></button>
    </form>}

    {open && <div className="office-account-popover">
      <strong>Текущий сотрудник</strong>
      <div style={{ padding: "8px 10px" }}>
        <strong>{currentName}</strong>
        <small style={{ display: "block" }}>{staffTitle}</small>
      </div>
      {installEvent && <button type="button" onClick={() => void install()}><Download size={16}/><span>Установить Atlas Office<small>Добавить приложение на устройство</small></span></button>}
      <Link href="/"><ExternalLink size={16}/><span>Открыть сайт покупателей</span></Link>
      <form method="post" action="/api/office/auth/logout"><button type="submit"><LogOut size={16}/><span>Выйти из кабинета</span></button></form>
    </div>}
  </div>;
}
