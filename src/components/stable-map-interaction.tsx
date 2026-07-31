"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type DragElement=HTMLElement&{
 setPointerCapture:(pointerId:number)=>void;
 releasePointerCapture:(pointerId:number)=>void;
 hasPointerCapture:(pointerId:number)=>boolean;
};

export function StableMapInteraction({children}:{children:ReactNode}){
 const active=useRef<DragElement|null>(null);
 const pointerId=useRef<number|null>(null);

 useEffect(()=>{
  const forward=(type:"pointermove"|"pointerup"|"pointercancel",event:PointerEvent)=>{
   const target=active.current;
   if(!target||pointerId.current!==event.pointerId)return;
   if(type==="pointermove"&&target.contains(event.target as Node))return;
   target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,button:event.button,buttons:event.buttons,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey}));
   if(type!=="pointermove"){active.current=null;pointerId.current=null;}
  };
  const move=(event:PointerEvent)=>forward("pointermove",event);
  const up=(event:PointerEvent)=>forward("pointerup",event);
  const cancel=(event:PointerEvent)=>forward("pointercancel",event);
  window.addEventListener("pointermove",move,true);
  window.addEventListener("pointerup",up,true);
  window.addEventListener("pointercancel",cancel,true);
  return()=>{window.removeEventListener("pointermove",move,true);window.removeEventListener("pointerup",up,true);window.removeEventListener("pointercancel",cancel,true);};
 },[]);

 function start(event:ReactPointerEvent<HTMLDivElement>){
  const source=event.target as HTMLElement;
  if(source.closest("button,input,select,textarea"))return;
  const object=source.closest(".editor-object") as DragElement|null;
  if(!object)return;
  active.current=object;
  pointerId.current=event.pointerId;
  Object.defineProperties(object,{
   setPointerCapture:{configurable:true,value:()=>{}},
   releasePointerCapture:{configurable:true,value:()=>{}},
   hasPointerCapture:{configurable:true,value:()=>false},
  });
 }

 return <div onPointerDownCapture={start}>{children}</div>;
}
