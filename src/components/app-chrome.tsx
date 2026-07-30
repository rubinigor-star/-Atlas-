"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const office = pathname.startsWith("/office") || pathname.startsWith("/admin") || pathname.startsWith("/scanner");
  const home = pathname === "/";

  useEffect(() => {
    const body = document.body;

    const syncHeaderState = () => {
      body.classList.toggle("atlas-header-home", home);
      body.classList.toggle("atlas-header-scrolled", home && window.scrollY > 8);
    };

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncHeaderState);
      body.classList.remove("atlas-header-home", "atlas-header-scrolled");
    };
  }, [home]);

  return <>{!office && <SiteHeader />}{children}{!office && <SiteFooter />}</>;
}
