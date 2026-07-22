"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { Download, LogOut, UserRound } from "lucide-react";
import { roleLabels } from "@/lib/permissions";

type Colleague={id:string;name:string;email:string;staffRole:StaffRole};
export function OfficeAccountMenu({currentEmail,currentName,colleagues,compact=false}:{currentEmail:string;currentName:string;colleagues:Colleague[];compact?:boolean}){
  const router=useRouter();const[open,setOpen]=useState(false);const[installEvent,setInstallEvent]=useState<Event|null>(null);
  useEffect(()=>{const handler=(event:Event)=>{event.preventDefault();setInstallEvent(event)};window.addEventListener("beforeinstallprompt",handler);return()=>window.removeEventListener("beforeinstallprompt",handler)},[]);
  async function switchUser(email:string){await fetch("/api/office/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email})});setOpen(false);router.push("/office");router.refresh()}
  async function install(){if(!installEvent)return;await(installEvent as Event&{prompt:()=>Promise<void>}).prompt();setInstallEvent(null)}
  return <div className={`office-account ${compact?"compact":""}`}><button onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span>{currentName.split(" ").map(part=>part[0]).slice(0,2).join("")}</span>{!compact&&<div><strong>{currentName}</strong><small>{currentEmail}</small></div>}</button>{open&&<div className="office-account-popover"><strong>Демо: работать как</strong>{colleagues.map(member=><button key={member.id} className={member.email===currentEmail?"selected":""} onClick={()=>void switchUser(member.email)}><UserRound size={16}/><span>{member.name}<small>{roleLabels[member.staffRole]}</small></span></button>)}{installEvent&&<button onClick={()=>void install()}><Download size={16}/><span>Установить Atlas Office<small>Добавить приложение на устройство</small></span></button>}<Link href="/"><LogOut size={16}/><span>Открыть сайт покупателей</span></Link><p>Демонстрационное переключение не является production-авторизацией.</p></div>}</div>;
}
