"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PosterUploader } from "@/components/poster-uploader";
import { useLocale } from "@/components/locale-provider";

type MediaItem={type:"VIDEO"|"LINK";url:string;title?:string};
type EventDetails={id:string;title:string;description:string;posterUrl:string;media:MediaItem[];startsAt:string;venueName:string;city:string;address:string};

const labels={
 ru:{title:"Название",description:"Описание",videos:"Видео мероприятия",links:"Дополнительные ссылки",date:"Дата и время",venue:"Площадка",city:"Город",address:"Полный адрес",save:"Сохранить основные данные",saved:"Изменения сохранены",error:"Не удалось сохранить изменения"},
 he:{title:"שם האירוע",description:"תיאור האירוע",videos:"סרטוני האירוע",links:"קישורים נוספים",date:"תאריך ושעה",venue:"מקום האירוע",city:"עיר",address:"כתובת מלאה",save:"שמירת פרטי האירוע",saved:"השינויים נשמרו",error:"לא ניתן לשמור את השינויים"},
 en:{title:"Event name",description:"Event description",videos:"Event videos",links:"Additional links",date:"Date and time",venue:"Venue",city:"City",address:"Full address",save:"Save event details",saved:"Changes saved",error:"Could not save changes"}
} as const;

export function EventDetailsManager({event}:{event:EventDetails}){
 const router=useRouter();const{locale}=useLocale();const text=labels[locale];const[message,setMessage]=useState("");
 async function submit(form:HTMLFormElement){
  const f=new FormData(form);const lines=(name:string,type:"VIDEO"|"LINK")=>String(f.get(name)||"").split(/\r?\n/).map(url=>url.trim()).filter(Boolean).map(url=>({type,url}));
  setMessage("");
  try{const response=await fetch(`/api/admin/events/${event.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update",title:f.get("title"),description:f.get("description"),posterUrl:f.get("posterUrl"),startsAt:new Date(String(f.get("startsAt"))).toISOString(),venueName:f.get("venueName"),city:f.get("city"),address:f.get("address"),media:[...lines("videoUrls","VIDEO"),...lines("linkUrls","LINK")]})});if(!response.ok)throw new Error();setMessage(text.saved);router.refresh();}catch{setMessage(text.error)}
 }
 return <form className="panel form" onSubmit={eventSubmit=>{eventSubmit.preventDefault();void submit(eventSubmit.currentTarget)}}>
  <span className="eyebrow">О мероприятии</span><h2>Основная информация</h2>
  <div className="field"><label>{text.title}</label><input className="input" name="title" defaultValue={event.title} required/></div>
  <PosterUploader initialUrl={event.posterUrl}/>
  <div className="field"><label>{text.description}</label><textarea name="description" rows={6} defaultValue={event.description} required/></div>
  <div className="field"><label>{text.videos}</label><textarea name="videoUrls" rows={3} defaultValue={event.media.filter(item=>item.type==="VIDEO").map(item=>item.url).join("\n")}/></div>
  <div className="field"><label>{text.links}</label><textarea name="linkUrls" rows={3} defaultValue={event.media.filter(item=>item.type==="LINK").map(item=>item.url).join("\n")}/></div>
  <div className="form-grid two"><div className="field"><label>{text.date}</label><input className="input" name="startsAt" type="datetime-local" defaultValue={event.startsAt.slice(0,16)} required/></div><div className="field"><label>{text.venue}</label><input className="input" name="venueName" defaultValue={event.venueName} required/></div></div>
  <div className="form-grid two"><div className="field"><label>{text.city}</label><input className="input" name="city" defaultValue={event.city} required/></div><div className="field"><label>{text.address}</label><input className="input" name="address" defaultValue={event.address} required/></div></div>
  <button className="btn">{text.save}</button>{message&&<div className="toast" role="status">{message}</div>}
 </form>;
}
