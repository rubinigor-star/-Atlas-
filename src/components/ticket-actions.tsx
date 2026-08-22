"use client";
import {useRouter} from "next/navigation";
import {useLocale} from "@/components/locale-provider";
const copy={ru:{cancel:"Аннулировать",code:"Новый код"},he:{cancel:"ביטול",code:"קוד חדש"},en:{cancel:"Invalidate",code:"New code"}} as const;
export function TicketActions({id,status}:{id:string;status:string}){const {locale}=useLocale();const text=copy[locale];const router=useRouter();async function action(type:"cancel"|"regenerate"){await fetch(`/api/admin/tickets/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:type})});router.refresh()}return <div className="row"><button className="btn secondary" disabled={status==="CANCELLED"} onClick={()=>void action("cancel")}>{text.cancel}</button><button className="btn secondary" onClick={()=>void action("regenerate")}>{text.code}</button></div>}
