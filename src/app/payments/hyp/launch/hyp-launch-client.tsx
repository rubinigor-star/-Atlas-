"use client";

import { useEffect } from "react";

export function HypLaunchClient({paymentUrl}:{paymentUrl:string}){
  useEffect(()=>{
    const frame=window.frameElement;
    if(frame instanceof HTMLIFrameElement){
      frame.setAttribute("allow","payment");
      frame.setAttribute("src",paymentUrl);
      return;
    }
    const timer=window.setTimeout(()=>window.location.assign(paymentUrl),50);
    return()=>window.clearTimeout(timer);
  },[paymentUrl]);

  return <main className="container" style={{paddingTop:80,maxWidth:720}}><section className="panel form" style={{textAlign:"center"}}><h1>Переходим к безопасной оплате HYP…</h1><p>Если переход не произошёл автоматически, нажмите кнопку.</p><a className="btn" href={paymentUrl}>Открыть страницу оплаты</a></section></main>;
}
