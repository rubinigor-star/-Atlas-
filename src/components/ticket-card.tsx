/* eslint-disable @next/next/no-img-element -- organizer-provided assets */
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Ticket as TicketIcon, UserRound, WalletCards } from "lucide-react";
import { AtlasLogo } from "@/components/atlas-logo";
import type { TicketDesign } from "@/lib/ticket-template-types";
import { formatTicketDate, formatTicketTime, getTicketLocale } from "@/lib/ticket-language";
import type { Locale } from "@/lib/i18n";

export function TicketCard({
  ticket,
  qr,
  design,
  event,
  orderNumber,
  walletReady,
  communicationLocale,
}: {
  ticket: { id: string; publicCode: string; status: string; holderName: string; category: { name: string } };
  qr: string;
  design: TicketDesign;
  event: { title: string; startsAt: Date; venue: { name: string; address: string } };
  orderNumber: string;
  walletReady: boolean;
  communicationLocale: Locale;
}) {
  const locale = getTicketLocale(design as never,communicationLocale);
  const copy=locale==="he"?{logo:"לוגו המפיק",guest:"אורח",download:"הורדת PDF",add:"הוספה ל"}:locale==="en"?{logo:"Organizer logo",guest:"Guest",download:"Download PDF",add:"Add to"}:{logo:"Логотип организатора",guest:"Гость",download:"Скачать PDF",add:"Добавить в"};
  const date = formatTicketDate(event.startsAt, locale);
  const time = formatTicketTime(event.startsAt, locale);
  const dark = design.backgroundColor.toUpperCase() === "#081426";
  const foreground = dark ? "#ffffff" : "#0b1220";
  const secondary = dark ? "rgba(255,255,255,.72)" : "#64748b";
  const surface = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.82)";

  return (
    <article className="customer-ticket-wrap">
      <div
        dir={locale === "he" ? "rtl" : "ltr"}
        style={{
          width: "min(100%, 390px)",
          margin: "0 auto",
          borderRadius: 28,
          overflow: "hidden",
          color: foreground,
          backgroundColor: design.backgroundColor,
          backgroundImage: design.backgroundUrl
            ? `linear-gradient(${dark ? "#081426a8,#081426e0" : "#ffffffb8,#fffffff2"}),url(${design.backgroundUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 22px 60px rgba(7,23,46,.18)",
          border: dark ? "1px solid rgba(255,255,255,.12)" : "1px solid #e5e7eb",
        }}
      >
        <div style={{ padding: "24px 24px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {design.logoUrl ? (
            <img src={design.logoUrl} alt={copy.logo} style={{ maxWidth: 132, maxHeight: 58, objectFit: "contain" }} />
          ) : (
            <div style={{ width: 154 }}><AtlasLogo href="/" dark={dark} /></div>
          )}
          <span style={{ fontSize: 12, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase", color: secondary }}>
            E-ticket
          </span>
        </div>

        <div style={{ padding: "14px 24px 22px" }}>
          <div style={{ fontSize: "clamp(26px, 8vw, 38px)", lineHeight: 1.04, fontWeight: 900, letterSpacing: "-.035em", overflowWrap: "anywhere" }}>
            {event.title}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
            <Info icon={<CalendarDays size={18} />} label={date} surface={surface} />
            <Info icon={<Clock3 size={18} />} label={time} surface={surface} />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <Info icon={<MapPin size={18} />} label={`${event.venue.name}${event.venue.address ? ` · ${event.venue.address}` : ""}`} surface={surface} />
            <Info icon={<UserRound size={18} />} label={ticket.holderName || copy.guest} surface={surface} />
            <Info icon={<TicketIcon size={18} />} label={ticket.category.name} surface={surface} />
          </div>
        </div>

        <div style={{ background: "#fff", color: "#0b1220", padding: "24px", display: "grid", justifyItems: "center" }}>
          <Image src={qr} alt="Ticket QR code" width={250} height={250} unoptimized style={{ width: "min(72vw,250px)", height: "auto" }} />
          <div style={{ marginTop: 14, fontSize: 13, fontWeight: 850, letterSpacing: ".03em", textAlign: "center", overflowWrap: "anywhere" }}>
            {orderNumber}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", textAlign: "center", overflowWrap: "anywhere" }}>
            {ticket.publicCode}
          </div>
        </div>
      </div>

      <div className="ticket-delivery-actions">
        <Link className="btn secondary" href={`/api/tickets/${ticket.id}/pdf`}>{copy.download}</Link>
        {walletReady ? (
          <Link className="apple-wallet-button" href={`/api/wallet/tickets/${ticket.id}`}>
            <WalletCards size={20} />
            <span><small>{copy.add}</small>Apple Wallet</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Info({ icon, label, surface }: { icon: React.ReactNode; label: string; surface: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 14, background: surface, minWidth: 0 }}>
      <span style={{ flex: "0 0 auto", opacity: .82 }}>{icon}</span>
      <span style={{ minWidth: 0, fontSize: 14, fontWeight: 750, lineHeight: 1.3, overflowWrap: "anywhere" }}>{label}</span>
    </div>
  );
}
