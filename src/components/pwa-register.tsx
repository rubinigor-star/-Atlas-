"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const OFFICE_PATHS = ["/office", "/admin", "/scanner"];

export function PwaRegister() {
  const pathname = usePathname();
  const shouldUsePwa = OFFICE_PATHS.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (shouldUsePwa) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
      return;
    }

    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      await Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
          .map((registration) => registration.unregister()),
      );

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("atlas-office-")).map((key) => caches.delete(key)));
      }
    });
  }, [shouldUsePwa]);

  return null;
}
