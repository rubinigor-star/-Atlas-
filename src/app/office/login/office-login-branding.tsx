"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import { localeNames } from "@/lib/i18n";
import { atlasBackstageLogoDataUrl } from "@/lib/atlas-backstage-logo";
import styles from "./office-login-branding.module.css";

const locales: Locale[] = ["ru", "he", "en"];

function useLogoObjectUrl() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const comma = atlasBackstageLogoDataUrl.indexOf(",");
    if (comma < 0) return;

    const binary = window.atob(atlasBackstageLogoDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, []);

  return url;
}

export function BackstageLogo({ className }: { className?: string }) {
  const logoUrl = useLogoObjectUrl();
  return logoUrl ? <img className={className} src={logoUrl} alt="Atlas One Backstage" /> : <span className={styles.logoPlaceholder} aria-hidden="true" />;
}

export function OfficeLoginTopbar() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const activeName = useMemo(() => localeNames[locale], [locale]);

  return <div className={styles.loginTopbar}>
    <BackstageLogo className={styles.topbarLogo} />
    <div className={styles.languageControl}>
      <button type="button" className={styles.languageButton} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span>{activeName}</span>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <div className={styles.languageMenu} role="menu">
        {locales.map(option => <button
          type="button"
          role="menuitemradio"
          aria-checked={option === locale}
          data-selected={option === locale ? "true" : "false"}
          key={option}
          onClick={() => { setLocale(option); setOpen(false); }}
        >{localeNames[option]}</button>)}
      </div>}
    </div>
  </div>;
}
