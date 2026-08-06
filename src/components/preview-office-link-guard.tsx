"use client";

import { useEffect } from "react";

const PREVIEW_OFFICE_LOGIN = "https://atlas-git-preview-atlasteam1.vercel.app/office/login?next=%2Foffice";

export function PreviewOfficeLinkGuard() {
  useEffect(() => {
    const isVercelPreview = window.location.hostname.endsWith(".vercel.app");
    if (!isVercelPreview) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      if (href !== "/office" && !href.startsWith("/office?")) return;

      event.preventDefault();
      window.location.assign(PREVIEW_OFFICE_LOGIN);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
