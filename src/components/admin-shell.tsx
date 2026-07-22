"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link href="/admin"><strong>{t("overview")}</strong></Link>
        <Link href="/admin/requests">{t("requests")}</Link>
        <Link href="/admin/events/new">{t("createEvent")}</Link>
        <Link href="/admin/orders">{t("orders")}</Link>
        <Link href="/scanner">{t("scanner")}</Link>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
