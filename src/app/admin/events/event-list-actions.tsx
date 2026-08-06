"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Pause, Pencil, Play, ShoppingBag, RotateCcw, Ticket } from "lucide-react";

type EventListActionsProps = {
  event: {
    id: string;
    title: string;
    slug: string;
    status: string;
    soldOut: boolean;
    lastTickets: boolean;
    startsAt: string;
    salesStart: string;
    salesEnd: string;
    doorsOpenAt: string;
    venueName: string;
    city: string;
    address: string;
  };
  canManage: boolean;
};

const labels = {
  ru: { edit: "Редактировать", pause: "Приостановить", paused: "Приостановлено", publish: "Опубликовать", soldOut: "SOLD OUT", available: "Вернуть в продажу", lastTickets: "Последние билеты", copy: "Копировать", page: "Страница события", working: "Выполняется...", copySuffix: "копия" },
  he: { edit: "עריכה", pause: "השהיה", paused: "מושהה", publish: "פרסום", soldOut: "SOLD OUT", available: "החזרה למכירה", lastTickets: "כרטיסים אחרונים", copy: "שכפול", page: "עמוד האירוע", working: "מתבצע...", copySuffix: "עותק" },
  en: { edit: "Edit", pause: "Pause", paused: "Paused", publish: "Publish", soldOut: "SOLD OUT", available: "Return to sale", lastTickets: "Last tickets", copy: "Duplicate", page: "Event page", working: "Working...", copySuffix: "copy" },
} as const;

function currentLocale() {
  if (typeof document === "undefined") return "ru" as const;
  const value = document.documentElement.lang.slice(0, 2);
  return value === "he" || value === "en" ? value : "ru";
}

export function EventListActions({ event, canManage }: EventListActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const locale = currentLocale();
  const t = labels[locale];
  const published = event.status === "PUBLISHED";
  const paused = event.status === "DRAFT";

  const uniqueClone = useMemo(() => {
    const suffix = Date.now().toString(36);
    return {
      title: `${event.title} (${t.copySuffix})`,
      slug: `${event.slug}-copy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
    };
  }, [event.slug, event.title, t.copySuffix]);

  async function runListAction(action: "pause" | "publish" | "soldOut" | "available" | "lastTickets" | "clearLastTickets") {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(`/api/admin/events/${event.id}/list-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Action failed");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function duplicateEvent() {
    setBusy("copy");
    setError("");
    try {
      const response = await fetch("/api/admin/events/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEventId: event.id,
          title: uniqueClone.title,
          slug: uniqueClone.slug,
          startsAt: event.startsAt,
          doorsOpenAt: event.doorsOpenAt,
          salesStart: event.salesStart,
          salesEnd: event.salesEnd,
          venueName: event.venueName,
          city: event.city,
          address: event.address,
          copyGuestLists: true,
          copyPromoters: true,
          copyPromoCodes: true,
          copyReferralLinks: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Copy failed");
      router.push(`/office/events/${payload.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Copy failed");
      setBusy(null);
    }
  }

  return (
    <div className="event-card-controls">
      <div className="event-card-control-grid">
        <Link className="event-card-control" href={`/office/events/${event.id}`}>
          <Pencil size={17} aria-hidden="true" />
          <span>{t.edit}</span>
        </Link>

        {canManage && (
          <button
            className={`event-card-control${paused ? " is-paused" : ""}`}
            type="button"
            aria-pressed={paused}
            disabled={Boolean(busy)}
            onClick={() => runListAction(published ? "pause" : "publish")}
          >
            {published ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
            <span>{busy === "pause" || busy === "publish" ? t.working : paused ? t.paused : published ? t.pause : t.publish}</span>
          </button>
        )}

        {canManage && (
          <button
            className={`event-card-control${event.lastTickets ? " is-last-tickets" : ""}`}
            type="button"
            aria-pressed={event.lastTickets}
            disabled={Boolean(busy)}
            onClick={() => runListAction(event.lastTickets ? "clearLastTickets" : "lastTickets")}
          >
            <Ticket size={17} aria-hidden="true" />
            <span>{busy === "lastTickets" || busy === "clearLastTickets" ? t.working : t.lastTickets}</span>
          </button>
        )}

        {canManage && (
          <button
            className={`event-card-control${event.soldOut ? " is-sold-out" : ""}`}
            type="button"
            aria-pressed={event.soldOut}
            disabled={Boolean(busy)}
            onClick={() => runListAction(event.soldOut ? "available" : "soldOut")}
          >
            {event.soldOut ? <RotateCcw size={17} aria-hidden="true" /> : <ShoppingBag size={17} aria-hidden="true" />}
            <span>{busy === "soldOut" || busy === "available" ? t.working : t.soldOut}</span>
          </button>
        )}

        <Link className={`event-card-control event-card-control-wide${published ? "" : " is-disabled"}`} aria-disabled={!published} tabIndex={published ? 0 : -1} href={published ? `/events/${event.slug}` : "#"} target={published ? "_blank" : undefined}>
          <ExternalLink size={17} aria-hidden="true" />
          <span>{t.page}</span>
        </Link>

        {canManage && (
          <button className="event-card-control event-card-control-wide" type="button" disabled={Boolean(busy)} onClick={duplicateEvent}>
            <Copy size={17} aria-hidden="true" />
            <span>{busy === "copy" ? t.working : t.copy}</span>
          </button>
        )}
      </div>
      {error && <p className="event-card-action-error" role="alert">{error}</p>}
    </div>
  );
}
