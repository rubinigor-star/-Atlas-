"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type LogoSurface = "dark" | "light" | "adaptive";

type AtlasLogoProps = {
  href?: string;
  surface?: LogoSurface;
  office?: boolean;
  dark?: boolean;
  className?: string;
};

export function AtlasLogo({
  href = "/",
  surface,
  office = false,
  dark = false,
  className = "",
}: AtlasLogoProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const explicitSurface: LogoSurface | null = surface ?? (dark || office ? "dark" : null);
  const [renderedSurface, setRenderedSurface] = useState<"dark" | "light">(
    explicitSurface === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    if (explicitSurface === "dark" || explicitSurface === "light") {
      setRenderedSurface(explicitSurface);
      return;
    }

    const syncSurface = () => {
      const element = anchorRef.current;
      if (!element) return;

      if (element.closest(".atlas-mobile-drawer")) {
        setRenderedSurface("light");
        return;
      }

      if (element.closest(".atlas-site-header")) {
        const body = document.body;
        const immersive = body.classList.contains("atlas-header-home") || body.classList.contains("atlas-header-event");
        const scrolled = body.classList.contains("atlas-header-scrolled");
        setRenderedSurface(immersive && !scrolled ? "dark" : "light");
        return;
      }

      setRenderedSurface("light");
    };

    syncSurface();

    const observer = new MutationObserver(syncSurface);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("scroll", syncSurface, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncSurface);
    };
  }, [explicitSurface]);

  const classes = [
    "atlas-brand-logo",
    `atlas-brand-logo--${renderedSurface}`,
    office ? "atlas-brand-logo--office" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const imageSrc = renderedSurface === "dark"
    ? "/brand/atlas-logo-dark.svg"
    : "/brand/atlas-logo-light-exact.svg";

  return (
    <Link ref={anchorRef} href={href} className={classes} aria-label="Atlas One - главная">
      <span className="atlas-brand-logo__mark" aria-hidden="true">
        <img
          className="atlas-brand-logo__image"
          src={imageSrc}
          width="270"
          height="80"
          alt=""
        />
      </span>
      {office && <small>OFFICE</small>}
    </Link>
  );
}
