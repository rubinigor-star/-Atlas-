"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffPermission } from "@prisma/client";
import { BarChart3, Building2, CalendarDays, ClipboardCheck, ContactRound, LayoutDashboard, ListChecks, Megaphone, QrCode, ReceiptText, Share2, ShoppingCart, Users } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const links: Array<{ href: string; key: "overview" | "requests" | "events" | "guestLists" | "guests" | "promoters" | "marketing" | "abandoned" | "orders" | "scanner" | "team" | "audit" | "company"; permission?: StaffPermission; icon: typeof LayoutDashboard }> = [
  { href: "/office", key: "overview", permission: "EVENT_VIEW", icon: LayoutDashboard },
  { href: "/office/requests", key: "requests", permission: "REQUEST_REVIEW", icon: ClipboardCheck },
  { href: "/office/events", key: "events", permission: "EVENT_VIEW", icon: CalendarDays },
  { href: "/office/guest-lists", key: "guestLists", permission: "EVENT_MANAGE", icon: ListChecks },
  { href: "/office/guests", key: "guests", permission: "ORDER_VIEW", icon: ContactRound },
  { href: "/office/promoters", key: "promoters", permission: "ANALYTICS_VIEW", icon: Share2 },
  { href: "/office/marketing", key: "marketing", permission: "ANALYTICS_VIEW", icon: Megaphone },
  { href: "/office/abandoned", key: "abandoned", permission: "ANALYTICS_VIEW", icon: ShoppingCart },
  { href: "/office/orders", key: "orders", permission: "ORDER_VIEW", icon: ReceiptText },
  { href: "/office/company", key: "company", permission: "FINANCE_VIEW", icon: Building2 },
  { href: "/office/scanner", key: "scanner", permission: "SCAN", icon: QrCode },
  { href: "/office/team", key: "team", permission: "TEAM_MANAGE", icon: Users },
  { href: "/office/audit", key: "audit", permission: "TEAM_MANAGE", icon: BarChart3 },
];

export function OfficeNavigation({ permissions, mobile = false }: { permissions: StaffPermission[]; mobile?: boolean }) {
  const pathname = usePathname();
  const { messages } = useLocale();
  const allowed = new Set(permissions);
  const visible = links.filter((link) => !link.permission || allowed.has(link.permission));
  const shown = mobile ? visible.slice(0, 5) : visible;
  const labels = {
    overview: messages.common.overview,
    requests: messages.common.requests,
    events: messages.nav.events,
    guestLists: messages.nav.guestLists,
    guests: messages.nav.guests,
    promoters: messages.nav.promoters,
    marketing: "Реклама",
    abandoned: "Потерянные продажи",
    orders: messages.common.orders,
    company: "Компания и условия",
    scanner: messages.common.scanner,
    team: messages.nav.team,
    audit: messages.nav.audit,
  };
  return <nav className={mobile ? "office-bottom-nav" : "office-nav"}>{shown.map((link) => { const Icon=link.icon; const active=link.href==="/office"?pathname===link.href:pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={active?"active":""}><Icon size={19}/><span>{labels[link.key]}</span></Link>; })}</nav>;
}
