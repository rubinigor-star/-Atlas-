"use client";

import { useEffect } from "react";

export function OrderFrameEscape(){
  useEffect(()=>{
    try{
      if(window.self!==window.top) window.top!.location.replace(window.location.href);
    }catch{
      // If browser policy prevents direct access, post a minimal navigation request.
      try{window.parent.postMessage({type:"atlas-order-status",url:window.location.href},window.location.origin);}catch{}
    }
  },[]);
  return null;
}
