import { db } from "@/lib/db";
import { findPromoterChannelV2 } from "@/lib/promoter-v2";

export type PromoterChannel={
 source:"V2"|"LEGACY";id:string;code:string;eventId:string;active:boolean;label:string;promoterName:string;allocationType:"EVENT"|"CATEGORY"|"TABLE";categoryId:string|null;tableId:string|null;customPriceMinor:number|null;startsAt:Date|null;endsAt:Date|null;
};

export async function resolvePromoterChannel(code:string|undefined|null):Promise<PromoterChannel|null>{
 if(!code)return null;
 const normalized=code.toUpperCase();
 const v2=await findPromoterChannelV2(normalized);
 if(v2)return{source:"V2",id:v2.id,code:v2.code,eventId:v2.eventId,active:v2.active&&v2.promoterActive,label:v2.label,promoterName:v2.promoterName,allocationType:v2.allocationType,categoryId:v2.categoryId,tableId:v2.tableId,customPriceMinor:v2.customPriceMinor,startsAt:v2.startsAt,endsAt:v2.endsAt};
 const legacy=await db.promoterLink.findUnique({where:{code:normalized},include:{promoter:true}});
 if(!legacy)return null;
 return{source:"LEGACY",id:legacy.id,code:legacy.code,eventId:legacy.eventId,active:legacy.active&&legacy.promoter.active,label:legacy.label,promoterName:legacy.promoter.name,allocationType:legacy.allocationType,categoryId:legacy.categoryId,tableId:legacy.tableId,customPriceMinor:legacy.customPriceMinor,startsAt:legacy.startsAt,endsAt:legacy.endsAt};
}

export function promoterChannelValid(link:PromoterChannel|null,eventId:string,now=new Date()){
 return Boolean(link&&link.eventId===eventId&&link.active&&(!link.startsAt||link.startsAt<=now)&&(!link.endsAt||link.endsAt>=now));
}
