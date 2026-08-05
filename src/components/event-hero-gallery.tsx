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
  previewFallbackUrl?: string;
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
  thumbnailFallbackUrl?: string;
  directVideo: boolean;
};

function youtubeVideoData(id: string): VideoData {
  return {
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    thumbnailFallbackUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    directVideo: false,
  };
}

function videoData(url?: string): VideoData | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? youtubeVideoData(id) : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parsed.searchParams.get("v") || (parts[0] === "shorts" || parts[0] === "embed" ? parts[1] : parts.at(-1));
      return id ? youtubeVideoData(id) : null;
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

function applyPreviewFallback(event: React.SyntheticEvent<HTMLImageElement>, item: GalleryItem) {
  if (!item.previewFallbackUrl) return;
  if (event.currentTarget.src === item.previewFallbackUrl) return;
  event.currentTarget.src = item.previewFallbackUrl;
}

export function EventHeroGallery({ title, posterUrl, videoUrl, galleryUrls }: Props) {
  const { locale } = useLocale();
  const text = labels[locale];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);

  const { desktopItems, mobileItems } = useMemo(() => {
    const uniqueImages = galleryUrls
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url, index, all) => all.indexOf(url) === index && url !== posterUrl);

    const poster: GalleryItem = {
      id: "hero-poster",
      type: "image",
      kind: "poster",
      previewUrl: posterUrl,
      sourceUrl: posterUrl,
    };

    const gallery: GalleryItem[] = uniqueImages.map((url, index) => ({
      id: `gallery-${index}`,
      type: "image",
      kind: "gallery",
      previewUrl: url,
      sourceUrl: url,
    }));

    const video = videoData(videoUrl);
    if (video && videoUrl) {
      const videoItem: GalleryItem = {
        id: "hero-video",
        type: "video",
        kind: "video",
        previewUrl: video.thumbnailUrl || posterUrl,
        previewFallbackUrl: video.thumbnailFallbackUrl,
        sourceUrl: videoUrl,
        embedUrl: video.embedUrl,
        directVideo: video.directVideo,
      };

      return {
        desktopItems: [videoItem, ...gallery],
        mobileItems: [videoItem, ...gallery, poster],
      };
    }

    return {
      desktopItems: [poster, ...gallery],
      mobileItems: [poster, ...gallery],
    };
  }, [galleryUrls, posterUrl, videoUrl]);

  const items = mobileViewport ? mobileItems : desktopItems;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const sync = () => setMobileViewport(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (!mobileViewport || mobileItems.length < 2 || lightboxOpen) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % mobileItems.length);
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [lightboxOpen, mobileItems.length, mobileViewport]);

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
      <img src={item.previewUrl} alt="" onError={(event) => applyPreviewFallback(event, item)}/>
      {item.type === "video" && <span className={behavior.playButton}><Play fill="currentColor"/></span>}
      {viewAll && <span className={styles.viewAll}><Grid3X3 size={22}/>{text.viewAll}</span>}
    </button>;
  }

  const active = items[activeIndex] || items[0];
  const activeIsPoster = active?.kind === "poster";
  const desktopHasVideo = desktopItems[0]?.kind === "video";
  const sideItems = desktopItems.slice(1, 3);
  const desktopClass = desktopItems.length === 1
    ? `${styles.desktopGallery} ${styles.desktopSingle} ${fixes.desktopGallery} ${fixes.desktopSingle} ${behavior.desktopGallery} ${behavior.single} ${desktopHasVideo ? `${behavior.videoDesktopGallery} ${behavior.videoSingle}` : ""}`
    : desktopItems.length === 2
      ? `${styles.desktopGallery} ${styles.desktopPair} ${fixes.desktopGallery} ${fixes.desktopPair} ${behavior.desktopGallery} ${behavior.pair} ${desktopHasVideo ? `${behavior.videoDesktopGallery} ${behavior.videoPair}` : ""}`
      : `${styles.desktopGallery} ${fixes.desktopGallery} ${behavior.desktopGallery} ${desktopHasVideo ? behavior.videoDesktopGallery : ""}`;

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
    <div className={`${styles.galleryRoot} ${mobile.galleryRoot} ${fixes.desktopRoot} ${behavior.root} ${desktopHasVideo ? behavior.videoRoot : ""}`}>
      <div className={desktopClass}>
        {preview(desktopItems[0], 0, `${styles.desktopMain} ${desktopHasVideo ? behavior.videoMainPreview : ""}`)}
        {sideItems.length > 0 && <div className={styles.desktopSide}>
          {sideItems.map((item, sideIndex) => preview(
            item,
            sideIndex + 1,
            styles.desktopSideItem,
            desktopItems.length > 2 && sideIndex === sideItems.length - 1,
          ))}
        </div>}
      </div>

      <div className={`${styles.mobileGallery} ${mobile.mobileGallery} ${behavior.mobileGallery}`}>
        {mobileItems.length > 1 && <div className={`${styles.mobileProgress} ${mobile.mobileProgress} ${behavior.progress}`} aria-hidden="true">
          {mobileItems.map((item, index) => <span key={item.id} className={`${styles.progressTrack} ${behavior.progressTrack}`}>
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
          <img key={`backdrop-${active.id}`} src={active.previewUrl} alt="" aria-hidden="true" className={`${mobile.mobileBackdrop} ${fixes.mobileBackdrop} ${behavior.backdrop}`} onError={(event) => applyPreviewFallback(event, active)}/>
          <img
            key={active.id}
            src={active.previewUrl}
            alt=""
            className={`${styles.mobileFade} ${mobile.mobilePoster} ${fixes.mobilePoster} ${behavior.artwork} ${activeIsPoster ? `${fixes.mobileSquareArtwork} ${behavior.squareArtwork}` : `${fixes.mobileFullArtwork} ${behavior.fullArtwork}`}`}
            onError={(event) => applyPreviewFallback(event, active)}
          />
          {active.type === "video" && <span className={behavior.playButton}><Play fill="currentColor"/></span>}
        </button>
        {mobileItems.length > 1 && <>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowLeft} ${behavior.carouselArrow}`} onClick={(event) => { event.stopPropagation(); previous(); }} aria-label={text.previous}><ChevronLeft/></button>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselArrowRight} ${behavior.carouselArrow}`} onClick={(event) => { event.stopPropagation(); next(); }} aria-label={text.next}><ChevronRight/></button>
        </>}
      </div>
    </div>

    {mounted && lightbox ? createPortal(lightbox, document.body) : null}
  </>;
}
