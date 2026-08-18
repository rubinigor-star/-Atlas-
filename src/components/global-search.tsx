"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Baby, Drama, Guitar, Mic2, Search, Tag, X, Zap } from "lucide-react";
import { AtlasLogo } from "@/components/atlas-logo";
import { useLocale, type Locale } from "@/components/locale-provider";

type SearchEvent = {
  id: string;
  href: string;
  title: string;
  posterUrl: string;
  city: string;
  startsAt: string;
};

type SearchPayload = {
  featured: SearchEvent[];
  results: SearchEvent[];
};

type CategoryKey = "children" | "theatre" | "concerts" | "standup" | "clubs" | "deals";

const copy: Record<Locale, {
  placeholder: string;
  close: string;
  featured: string;
  popular: string;
  results: string;
  emptyFeatured: string;
  emptyResults: string;
  categories: Record<CategoryKey, string>;
}> = {
  ru: {
    placeholder: "Поиск мероприятия",
    close: "Закрыть",
    featured: "Популярные мероприятия",
    popular: "Популярные поиски",
    results: "Результаты поиска",
    emptyFeatured: "Популярные мероприятия скоро появятся.",
    emptyResults: "По вашему запросу ничего не найдено.",
    categories: {
      children: "Детские",
      theatre: "Театр",
      concerts: "Концерты",
      standup: "Stand-up",
      clubs: "Клубы и фестивали",
      deals: "Выгодные предложения",
    },
  },
  he: {
    placeholder: "חיפוש אירוע",
    close: "סגירה",
    featured: "אירועים פופולריים",
    popular: "חיפושים פופולריים",
    results: "תוצאות חיפוש",
    emptyFeatured: "אירועים פופולריים יופיעו כאן בקרוב.",
    emptyResults: "לא נמצאו אירועים מתאימים לחיפוש.",
    categories: {
      children: "ילדים",
      theatre: "תיאטרון",
      concerts: "הופעות",
      standup: "סטנדאפ",
      clubs: "מועדונים ופסטיבלים",
      deals: "מבצעים",
    },
  },
  en: {
    placeholder: "Search for an event",
    close: "Close",
    featured: "Popular events",
    popular: "Popular searches",
    results: "Search results",
    emptyFeatured: "Popular events will appear here soon.",
    emptyResults: "No events match your search.",
    categories: {
      children: "Kids",
      theatre: "Theatre",
      concerts: "Concerts",
      standup: "Stand-up",
      clubs: "Clubs & festivals",
      deals: "Deals",
    },
  },
};

const categories: Array<{ key: CategoryKey; Icon: typeof Baby }> = [
  { key: "children", Icon: Baby },
  { key: "theatre", Icon: Drama },
  { key: "concerts", Icon: Guitar },
  { key: "standup", Icon: Mic2 },
  { key: "clubs", Icon: Zap },
  { key: "deals", Icon: Tag },
];

function EventGrid({ events, onNavigate }: { events: SearchEvent[]; onNavigate: () => void }) {
  return <div className="atlas-search-event-grid" style={{ marginTop: 14, marginBottom: 12 }}>
    {events.map(event => <Link className="atlas-search-event-card" href={event.href} onClick={onNavigate} key={event.id}>
      <Image
        src={event.posterUrl}
        width={500}
        height={500}
        alt={event.title}
        className="atlas-search-event-image"
        sizes="(max-width: 680px) 29vw, 104px"
      />
      <strong>{event.title}</strong>
    </Link>)}
  </div>;
}

function SearchDialog({ present, open, onClose }: { present: boolean; open: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<SearchEvent[]>([]);
  const [results, setResults] = useState<SearchEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!present) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setQuery("");
    setResults([]);
    setLoading(true);

    const controller = new AbortController();
    fetch("/api/search", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<SearchPayload> : Promise.reject(new Error("Search request failed")))
      .then(payload => setFeatured(payload.featured))
      .catch(error => {
        if ((error as Error).name !== "AbortError") setFeatured([]);
      })
      .finally(() => setLoading(false));

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 110);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      controller.abort();
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [present, onClose]);

  useEffect(() => {
    if (!present || !open) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal })
        .then(response => response.ok ? response.json() as Promise<SearchPayload> : Promise.reject(new Error("Search request failed")))
        .then(payload => {
          setFeatured(payload.featured);
          setResults(payload.results);
        })
        .catch(error => {
          if ((error as Error).name !== "AbortError") setResults([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [present, open, query]);

  if (!present) return null;
  const searching = query.trim().length >= 2;
  const visibleEvents = searching ? results : featured;

  return <div
    className="atlas-search-overlay"
    data-state={open ? "open" : "closed"}
    role="dialog"
    aria-modal="true"
    aria-hidden={!open}
    aria-label={text.placeholder}
    onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="atlas-search-topbar">
      <AtlasLogo/>
      <label className="atlas-search-field">
        <Search size={22} strokeWidth={1.8} aria-hidden="true"/>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <button type="button" className="atlas-search-close" aria-label={text.close} onClick={onClose}>
        <span>{text.close}</span>
        <X size={23} strokeWidth={1.8} aria-hidden="true"/>
      </button>
    </div>

    <div className="atlas-search-panel">
      <section className="atlas-search-section">
        <h2>{searching ? text.results : text.featured}</h2>
        {visibleEvents.length ? <EventGrid events={visibleEvents} onNavigate={onClose}/> : <p className="atlas-search-empty">{loading ? "…" : searching ? text.emptyResults : text.emptyFeatured}</p>}
      </section>

      <section className="atlas-search-section atlas-search-popular">
        <h2>{text.popular}</h2>
        <div className="atlas-search-category-grid">
          {categories.map(({ key, Icon }) => <Link href={`/?category=${key}#events`} className="atlas-search-category" onClick={onClose} key={key}>
            <span><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span>
            <strong>{text.categories[key]}</strong>
          </Link>)}
        </div>
      </section>
    </div>
  </div>;
}

export function GlobalSearch() {
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const openSearch = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPresent(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setOpen(true));
    });
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPresent(false);
      closeTimerRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    const interceptSearchButton = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".atlas-header-actions > button.atlas-header-icon-button:not(.atlas-mobile-menu-button)");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      openSearch();
    };

    document.addEventListener("click", interceptSearchButton, true);
    return () => document.removeEventListener("click", interceptSearchButton, true);
  }, [openSearch]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  return mounted ? createPortal(<SearchDialog present={present} open={open} onClose={closeSearch}/>, document.body) : null;
}
