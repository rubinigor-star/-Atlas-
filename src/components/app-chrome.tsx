"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GlobalSearch } from "@/components/global-search";
import { PublicSoldOutDecorator } from "@/components/public-sold-out-decorator";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const office = pathname.startsWith("/office") || pathname.startsWith("/admin") || pathname.startsWith("/platform") || pathname.startsWith("/scanner");
  const home = pathname === "/";
  const eventPage = pathname.startsWith("/events/");
  const immersiveHeader = home || eventPage;

  useEffect(() => {
    const body = document.body;

    const syncHeaderState = () => {
      body.classList.toggle("atlas-header-home", home);
      body.classList.toggle("atlas-header-event", eventPage);
      body.classList.toggle("atlas-header-scrolled", immersiveHeader && window.scrollY > 2);
    };

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncHeaderState);
      body.classList.remove("atlas-header-home", "atlas-header-event", "atlas-header-scrolled");
    };
  }, [eventPage, home, immersiveHeader]);

  useEffect(() => {
    if (office) return;

    const openOfficeWithFullNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== "/office") return;

      event.preventDefault();
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener("click", openOfficeWithFullNavigation, true);
    return () => document.removeEventListener("click", openOfficeWithFullNavigation, true);
  }, [office]);

  return <>
    {!office && <SiteHeader/>}
    {!office && <GlobalSearch/>}
    {!office && <PublicSoldOutDecorator/>}
    {!office && !immersiveHeader && <div className="atlas-header-spacer" aria-hidden="true"/>}
    {children}
    {!office && <SiteFooter/>}
  </>;
}
