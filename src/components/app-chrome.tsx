"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GlobalSearch } from "@/components/global-search";

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

  return <>
    {!office && <SiteHeader/>}
    {!office && <GlobalSearch/>}
    {!office && !immersiveHeader && <div className="atlas-header-spacer" aria-hidden="true"/>}
    {children}
    {!office && <SiteFooter/>}
  </>;
}
