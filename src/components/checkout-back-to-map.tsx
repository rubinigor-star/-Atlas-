"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import styles from "./checkout-back-to-map.module.css";

export function CheckoutBackToMap({eventSlug,referralCode}:{eventSlug:string;referralCode?:string}){
  const {locale}=useLocale();
  const label=locale==="he"?"חזרה למפת המושבים":locale==="ru"?"Вернуться к карте":"Back to seat map";
  const href=`/events/${eventSlug}/seats${referralCode?`?ref=${encodeURIComponent(referralCode)}`:""}`;
  return <div className={styles.wrap}>
    <Link className={styles.back} href={href}>
      <ArrowLeft size={17} aria-hidden="true"/>
      <span>{label}</span>
    </Link>
  </div>;
}
