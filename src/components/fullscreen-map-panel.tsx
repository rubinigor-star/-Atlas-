"use client";

import { useEffect, useState, type ReactNode } from "react";

export function FullscreenMapPanel({children}:{children:ReactNode}){
 const[open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
  window.addEventListener("keydown",close);
  return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)};
 },[open]);

 useEffect(()=>{
  const mapScroll=document.querySelector<HTMLElement>(".venue-builder .map-scroll");
  if(!mapScroll)return;

  let spaceHeld=false;
  let panning=false;
  let pointerId=-1;
  let startX=0;
  let startY=0;
  let startLeft=0;
  let startTop=0;
  let zoomLocked=false;

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
   panning=false;
   pointerId=-1;
   setCursor();
  };
  const blur=()=>{
   spaceHeld=false;
   panning=false;
   pointerId=-1;
   setCursor();
  };

  const pointerDown=(event:PointerEvent)=>{
   if(!spaceHeld||event.button!==0)return;
   event.preventDefault();
   event.stopPropagation();
   panning=true;
   pointerId=event.pointerId;
   startX=event.clientX;
   startY=event.clientY;
   startLeft=mapScroll.scrollLeft;
   startTop=mapScroll.scrollTop;
   try{mapScroll.setPointerCapture(event.pointerId)}catch{}
   setCursor();
  };
  const pointerMove=(event:PointerEvent)=>{
   if(!panning||event.pointerId!==pointerId)return;
   event.preventDefault();
   event.stopPropagation();
   mapScroll.scrollLeft=startLeft-(event.clientX-startX);
   mapScroll.scrollTop=startTop-(event.clientY-startY);
  };
  const endPan=(event:PointerEvent)=>{
   if(event.pointerId!==pointerId)return;
   if(panning){event.preventDefault();event.stopPropagation();}
   try{if(mapScroll.hasPointerCapture(event.pointerId))mapScroll.releasePointerCapture(event.pointerId)}catch{}
   panning=false;
   pointerId=-1;
   setCursor();
  };
  const suppressClick=(event:MouseEvent)=>{
   if(!spaceHeld)return;
   event.preventDefault();
   event.stopPropagation();
  };

  const wheel=(event:WheelEvent)=>{
   if(!spaceHeld)return;
   event.preventDefault();
   event.stopPropagation();
   if(zoomLocked)return;

   const frame=mapScroll.querySelector<HTMLElement>(".map-world-frame");
   const tools=mapScroll.parentElement?.querySelector<HTMLElement>(".floating-tools");
   if(!frame||!tools)return;
   const buttons=[...tools.querySelectorAll<HTMLButtonElement>("button")];
   const zoomOut=buttons.find(button=>button.textContent?.trim()==="−");
   const zoomIn=buttons.find(button=>button.textContent?.trim()==="＋"||button.textContent?.trim()==="+");
   const button=event.deltaY<0?zoomIn:zoomOut;
   if(!button||button.disabled)return;

   const oldWidth=frame.getBoundingClientRect().width;
   const oldHeight=frame.getBoundingClientRect().height;
   if(!oldWidth||!oldHeight)return;
   const bounds=mapScroll.getBoundingClientRect();
   const cursorX=event.clientX-bounds.left;
   const cursorY=event.clientY-bounds.top;
   const oldLeft=mapScroll.scrollLeft;
   const oldTop=mapScroll.scrollTop;

   zoomLocked=true;
   button.click();
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const nextFrame=mapScroll.querySelector<HTMLElement>(".map-world-frame");
    if(nextFrame){
     const newWidth=nextFrame.getBoundingClientRect().width;
     const newHeight=nextFrame.getBoundingClientRect().height;
     if(newWidth&&newHeight){
      mapScroll.scrollLeft=(oldLeft+cursorX)*(newWidth/oldWidth)-cursorX;
      mapScroll.scrollTop=(oldTop+cursorY)*(newHeight/oldHeight)-cursorY;
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
  mapScroll.addEventListener("pointerup",endPan,true);
  mapScroll.addEventListener("pointercancel",endPan,true);
  mapScroll.addEventListener("click",suppressClick,true);
  mapScroll.addEventListener("wheel",wheel,{passive:false,capture:true});

  return()=>{
   window.removeEventListener("keydown",keyDown);
   window.removeEventListener("keyup",keyUp);
   window.removeEventListener("blur",blur);
   mapScroll.removeEventListener("pointerdown",pointerDown,true);
   mapScroll.removeEventListener("pointermove",pointerMove,true);
   mapScroll.removeEventListener("pointerup",endPan,true);
   mapScroll.removeEventListener("pointercancel",endPan,true);
   mapScroll.removeEventListener("click",suppressClick,true);
   mapScroll.removeEventListener("wheel",wheel,true);
   mapScroll.style.cursor="";
  };
 },[open]);

 return <div className={open?"map-overlay":"panel"} style={open?{position:"fixed",inset:0,zIndex:10000,background:"#fff",overflow:"auto",padding:16}:{background:"var(--surface, #fff)",overflow:"auto"}}>
  <div className="row between"><div><span className="eyebrow">Места и карта</span><h2>Схема зала и назначение билетов</h2></div><button type="button" className="btn secondary" onClick={()=>setOpen(value=>!value)}>{open?"Закрыть полноэкранный режим":"Открыть карту на весь экран"}</button></div>
  {children}
 </div>;
}
