"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import styles from "@/app/events/[slug]/event-mobile-video.module.css";

type Props = {
  title: string;
  videoUrl?: string;
  posterUrl: string;
};

type VideoData = {
  embedUrl?: string;
  previewUrl: string;
  fallbackUrl?: string;
  directVideo: boolean;
};

function youtubeData(id: string): VideoData {
  return {
    embedUrl: `https://www.youtube.com/embed/${id}`,
    previewUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    fallbackUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    directVideo: false,
  };
}

function parseVideo(url: string | undefined, posterUrl: string): VideoData | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? youtubeData(id) : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parsed.searchParams.get("v") || (parts[0] === "shorts" || parts[0] === "embed" ? parts[1] : parts.at(-1));
      return id ? youtubeData(id) : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? {
        embedUrl: `https://player.vimeo.com/video/${id}`,
        previewUrl: posterUrl,
        directVideo: false,
      } : null;
    }
    if (/\.(?:mp4|webm)$/i.test(parsed.pathname) || parsed.hostname.endsWith("blob.vercel-storage.com")) {
      return { previewUrl: posterUrl, directVideo: true };
    }
  } catch {}
  return null;
}

export function EventMobileVideo({ title, videoUrl, posterUrl }: Props) {
  const video = useMemo(() => parseVideo(videoUrl, posterUrl), [posterUrl, videoUrl]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!video || !videoUrl) return null;

  const modal = open ? <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
    <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Закрыть"><X size={27}/></button>
    <div className={styles.player} onClick={(event) => event.stopPropagation()}>
      {video.directVideo
        ? <video src={videoUrl} controls autoPlay playsInline preload="metadata"/>
        : <iframe src={`${video.embedUrl}?autoplay=1`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
    </div>
  </div> : null;

  return <>
    <div className={styles.root}>
      <button type="button" className={styles.preview} onClick={() => setOpen(true)} aria-label={`Воспроизвести видео: ${title}`}>
        <img
          src={video.previewUrl}
          alt=""
          onError={(event) => {
            if (video.fallbackUrl && event.currentTarget.src !== video.fallbackUrl) {
              event.currentTarget.src = video.fallbackUrl;
              return;
            }
            event.currentTarget.src = posterUrl;
          }}
        />
        <span className={styles.play}><Play fill="currentColor"/></span>
      </button>
    </div>
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
