"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Grid3X3, Play, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "@/app/events/[slug]/event-detail.module.css";
import mobile from "@/app/events/[slug]/event-mobile.module.css";
import fixes from "@/app/events/[slug]/event-gallery-fixes.module.css";
import behavior from "@/app/events/[slug]/event-gallery-behavior.module.css";

type GalleryItem = {
  id: string;
  type: "video" | "image";
  kind: "poster" | "gallery" | "video";
  previewUrl: string;
  sourceUrl: string;
  embedUrl?: string;
  directVideo?: boolean;
};

type Props = {
  title: string;
  posterUrl: string;
  videoUrl?: string;
  galleryUrls: string[];
};

const labels = {
  ru: { viewAll: "Смотреть все", previous: "Назад", next: "Вперёд", close: "Закрыть", play: "Воспроизвести видео" },
  he: { viewAll: "לכל התמונות", previous: "הקודם", next: "הבא", close: "סגירה", play: "הפעלת הווידאו" },
  en: { viewAll: "View all", previous: "Previous", next: "Next", close: "Close", play: "Play video" },
} as const;

type VideoData = {
  embedUrl?: string;
  thumbnailUrl: string | null;
  directVideo: boolean;
};

function videoData(url?: string): VideoData | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? { embedUrl: `https://www.youtube.com/embed/${id}`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, directVideo: false } : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parsed.searchParams.get("v") || (parts[0] === "shorts" || parts[0] === "embed" ? parts[1] : parts.at(-1));
      return id ? { embedUrl: `https://www.youtube.com/embed/${id}`, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, directVideo: false } : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? { embedUrl: `https://player.vimeo.com/video/${id}`, thumbnailUrl: null, directVideo: false } : null;
    }
    if (/\.(?:mp4|webm)$/i.test(parsed.pathname) || parsed.hostname.endsWith("blob.vercel-storage.com")) {
      return { thumbnailUrl: null, directVideo: true };
    }
  } catch {}
  return null;
}

export function EventHeroGallery({ title, posterUrl, videoUrl, galleryUrls }: Props) {
  const { locale } = useLocale();
  const text = labels[locale];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const items = useMemo(() => {
    const uniqueImages = galleryUrls
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url, index, all) => all.indexOf(url) === index);
    const video = videoData(videoUrl);
    const next: GalleryItem[] = [];

    if (video && videoUrl) {
      next.push({
        id: "hero-video",
        type: "video",
        kind: "video",
        previewUrl: video.thumbnailUrl || posterUrl,
        sourceUrl: videoUrl,
        embedUrl: video.embedUrl,
        directVideo: video.directVideo,
      });
    }

    next.push({
      id: "hero-poster",
      type: "image",
      kind: "poster",
      previewUrl: posterUrl,
      sourceUrl: posterUrl,
    });

    for (const [index, url] of uniqueImages.entries()) {
      if (url === posterUrl) continue;
      next.push({
        id: `gallery-${index}`,
        type: "image",
        kind: "gallery",
        previewUrl: url,
        sourceUrl: url,
      });
    }

    return next;
  }, [galleryUrls, posterUrl, videoUrl]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2 || lightboxOpen) return;

    const mobileQuery = window.matchMedia("(max-width: 800px)");
    let intervalId: number | undefined;

    const stop = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const start = () => {
      stop();
      if (!mobileQuery.matches) return;
      intervalId = window.setInterval(() => {
        setActiveIndex((current) => (current + 1) % items.length);
      }, 2000);
    };

    const handleViewportChange = () => start();
    start();
    mobileQuery.addEventListener?.("change", handleViewportChange);

    return () => {
      stop();
      mobileQuery.removeEventListener?.("change", handleViewportChange);
    };
  }, [items.length, lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft" && items.length > 1) setActiveIndex((current) => (current - 1 + items.length) % items.length);
      if (event.key === "ArrowRight" && items.length > 1) setActiveIndex((current) => (current + 1) % items.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [items.length, lightboxOpen]);

  function previous() {
    if (items.length < 2) return;
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  function next() {
    if (items.length < 2) return;
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function open(index: number) {
    setActiveIndex(index);
    setLightboxOpen(true);
  }

  function preview(item: GalleryItem, index: number, className: string, viewAll = false) {
    const mediaClass = item.kind === "poster" ? behavior.posterPreview : behavior.galleryPreview;
    return <button
      type="button"
      className={`${className} ${mediaClass}`}
      onClick={() => open(index)}
      aria-label={item.type === "video" ? text.play : `${title} ${index + 1}`}
    >
      <img src={item.previewUrl} alt=""/>
      {item.type === "video" && <span className={styles.playButton}><Play size={26} fill="currentColor"/></span>}
      {viewAll && <span className={styles.viewAll}><Grid3X3 size={22}/>{text.viewAll}</span>}
    </button>;
  }

  const active = items[activeIndex] || items[0];
  const activeIsPoster = active?.kind === "poster";
  const sideItems = items.slice(1, 3);
  const desktopClass = items.length === 1
    ? `${styles.desktopGallery} ${styles.desktopSingle} ${fixes.desktopGallery} ${fixes.desktopSingle} ${behavior.desktopGallery} ${behavior.single}`
    : items.length === 2
      ? `${styles.desktopGallery} ${styles.desktopPair} ${fixes.desktopGallery} ${fixes.desktopPair} ${behavior.desktopGallery} ${behavior.pair}`
      : `${styles.desktopGallery} ${fixes.desktopGallery} ${behavior.desktopGallery}`;

  const lightbox = lightboxOpen && active ? <div
    className={`${styles.lightbox} ${fixes.lightbox}`}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onClick={() => setLightboxOpen(false)}
  >
    <button type="button" className={`${styles.lightboxClose} ${fixes.close}`} onClick={() => setLightboxOpen(false)} aria-label={text.close}><X size={27}/></button>
    {items.length > 1 && <>
      <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxArrowLeft} ${fixes.arrow}`} onClick={(event) => { event.stopPropagation(); previous(); }} aria-label={text.previous}><ChevronLeft/></button>
      <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxArrowRight} ${fixes.arrow}`} onClick={(event) => { event.stopPropagation(); next(); }} aria-label={text.next}><ChevronRight/></button>
    </>}
    <div className={`${styles.lightboxContent} ${fixes.content}`} onClick={(event) => event.stopPropagation()}>
      {active.type === "video" && active.directVideo
        ? <video
            key={`${active.id}-${activeIndex}`}
            src={active.sourceUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        : active.type === "video" && active.embedUrl
          ? <iframe key={`${active.id}-${activeIndex}`} src={`${active.embedUrl}?autoplay=1`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>
          : <img key={`${active.id}-${activeIndex}`} src={active.sourceUrl} alt={`${title} ${activeIndex + 1}`}/>} 
    </div>
  </div> : null;

  return <>
    <div className={`${styles.galleryRoot} ${mobile.galleryRoot} ${fixes.desktopRoot} ${behavior.root}`}>
      <div className={desktopClass}>
        {preview(items[0], 0, styles.desktopMain)}
        {sideItems.length > 0 && <div className={styles.desktopSide}>
          {sideItems.map((item, sideIndex) => preview(
            item,
            sideIndex + 1,
            styles.desktopSideItem,
            items.length > 2 && sideIndex === sideItems.length - 1,
          ))}
        </div>}
      </div>

      <div className={`${styles.mobileGallery} ${mobile.mobileGallery} ${behavior.mobileGallery}`}>
        {items.length > 1 && <div className={`${styles.mobileProgress} ${mobile.mobileProgress} ${behavior.progress}`} aria-hidden="true">
          {items.map((item, index) => <span key={item.id} className={`${styles.progressTrack} ${behavior.progressTrack}`}>
            <i
              key={`${activeIndex}-${index}`}
              className={`${styles.progressFill} ${behavior.progressFill} ${index < activeIndex ? `${styles.progressComplete} ${behavior.progressComplete}` : ""} ${index === activeIndex ? `${styles.progressActive} ${behavior.progressActive}` : ""}`}
            />
          </span>)}
        </div>}
        <button
          type="button"
          className={`${styles.mobileMedia} ${mobile.mobileMedia} ${fixes.mobileMedia} ${behavior.mobileMedia} ${activeIsPoster ? `${fixes.mobilePosterFrame} ${behavior.posterFrame}` : `${fixes.mobileGalleryFrame} ${behavior.galleryFrame}`}`}
          onClick={() => open(activeIndex)}
          aria-label={active.type === "video" ? text.play : `${title} ${activeIndex + 1}`}
        >
          <img key={`backdrop-${active.id}`} src={active.previewUrl} alt="" aria-hidden="true" className={`${mobile.mobileBackdrop} ${fixes.mobileBackdrop} ${behavior.backdrop}`}/>
          <img
            key={active.id}
            src={active.previewUrl}
            alt=""
            className={`${styles.mobileFade} ${mobile.mobilePoster} ${fixes.mobilePoster} ${behavior.artwork} ${activeIsPoster ? `${fixes.mobileSquareArtwork} ${behavior.squareArtwork}` : `${fixes.mobileFullArtwork} ${behavior.fullArtwork}`}`}
          />
          {active.type === "video" && <span className={styles.playButton}><Play size={25} fill="currentColor"/></span>}
        </button>
        {items.length > 1 && <>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowLeft} ${behavior.carouselArrow}`} onClick={(event) => { event.stopPropagation(); previous(); }} aria-label={text.previous}><ChevronLeft/></button>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowRight} ${behavior.carouselArrow}`} onClick={(event) => { event.stopPropagation(); next(); }} aria-label={text.next}><ChevronRight/></button>
        </>}
      </div>
    </div>

    {mounted && lightbox ? createPortal(lightbox, document.body) : null}
  </>;
}
