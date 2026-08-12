"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function FullscreenMapPanel({children}:{children:ReactNode}){
 const[open,setOpen]=useState(false);
 const rootRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
  window.addEventListener("keydown",close);
  return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)};
 },[open]);

 useEffect(()=>{
  const root=rootRef.current;
  const mapScroll=root?.querySelector<HTMLElement>(".venue-builder .map-scroll");
  if(!mapScroll)return;

  let spaceHeld=false;
  let panning=false;
  let panPointerId=-1;
  let panStartX=0;
  let panStartY=0;
  let startPanX=0;
  let startPanY=0;
  let panX=Number(mapScroll.dataset.panX||0);
  let panY=Number(mapScroll.dataset.panY||0);
  let zoomLocked=false;

  let marqueePointerId=-1;
  let marqueeStartX=0;
  let marqueeStartY=0;
  let marqueeMoved=false;
  let suppressNextClick=false;

  const frame=()=>mapScroll.querySelector<HTMLElement>(".map-world-frame");
  const applyPan=()=>{
   const current=frame();
   if(!current)return;
   current.style.transform=`translate(${panX}px, ${panY}px)`;
   mapScroll.dataset.panX=String(panX);
   mapScroll.dataset.panY=String(panY);
  };
  applyPan();

  const setCursor=()=>{
   mapScroll.style.cursor=spaceHeld?(panning?"grabbing":"grab"):"";
  };

  const keyDown=(event:KeyboardEvent)=>{
   if(event.code!=="Space")return;
   const target=event.target as HTMLElement|null;
   if(target?.closest("input,select,textarea,button,a,[contenteditable='true']"))return;
   event.preventDefault();
   spaceHeld=true;
   setCursor();
  };
  const keyUp=(event:KeyboardEvent)=>{
   if(event.code!=="Space")return;
   spaceHeld=false;
   if(panning){
    panning=false;
    panPointerId=-1;
   }
   setCursor();
  };
  const blur=()=>{
   spaceHeld=false;
   panning=false;
   panPointerId=-1;
   marqueePointerId=-1;
   setCursor();
  };

  const pointerDown=(event:PointerEvent)=>{
   if(event.button!==0)return;

   if(spaceHeld){
    event.preventDefault();
    event.stopPropagation();
    panning=true;
    panPointerId=event.pointerId;
    panStartX=event.clientX;
    panStartY=event.clientY;
    startPanX=panX;
    startPanY=panY;
    try{mapScroll.setPointerCapture(event.pointerId)}catch{}
    setCursor();
    return;
   }

   const target=event.target as HTMLElement|null;
   if(target?.classList.contains("map-world")&&target.classList.contains("tickets")){
    marqueePointerId=event.pointerId;
    marqueeStartX=event.clientX;
    marqueeStartY=event.clientY;
    marqueeMoved=false;
   }
  };

  const pointerMove=(event:PointerEvent)=>{
   if(panning&&event.pointerId===panPointerId){
    event.preventDefault();
    event.stopPropagation();
    panX=startPanX+(event.clientX-panStartX);
    panY=startPanY+(event.clientY-panStartY);
    applyPan();
    return;
   }

   if(event.pointerId===marqueePointerId){
    if(Math.abs(event.clientX-marqueeStartX)>4||Math.abs(event.clientY-marqueeStartY)>4)marqueeMoved=true;
   }
  };

  const pointerEnd=(event:PointerEvent)=>{
   if(event.pointerId===panPointerId){
    if(panning){
     event.preventDefault();
     event.stopPropagation();
     suppressNextClick=true;
    }
    try{if(mapScroll.hasPointerCapture(event.pointerId))mapScroll.releasePointerCapture(event.pointerId)}catch{}
    panning=false;
    panPointerId=-1;
    setCursor();
    return;
   }

   if(event.pointerId===marqueePointerId){
    if(marqueeMoved)suppressNextClick=true;
    marqueePointerId=-1;
    marqueeMoved=false;
   }
  };

  const suppressClick=(event:MouseEvent)=>{
   if(spaceHeld||suppressNextClick){
    suppressNextClick=false;
    event.preventDefault();
    event.stopPropagation();
   }
  };

  const wheel=(event:WheelEvent)=>{
   if(!spaceHeld)return;
   event.preventDefault();
   event.stopPropagation();
   if(zoomLocked)return;

   const oldFrame=frame();
   const tools=mapScroll.parentElement?.querySelector<HTMLElement>(".floating-tools");
   if(!oldFrame||!tools)return;
   const buttons=[...tools.querySelectorAll<HTMLButtonElement>("button")];
   const zoomOut=buttons.find(button=>button.textContent?.trim()==="−");
   const zoomIn=buttons.find(button=>button.textContent?.trim()==="＋"||button.textContent?.trim()==="+");
   const button=event.deltaY<0?zoomIn:zoomOut;
   if(!button||button.disabled)return;

   const oldRect=oldFrame.getBoundingClientRect();
   if(!oldRect.width||!oldRect.height)return;
   const fx=(event.clientX-oldRect.left)/oldRect.width;
   const fy=(event.clientY-oldRect.top)/oldRect.height;

   zoomLocked=true;
   button.click();
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const nextFrame=frame();
    if(nextFrame){
     const nextRect=nextFrame.getBoundingClientRect();
     if(nextRect.width&&nextRect.height){
      const pointX=nextRect.left+fx*nextRect.width;
      const pointY=nextRect.top+fy*nextRect.height;
      panX+=event.clientX-pointX;
      panY+=event.clientY-pointY;
      applyPan();
     }
    }
    zoomLocked=false;
   }));
  };

  window.addEventListener("keydown",keyDown,{passive:false});
  window.addEventListener("keyup",keyUp);
  window.addEventListener("blur",blur);
  mapScroll.addEventListener("pointerdown",pointerDown,true);
  mapScroll.addEventListener("pointermove",pointerMove,true);
  mapScroll.addEventListener("pointerup",pointerEnd,true);
  mapScroll.addEventListener("pointercancel",pointerEnd,true);
  mapScroll.addEventListener("click",suppressClick,true);
  mapScroll.addEventListener("wheel",wheel,{passive:false,capture:true});

  return()=>{
   window.removeEventListener("keydown",keyDown);
   window.removeEventListener("keyup",keyUp);
   window.removeEventListener("blur",blur);
   mapScroll.removeEventListener("pointerdown",pointerDown,true);
   mapScroll.removeEventListener("pointermove",pointerMove,true);
   mapScroll.removeEventListener("pointerup",pointerEnd,true);
   mapScroll.removeEventListener("pointercancel",pointerEnd,true);
   mapScroll.removeEventListener("click",suppressClick,true);
   mapScroll.removeEventListener("wheel",wheel,true);
   mapScroll.style.cursor="";
  };
 },[open]);

 return <div ref={rootRef} className={open?"map-overlay":"panel"} style={open?{position:"fixed",inset:0,zIndex:10000,background:"#fff",overflow:"auto",padding:16}:{background:"var(--surface, #fff)",overflow:"auto"}}>
  <div className="row between"><div><span className="eyebrow">Места и карта</span><h2>Схема зала и назначение билетов</h2></div><button type="button" className="btn secondary" onClick={()=>setOpen(value=>!value)}>{open?"Закрыть полноэкранный режим":"Открыть карту на весь экран"}</button></div>
  {children}
 </div>;
}
