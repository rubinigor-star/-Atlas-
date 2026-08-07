"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Locale = "ru" | "he" | "en";
type StatusOption = { value: string; label: string; href: string };

type EventStatusFilterProps = {
  locale: Locale;
  label: string;
  clearLabel: string;
  current: string;
  options: StatusOption[];
};

export function EventStatusFilter({ locale, label, clearLabel, current, options }: EventStatusFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rtl = locale === "he";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const allOption = options.find((option) => option.value === "all");

  return (
    <div className="event-status-filter" data-dir={rtl ? "rtl" : "ltr"} ref={rootRef}>
      <button
        type="button"
        className="event-status-filter-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="event-status-filter-menu" role="menu" aria-label={label}>
          <div className="event-status-filter-menu-head">
            <strong>{label}</strong>
            {current !== "all" && allOption && (
              <Link prefetch={false} href={allOption.href} onClick={() => setOpen(false)}>{clearLabel}</Link>
            )}
          </div>
          <div className="event-status-filter-options">
            {options.map((option) => {
              const selected = current === option.value;
              return (
                <Link
                  prefetch={false}
                  key={option.value}
                  href={option.href}
                  role="menuitemradio"
                  aria-checked={selected}
                  className="event-status-filter-option"
                  data-selected={selected ? "true" : "false"}
                  onClick={() => setOpen(false)}
                >
                  <span className="event-status-filter-radio" aria-hidden="true"><i /></span>
                  <span>{option.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
