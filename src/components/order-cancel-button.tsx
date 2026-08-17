"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderCancelButton({publicId}:{publicId:string}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 async function cancel(){
  if(!window.confirm("Отменить заказ и аннулировать все его билеты? Это действие освободит места и вернёт их в доступный остаток."))return;
  setBusy(true);setError("");
  try{const response=await fetch(`/api/admin/orders/${publicId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"cancel"})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Не удалось отменить заказ");router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Не удалось отменить заказ");}
  finally{setBusy(false)}
 }
 return <div><button type="button" className="btn secondary" disabled={busy} onClick={()=>void cancel()}>{busy?"Отменяем...":"Отменить заказ"}</button>{error&&<div className="toast" style={{marginTop:8}}>{error}</div>}</div>;
}
