"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GlobalSearch } from "@/components/global-search";
import { PublicSoldOutDecorator } from "@/components/public-sold-out-decorator";
import { PersistentCartExperience } from "@/components/persistent-cart-experience";
import { CartReminderCard } from "@/components/cart-reminder-card";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const office = pathname.startsWith("/office") || pathname.startsWith("/admin") || pathname.startsWith("/platform") || pathname.startsWith("/scanner");
  const customerAuth = pathname === "/account/login";
  const standaloneAuth = office || customerAuth;
  const seatSelectionPage = /^\/events\/[^/]+\/seats(?:\/|$)/.test(pathname);
  const home = pathname === "/";
  const eventPage = pathname.startsWith("/events/") && !seatSelectionPage;
  const immersiveHeader = home || eventPage;
  const showPublicHeader = !standaloneAuth;
  const showPublicFooter = !standaloneAuth && !seatSelectionPage;

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
    {showPublicHeader && <SiteHeader/>}
    {showPublicHeader && <PersistentCartExperience/>}
    {showPublicHeader && <CartReminderCard/>}
    {showPublicHeader && <GlobalSearch/>}
    {showPublicHeader && <PublicSoldOutDecorator/>}
    {showPublicHeader && !immersiveHeader && <div className="atlas-header-spacer" aria-hidden="true"/>}
    {children}
    {showPublicFooter && <SiteFooter/>}
  </>;
}
