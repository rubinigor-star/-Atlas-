"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const TTL=30*60*1000;
function sessionFor(code:string){const key=`atlas-promoter-v2-${code}`;const now=Date.now();try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw) as {id?:unknown;lastSeen?:unknown};if(typeof parsed.id==="string"&&typeof parsed.lastSeen==="number"&&now-parsed.lastSeen<TTL){localStorage.setItem(key,JSON.stringify({id:parsed.id,lastSeen:now}));return parsed.id}}}catch{}const id=crypto.randomUUID();try{localStorage.setItem(key,JSON.stringify({id,lastSeen:now}))}catch{}return id}

export function PromoterChannelTracker(){
 const pathname=usePathname();const params=useSearchParams();
 useEffect(()=>{
  if(!pathname.startsWith("/events/"))return;
  const code=(params.get("channel")||params.get("ref")||"").trim();if(!code)return;
  const sessionId=sessionFor(code.toUpperCase());let cancelled=false;
  const body={sessionId,source:params.get("source")||document.referrer||null,utmSource:params.get("utm_source"),utmMedium:params.get("utm_medium"),utmCampaign:params.get("utm_campaign")};
  void (async()=>{for(let attempt=0;attempt<2&&!cancelled;attempt++){try{const r=await fetch(`/api/promoter-links/${encodeURIComponent(code)}/visit`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),keepalive:true,cache:"no-store"});if(r.ok||r.status===404)return}catch{}if(attempt===0)await new Promise(r=>setTimeout(r,400))}})();
  return()=>{cancelled=true};
 },[pathname,params]);
 return null;
}
