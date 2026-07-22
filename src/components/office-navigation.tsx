"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffPermission } from "@prisma/client";
import { BarChart3, CalendarDays, ClipboardCheck, LayoutDashboard, QrCode, ReceiptText, Users } from "lucide-react";

const links: Array<{ href: string; label: string; permission?: StaffPermission; icon: typeof LayoutDashboard }> = [
  { href: "/office", label: "Обзор", permission: "EVENT_VIEW", icon: LayoutDashboard },
  { href: "/office/requests", label: "Заявки", permission: "REQUEST_REVIEW", icon: ClipboardCheck },
  { href: "/office/events/new", label: "Мероприятия", permission: "EVENT_MANAGE", icon: CalendarDays },
  { href: "/office/orders", label: "Заказы", permission: "ORDER_VIEW", icon: ReceiptText },
  { href: "/office/scanner", label: "Сканер", permission: "SCAN", icon: QrCode },
  { href: "/office/team", label: "Команда", permission: "TEAM_MANAGE", icon: Users },
  { href: "/office/audit", label: "Журнал", permission: "TEAM_MANAGE", icon: BarChart3 },
];

export function OfficeNavigation({ permissions, mobile = false }: { permissions: StaffPermission[]; mobile?: boolean }) {
  const pathname = usePathname();
  const allowed = new Set(permissions);
  const visible = links.filter((link) => !link.permission || allowed.has(link.permission));
  const shown = mobile ? visible.slice(0, 5) : visible;
  return <nav className={mobile ? "office-bottom-nav" : "office-nav"}>{shown.map((link) => { const Icon=link.icon; const active=link.href==="/office"?pathname===link.href:pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={active?"active":""}><Icon size={19}/><span>{link.label}</span></Link>; })}</nav>;
}
