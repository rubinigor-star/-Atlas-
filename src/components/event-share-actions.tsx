"use client";

import { Copy, Send, Share2 } from "lucide-react";
import { useState } from "react";

export function EventShareActions({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = `${title} — Atlas One`;
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

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="event-share-actions" aria-label="Share event">
      <button type="button" onClick={share} className="event-icon-button" aria-label="Share event"><Share2 size={18} /></button>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="event-icon-button" aria-label="Share on WhatsApp"><Send size={18} /></a>
      <button type="button" onClick={copy} className="event-share-copy"><Copy size={16} />{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}
