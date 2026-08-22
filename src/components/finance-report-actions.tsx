"use client";

import type { Locale } from "@/lib/i18n";

const copy={ru:{csv:"Скачать CSV",print:"Печать / PDF"},he:{csv:"הורדת CSV",print:"הדפסה / PDF"},en:{csv:"Download CSV",print:"Print / PDF"}} as const;

export function FinanceReportActions({eventId,locale="ru"}:{eventId:string;locale?:Locale}){
  const t=copy[locale];
  return <div className="row" style={{flexWrap:"wrap"}} dir={locale==="he"?"rtl":"ltr"}>
    <a className="btn secondary" href={`/api/finance/events/${eventId}/report.csv`}>{t.csv}</a>
    <button className="btn secondary" type="button" onClick={()=>window.print()}>{t.print}</button>
  </div>;
}
