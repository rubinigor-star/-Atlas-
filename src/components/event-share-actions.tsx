"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-share-actions.module.css";

const copy = {
  ru: {
    group: "Поделиться мероприятием",
    share: "Поделиться мероприятием",
    copied: "Ссылка скопирована",
  },
  he: {
    group: "שיתוף האירוע",
    share: "שיתוף האירוע",
    copied: "הקישור הועתק",
  },
  en: {
    group: "Share event",
    share: "Share event",
    copied: "Link copied",
  },
} as const;

export function EventShareActions({ title, url }: { title: string; url: string }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [copied, setCopied] = useState(false);
  const shareText = `${title} - Atlas One`;

  async function share() {
    if (navigator.share) {
      await navigator.share({ title, text: shareText, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className={styles.actions} aria-label={text.group}>
    <button
      type="button"
      onClick={() => void share()}
      className={styles.action}
      aria-label={copied ? text.copied : text.share}
      data-tooltip={copied ? text.copied : text.share}
    >
      <Send size={21}/>
    </button>
  </div>;
}
