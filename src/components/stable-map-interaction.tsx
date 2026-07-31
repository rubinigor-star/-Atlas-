"use client";

import type { ReactNode } from "react";

export function StableMapInteraction({children}:{children:ReactNode}){
 return <div onPointerDownCapture={event=>{
  const target=event.target as HTMLElement;
  if(target.closest(".editor-object")&&!target.closest("button,input,select,textarea")){
   event.stopPropagation();
  }
 }}>{children}</div>;
}
