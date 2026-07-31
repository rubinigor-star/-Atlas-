"use client";

import { useRef, type ReactNode } from "react";

export function FullscreenMapPanel({children}:{children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 async function open(){const element=ref.current;if(!element)return;if(document.fullscreenElement)await document.exitFullscreen();else await element.requestFullscreen()}
 return <div ref={ref} className="panel" style={{background:"var(--surface, #fff)",overflow:"auto"}}><div className="row between"><div><span className="eyebrow">Места и карта</span><h2>Схема зала и назначение билетов</h2></div><button type="button" className="btn secondary" onClick={()=>void open()}>Открыть карту на весь экран</button></div>{children}</div>;
}
