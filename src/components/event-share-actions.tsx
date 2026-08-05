"use client";

import { Send, Share2 } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/components/event-share-actions.module.css";

const copy = {
  ru: {
    group: "Поделиться мероприятием",
    share: "Поделиться",
    copied: "Ссылка скопирована",
    whatsapp: "Отправить в WhatsApp",
  },
  he: {
    group: "שיתוף האירוע",
    share: "שיתוף",
    copied: "הקישור הועתק",
    whatsapp: "שליחה ב-WhatsApp",
  },
  en: {
    group: "Share event",
    share: "Share",
    copied: "Link copied",
    whatsapp: "Send via WhatsApp",
  },
} as const;

export function EventShareActions({ title, url }: { title: string; url: string }) {
  const { locale } = useLocale();
  const text = copy[locale];
  const [copied, setCopied] = useState(false);
  const shareText = `${title} - Atlas One`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;

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
      <Share2 size={20}/>
    </button>
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className={styles.action}
      aria-label={text.whatsapp}
      data-tooltip={text.whatsapp}
    >
      <Send size={20}/>
    </a>
  </div>;
}
