"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Grid3X3, Play, X } from "lucide-react";
import styles from "@/app/events/[slug]/event-detail.module.css";

type Slide = { type: "VIDEO" | "IMAGE"; url: string; preview: string; label: string };

const copy = {
  ru: { play: "Воспроизвести видео", viewAll: "Смотреть все", close: "Закрыть", previous: "Предыдущее", next: "Следующее" },
  he: { play: "הפעלת וידאו", viewAll: "הצגת הכול", close: "סגירה", previous: "הקודם", next: "הבא" },
  en: { play: "Play video", viewAll: "View all", close: "Close", previous: "Previous", next: "Next" },
} as const;

function videoPreview(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : fallback;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : fallback;
    }
  } catch {}
  return fallback;
}

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}?autoplay=1&rel=0`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {}
  return null;
}

export function EventHeroGallery({
  title,
  posterUrl,
  videoUrl,
  galleryUrls,
  locale,
}: {
  title: string;
  posterUrl: string;
  videoUrl?: string;
  galleryUrls: string[];
  locale: "ru" | "he" | "en";
}) {
  const text = copy[locale];
  const slides = useMemo<Slide[]>(() => {
    const result: Slide[] = [];
    if (videoUrl) result.push({ type: "VIDEO", url: videoUrl, preview: videoPreview(videoUrl, posterUrl), label: title });
    result.push({ type: "IMAGE", url: posterUrl, preview: posterUrl, label: title });
    for (const [index, url] of galleryUrls.entries()) {
      if (result.some((item) => item.type === "IMAGE" && item.url === url)) continue;
      result.push({ type: "IMAGE", url, preview: url, label: `${title} ${index + 2}` });
    }
    return result;
  }, [galleryUrls, posterUrl, title, videoUrl]);

  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const activeSlide = slides[active] ?? slides[0];
  const sideSlides = slides.filter((_, index) => index !== 0).slice(0, 2);

  function go(index: number) {
    setActive((index + slides.length) % slides.length);
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    if (!media.matches || fullscreen || slides.length < 2) return;
    const timer = window.setInterval(() => go(active + 1), 2000);
    return () => window.clearInterval(timer);
  }, [active, fullscreen, slides.length]);

  useEffect(() => {
    if (!fullscreen || activeSlide?.type !== "IMAGE" || slides.length < 2) return;
    const timer = window.setInterval(() => go(active + 1), 2000);
    return () => window.clearInterval(timer);
  }, [active, activeSlide?.type, fullscreen, slides.length]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
      if (event.key === "ArrowLeft") go(active - 1);
      if (event.key === "ArrowRight") go(active + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [active, fullscreen, slides.length]);

  function open(index: number) {
    setActive(index);
    setFullscreen(true);
  }

  return <>
    <div className={styles.mediaDesktop} data-side-count={sideSlides.length}>
      <button type="button" className={styles.mediaMain} onClick={() => open(0)} aria-label={slides[0]?.type === "VIDEO" ? text.play : text.viewAll}>
        <img src={slides[0]?.preview ?? posterUrl} alt={title}/>
        {slides[0]?.type === "VIDEO" && <span className={styles.playButton}><Play fill="currentColor" size={28}/></span>}
      </button>
      {sideSlides.length > 0 && <div className={styles.mediaSide}>
        {sideSlides.map((slide, index) => {
          const slideIndex = slides.indexOf(slide);
          const last = index === sideSlides.length - 1;
          return <button type="button" className={styles.mediaSideItem} onClick={() => open(slideIndex)} key={`${slide.type}-${slide.url.slice(0, 70)}`}>
            <img src={slide.preview} alt={slide.label}/>
            {slide.type === "VIDEO" && <span className={styles.smallPlay}><Play fill="currentColor" size={18}/></span>}
            {last && slides.length > 2 && <span className={styles.viewAll}><Grid3X3 size={20}/>{text.viewAll}</span>}
          </button>;
        })}
      </div>}
    </div>

    <div className={styles.mediaMobile}>
      <div className={styles.progressBars} aria-hidden="true">
        {slides.map((_, index) => <button type="button" key={index} className={index === active ? styles.progressActive : ""} onClick={() => go(index)}/>) }
      </div>
      <button type="button" className={styles.mobileSlide} onClick={() => open(active)} aria-label={activeSlide?.type === "VIDEO" ? text.play : text.viewAll}>
        <img key={`${active}-${activeSlide?.preview}`} className={styles.fadeImage} src={activeSlide?.preview ?? posterUrl} alt={activeSlide?.label ?? title}/>
        {activeSlide?.type === "VIDEO" && <span className={styles.playButton}><Play fill="currentColor" size={27}/></span>}
      </button>
      {slides.length > 1 && <>
        <button type="button" className={`${styles.carouselArrow} ${styles.carouselPrevious}`} aria-label={text.previous} onClick={() => go(active - 1)}><ChevronLeft/></button>
        <button type="button" className={`${styles.carouselArrow} ${styles.carouselNext}`} aria-label={text.next} onClick={() => go(active + 1)}><ChevronRight/></button>
      </>}
    </div>

    {fullscreen && activeSlide && <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.lightboxClose} aria-label={text.close} onClick={() => setFullscreen(false)}><X/></button>
      {slides.length > 1 && <>
        <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxPrevious}`} aria-label={text.previous} onClick={() => go(active - 1)}><ChevronLeft/></button>
        <button type="button" className={`${styles.lightboxArrow} ${styles.lightboxNext}`} aria-label={text.next} onClick={() => go(active + 1)}><ChevronRight/></button>
      </>}
      <div className={styles.lightboxContent}>
        {activeSlide.type === "VIDEO" && embedUrl(activeSlide.url)
          ? <iframe key={activeSlide.url} src={embedUrl(activeSlide.url) ?? ""} title={title} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen/>
          : <img key={`${active}-${activeSlide.url}`} className={styles.fadeImage} src={activeSlide.url} alt={activeSlide.label}/>} 
      </div>
      <div className={styles.lightboxIndicators}>{slides.map((_, index) => <button type="button" key={index} data-active={index === active ? "true" : "false"} onClick={() => go(index)}/>)}</div>
    </div>}
  </>;
}