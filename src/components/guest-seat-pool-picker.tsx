"use client";

import { useMemo } from "react";

type Seat={id:string;label:string;position:number;status:"AVAILABLE"|"RESERVED"|"BLOCKED";categoryId:string|null};
type MapObject={id:string;label:string;objectType:string;priceMode:"WHOLE_TABLE"|"PER_SEAT";x:number;y:number;width:number;height:number;rotation:number;seats:number;categoryId:string|null;reserved:boolean;seatItems:Seat[]};

export function GuestSeatPoolPicker({objects,selected,onChange}:{objects:MapObject[];selected:string[];onChange:(ids:string[])=>void}){
 const selectedSet=useMemo(()=>new Set(selected),[selected]);
 const selectable=objects.filter(item=>item.priceMode==="PER_SEAT"&&item.seatItems.some(seat=>seat.status==="AVAILABLE"));
 function toggle(id:string){onChange(selectedSet.has(id)?selected.filter(item=>item!==id):[...selected,id]);}
 return <div className="field"><label>Места с карты</label><p className="muted">Нажмите на конкретные места, которые будут доступны только этой гостевой ссылке. Выбрано: <strong>{selected.length}</strong>.</p>
  <div style={{position:"relative",height:460,border:"1px solid #e5e7eb",borderRadius:16,overflow:"auto",background:"#fafafa"}}>
   <div style={{position:"relative",minWidth:900,minHeight:620}}>
    {selectable.map(object=><div key={object.id} style={{position:"absolute",left:`${Math.max(2,Math.min(94,object.x))}%`,top:`${Math.max(2,Math.min(90,object.y))}%`,transform:`translate(-50%,-50%) rotate(${object.rotation}deg)`,minWidth:Math.max(90,object.width*.55),padding:8,border:"1px solid #d1d5db",borderRadius:12,background:"white"}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:6,textAlign:"center"}}>{object.label}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center"}}>{[...object.seatItems].sort((a,b)=>a.position-b.position).map(seat=>{const available=seat.status==="AVAILABLE";const active=selectedSet.has(seat.id);return <button key={seat.id} type="button" disabled={!available} title={`${object.label} · ${seat.label}`} onClick={()=>toggle(seat.id)} style={{width:30,height:30,borderRadius:999,border:active?"3px solid currentColor":"1px solid #9ca3af",fontWeight:700,opacity:available?1:.3,background:active?"#fff":"#f3f4f6",cursor:available?"pointer":"not-allowed"}}>{seat.position}</button>})}</div>
    </div>)}
    {!selectable.length&&<div className="muted" style={{padding:24}}>На карте нет свободных мест, продаваемых по отдельности.</div>}
   </div>
  </div>
  {selected.length>0&&<button type="button" className="btn secondary" style={{marginTop:8}} onClick={()=>onChange([])}>Очистить выбор</button>}
 </div>;
}
