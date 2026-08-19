"use client";

import { useEffect } from "react";

export function HypLaunchClient({paymentUrl}:{paymentUrl:string}){
  useEffect(()=>{
    // Navigate the current browsing context. When this page is rendered inside
    // the checkout iframe, Safari keeps the navigation inside that iframe and
    // loads HYP directly. This is more reliable than mutating frameElement.src.
    const timer=window.setTimeout(()=>window.location.replace(paymentUrl),0);
    return()=>window.clearTimeout(timer);
  },[paymentUrl]);

  return <main className="container" style={{paddingTop:80,maxWidth:720}}><section className="panel form" style={{textAlign:"center"}}><h1>Переходим к безопасной оплате HYP…</h1><p>Если переход не произошёл автоматически, нажмите кнопку.</p><a className="btn" href={paymentUrl}>Открыть страницу оплаты</a></section></main>;
}
