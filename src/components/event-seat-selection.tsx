"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Minus, Plus, RotateCcw } from "lucide-react";
import { money } from "@/lib/format";
import { calculateServiceFee, type ServiceFeeTerms } from "@/lib/service-fee";
import type { PricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import type { TicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { useLocale } from "@/components/locale-provider";
import styles from "./event-seat-selection.module.css";

type Category = {
  id: string;
  name: string;
  priceMinor: number;
  colorHex: string;
  capacity: number;
  sold: number;
  pricingPresentation: { stageLabel: string };
  marketingStrategy: PricingMarketingStrategy;
  salesStrategy: TicketSalesStrategy;
};

type MapSeat = { id: string; label: string; position: number; status: "AVAILABLE" | "RESERVED" | "BLOCKED"; categoryId: string | null };
type MapObject = {
  id: string;
  label: string;
  seats: number;
  priceMinor: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  reserved: boolean;
  categoryId: string | null;
  seatItems: MapSeat[];
};

type Allocation = { type: "EVENT" | "CATEGORY" | "TABLE"; categoryId: string | null; tableId: string | null; customPriceMinor: number | null };
type OfferFilter = "ALL" | "BUY_ONE_GET_ONE";
type SeatStyle = React.CSSProperties & { "--seat-color": string };

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const sellableTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);

function isInternalObject(object: MapObject) {
  return object.label.startsWith("__ATLAS_") || object.label.startsWith("READING_V3_");
}

function tableSeatPosition(item: MapObject, index: number): React.CSSProperties {
  const position = index + 1;
  const horizontal = item.width >= item.height;
  if (item.seats === 2) return horizontal ? { left:position === 1 ? "12%" : "88%", top:"50%" } : { left:"50%", top:position === 1 ? "12%" : "88%" };
  if (item.seats === 6 && horizontal) {
    const top = index < 3;
    return { left:`${[18,50,82][index % 3]}%`, top:top ? "14%" : "86%" };
  }
  if (item.seats === 8 && !horizontal) {
    const left = index < 4;
    return { left:left ? "15%" : "85%", top:`${[14,38,62,86][index % 4]}%` };
  }
  const half = Math.ceil(item.seats / 2);
  const first = index < half;
  const slot = first ? index : index - half;
  const count = first ? half : Math.floor(item.seats / 2);
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  return horizontal ? { left:offset, top:first ? "14%" : "86%" } : { left:first ? "15%" : "85%", top:offset };
}

function seatSequences(object: MapObject): MapSeat[][] {
  const seats = [...object.seatItems].sort((a,b) => a.position - b.position);
  if (object.objectType === "TABLE") {
    const horizontal = object.width >= object.height;
    if (object.seats === 6 && horizontal) return [seats.slice(0,3), seats.slice(3,6)];
    if (object.seats === 8 && !horizontal) return [seats.slice(0,4), seats.slice(4,8)];
    if (object.seats === 2) return [seats];
  }
  return [seats];
}

function validGroups(object: MapObject, quantity: number, seatAllowed: (seat: MapSeat) => boolean) {
  if (object.priceMode !== "PER_SEAT" || quantity < 1) return [] as string[][];
  const output: string[][] = [];
  if (object.objectType === "ROUND_TABLE") {
    const seats = [...object.seatItems].sort((a,b) => a.position - b.position);
    if (quantity > seats.length) return output;
    for (let start=0; start<seats.length; start+=1) {
      const group = Array.from({length:quantity},(_,offset)=>seats[(start+offset)%seats.length]);
      if (new Set(group.map(item=>item.id)).size===quantity && group.every(seatAllowed)) output.push(group.map(item=>item.id));
    }
    return output;
  }
  for (const sequence of seatSequences(object)) {
    if (quantity > sequence.length) continue;
    for (let start=0; start<=sequence.length-quantity; start+=1) {
      const group=sequence.slice(start,start+quantity);
      const first=group[0]?.position ?? 0;
      if (group.every((seat,index)=>seat.position===first+index && seatAllowed(seat))) output.push(group.map(item=>item.id));
    }
  }
  return output;
}

function SeatDot({ seat, object, color, selected, eligible, disabled, onClick }: { seat: MapSeat; object: MapObject; color: string; selected: boolean; eligible: boolean; disabled: boolean; onClick: () => void }) {
  const style = object.objectType === "TABLE" ? tableSeatPosition(object, seat.position - 1) : object.objectType === "ROUND_TABLE" ? (() => { const angle=(seat.position-1)/Math.max(1,object.seats)*Math.PI*2-Math.PI/2; return {left:`${50+Math.cos(angle)*39}%`,top:`${50+Math.sin(angle)*39}%`}; })() : undefined;
  const seatStyle: SeatStyle = { ...style, "--seat-color": color };
  return <button type="button" aria-label={seat.label} title={seat.label} className={`${styles.seat} ${selected?styles.selected:""} ${!eligible?styles.filtered:""}`} style={seatStyle} disabled={disabled} onClick={(event)=>{event.stopPropagation();onClick();}}><span>{seat.position}</span></button>;
}

export function EventSeatSelection({ eventId, slug, title, posterUrl, venueName, categories, objects, feeTerms, referralCode, allocation, initialQty }: { eventId:string; slug:string; title:string; posterUrl:string; venueName:string; categories:Category[]; objects:MapObject[]; feeTerms:ServiceFeeTerms; referralCode?:string; allocation?:Allocation; initialQty:number }) {
  const router=useRouter();
  const {locale}=useLocale();
  const viewportRef=useRef<HTMLDivElement>(null);
  const panRef=useRef({pointerId:-1,x:0,y:0,left:0,top:0});
  const [spaceHeld,setSpaceHeld]=useState(false);
  const [panning,setPanning]=useState(false);
  const local={
    ru:{offers:"Специальные предложения",all:"Все билеты",onePlusOne:"1 + 1",quantity:"Количество билетов",selected:"Выбрано",continue:"Продолжить",price:"Цена",together:"Показываем только места, где выбранное количество гостей может сидеть рядом",noSeats:"В выбранном диапазоне нет подходящих мест рядом",zoomReset:"Сбросить масштаб"},
    en:{offers:"Special offers",all:"All tickets",onePlusOne:"1 + 1",quantity:"Ticket quantity",selected:"Selected",continue:"Continue",price:"Price",together:"Only seats where the selected number of guests can sit together are shown",noSeats:"No adjacent seats match this price range",zoomReset:"Reset zoom"},
    he:{offers:"הצעות מיוחדות",all:"כל הכרטיסים",onePlusOne:"1 + 1",quantity:"כמות כרטיסים",selected:"נבחרו",continue:"המשך",price:"מחיר",together:"מוצגים רק מקומות שבהם מספר האורחים שנבחר יכול לשבת יחד",noSeats:"אין מקומות צמודים בטווח המחירים שנבחר",zoomReset:"איפוס זום"},
  }[locale];

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(event.code!=="Space")return;
      const target=event.target as HTMLElement|null;
      if(target?.closest("input,select,textarea,button,a"))return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const up=(event:KeyboardEvent)=>{if(event.code==="Space")setSpaceHeld(false);};
    window.addEventListener("keydown",down,{passive:false});
    window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);};
  },[]);

  const availableCategories=allocation?.type==="CATEGORY"?categories.filter(item=>item.id===allocation.categoryId):categories;
  const availableObjects=(allocation?.type==="TABLE"?objects.filter(item=>item.id===allocation.tableId||!sellableTypes.has(item.objectType)):objects).filter(item=>!isInternalObject(item));
  const buyerPrice=(minor:number)=>calculateServiceFee(minor,feeTerms).buyerTotalMinor;
  const categoryPrice=useMemo(()=>new Map(availableCategories.map(item=>[item.id,buyerPrice(item.priceMinor)])),[availableCategories,feeTerms]);
  const sortedPrices=useMemo(()=>[...new Set(availableCategories.map(item=>categoryPrice.get(item.id)??0))].sort((a,b)=>a-b),[availableCategories,categoryPrice]);
  const [minIndex,setMinIndex]=useState(0);
  const [maxIndex,setMaxIndex]=useState(Math.max(0,sortedPrices.length-1));
  const [qty,setQty]=useState(Math.max(1,Math.min(10,initialQty)));
  const [offer,setOffer]=useState<OfferFilter>("ALL");
  const [offerOpen,setOfferOpen]=useState(false);
  const [zoom,setZoom]=useState(55);
  const [selectedSeatIds,setSelectedSeatIds]=useState<string[]>([]);
  const [wholeObjectId,setWholeObjectId]=useState<string|null>(allocation?.type==="TABLE"?allocation.tableId:null);
  const hasOnePlusOne=availableCategories.some(item=>item.salesStrategy==="BUY_ONE_GET_ONE");
  const minPrice=sortedPrices[minIndex]??0;
  const maxPrice=sortedPrices[maxIndex]??minPrice;
  const allowedCategoryIds=useMemo(()=>new Set(availableCategories.filter(item=>item.salesStrategy===offer||offer==="ALL").filter(item=>{const price=categoryPrice.get(item.id)??-1;return price>=minPrice&&price<=maxPrice;}).map(item=>item.id)),[availableCategories,offer,categoryPrice,minPrice,maxPrice]);

  const groupsByObject=useMemo(()=>{
    const map=new Map<string,string[][]>();
    for(const object of availableObjects){
      if(!sellableTypes.has(object.objectType)||object.reserved)continue;
      const groups=validGroups(object,qty,(seat)=>{const categoryId=seat.categoryId??object.categoryId;if(seat.status!=="AVAILABLE"||!categoryId||!allowedCategoryIds.has(categoryId))return false;return true;});
      if(groups.length)map.set(object.id,groups);
    }
    return map;
  },[availableObjects,qty,allowedCategoryIds]);
  const eligibleSeatIds=useMemo(()=>new Set([...groupsByObject.values()].flat(2)),[groupsByObject]);
  const selectedSeats=objects.flatMap(item=>item.seatItems).filter(seat=>selectedSeatIds.includes(seat.id));
  const wholeObject=objects.find(item=>item.id===wholeObjectId);
  const selectionComplete=Boolean(wholeObject)||selectedSeatIds.length===qty;
  const rawSubtotal=wholeObject?(allocation?.type==="TABLE"&&allocation.customPriceMinor!==null?allocation.customPriceMinor:(categories.find(item=>item.id===wholeObject.categoryId)?.priceMinor??wholeObject.priceMinor)):selectedSeats.reduce((sum,seat)=>sum+(categories.find(item=>item.id===seat.categoryId)?.priceMinor??0),0);
  const total=selectionComplete?buyerPrice(rawSubtotal):0;
  const scale=zoom/100;

  function clearSelection(){if(allocation?.type==="TABLE")return;setSelectedSeatIds([]);setWholeObjectId(null);}
  function changeQty(delta:number){const step=offer==="BUY_ONE_GET_ONE"?2:1;setQty(value=>Math.max(offer==="BUY_ONE_GET_ONE"?2:1,Math.min(10,value+delta*step)));clearSelection();}
  function chooseOffer(next:OfferFilter){setOffer(next);setOfferOpen(false);if(next==="BUY_ONE_GET_ONE")setQty(value=>value<2?2:value%2===0?value:Math.min(10,value+1));clearSelection();}
  function chooseSeat(object:MapObject,seat:MapSeat){
    if(!eligibleSeatIds.has(seat.id)||seat.status!=="AVAILABLE")return;
    setWholeObjectId(null);
    setSelectedSeatIds(current=>{
      if(current.includes(seat.id))return current.filter(id=>id!==seat.id);
      const sameObject=current.every(id=>object.seatItems.some(item=>item.id===id));
      const base=sameObject?current:[];
      const candidate=[...base,seat.id];
      if(candidate.length>qty)return base;
      const possible=(groupsByObject.get(object.id)??[]).some(group=>candidate.every(id=>group.includes(id)));
      return possible?candidate:base.length?base:[seat.id];
    });
  }
  function go(){
    if(!selectionComplete)return;
    const categoryId=wholeObject?.categoryId??selectedSeats.find(seat=>seat.categoryId)?.categoryId;
    if(!categoryId)return;
    const quantity=wholeObject?wholeObject.seats:selectedSeatIds.length;
    const query=new URLSearchParams({eventId,categoryId,quantity:String(quantity),locale});
    if(wholeObject)query.set("tableId",wholeObject.id);
    if(selectedSeatIds.length)query.set("seatIds",selectedSeatIds.join(","));
    if(referralCode)query.set("ref",referralCode);
    router.push(`/checkout?${query}`);
  }

  function startPan(event:React.PointerEvent<HTMLDivElement>){
    if(event.button!==0)return;
    const target=event.target as HTMLElement;
    if(!spaceHeld&&target.closest("button,input,select,a"))return;
    const viewport=viewportRef.current;
    if(!viewport)return;
    panRef.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);
    setPanning(true);
    event.preventDefault();
  }
  function movePan(event:React.PointerEvent<HTMLDivElement>){
    if(!panning||panRef.current.pointerId!==event.pointerId)return;
    const viewport=viewportRef.current;
    if(!viewport)return;
    viewport.scrollLeft=panRef.current.left-(event.clientX-panRef.current.x);
    viewport.scrollTop=panRef.current.top-(event.clientY-panRef.current.y);
  }
  function endPan(event:React.PointerEvent<HTMLDivElement>){
    if(panRef.current.pointerId!==event.pointerId)return;
    const viewport=viewportRef.current;
    if(viewport?.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
    panRef.current.pointerId=-1;
    setPanning(false);
  }

  const rangeDenominator=Math.max(1,sortedPrices.length-1);
  const activeLeft=minIndex/rangeDenominator*100;
  const activeWidth=(maxIndex-minIndex)/rangeDenominator*100;
  const offerLabel=offer==="BUY_ONE_GET_ONE"?local.onePlusOne:local.offers;

  return <main className={styles.page}>
    <div className={styles.layout}>
      <section className={styles.mapSide}>
        <div className={styles.priceRail}>
          <div className={styles.priceStops}>{sortedPrices.map((price,index)=>{const category=availableCategories.find(item=>(categoryPrice.get(item.id)??0)===price);const active=index>=minIndex&&index<=maxIndex;return <button type="button" key={`${price}-${index}`} className={active?styles.priceActive:""} onClick={()=>{if(index<minIndex)setMinIndex(index);else if(index>maxIndex)setMaxIndex(index);}}><b style={{color:category?.colorHex??"#64748b"}}>{money(price,"ILS",locale)}</b></button>;})}</div>
          <div className={styles.rangeWrap}>
            <div className={styles.rangeBase}/><div className={styles.rangeActive} style={{left:`${activeLeft}%`,width:`${activeWidth}%`}}/>
            <input aria-label="minimum ticket price" className={styles.range} type="range" min="0" max={Math.max(0,sortedPrices.length-1)} value={minIndex} onChange={event=>{const next=Math.min(Number(event.target.value),maxIndex);setMinIndex(next);clearSelection();}}/>
            <input aria-label="maximum ticket price" className={`${styles.range} ${styles.rangeMax}`} type="range" min="0" max={Math.max(0,sortedPrices.length-1)} value={maxIndex} onChange={event=>{const next=Math.max(Number(event.target.value),minIndex);setMaxIndex(next);clearSelection();}}/>
          </div>
        </div>
        <div ref={viewportRef} className={`${styles.mapViewport} ${spaceHeld?styles.panReady:""} ${panning?styles.panning:""}`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
          <div className={styles.zoom}><button type="button" onClick={()=>setZoom(value=>Math.min(125,value+10))}><Plus size={20}/></button><button type="button" title={local.zoomReset} onClick={()=>setZoom(55)}><RotateCcw size={18}/></button><button type="button" onClick={()=>setZoom(value=>Math.max(35,value-10))}><Minus size={20}/></button></div>
          <div className={styles.mapFrame} style={{width:WORLD_WIDTH*scale,height:WORLD_HEIGHT*scale}}><div className={styles.world} style={{width:WORLD_WIDTH,height:WORLD_HEIGHT,transform:`scale(${scale})`}}>
            {availableObjects.map(object=>{
              const isSellable=sellableTypes.has(object.objectType);
              const wholeCategoryId=object.categoryId;
              const wholeVisible=object.priceMode!=="WHOLE_TABLE"||Boolean(wholeCategoryId&&allowedCategoryIds.has(wholeCategoryId)&&!object.reserved);
              const selectedWhole=wholeObjectId===object.id;
              return <div key={object.id} className={`${styles.object} ${object.objectType==="ZONE"?styles.zoneLayer:""}`} style={{left:`${object.x}%`,top:`${object.y}%`,width:object.width,height:object.height,transform:`translate(-50%,-50%) rotate(${object.rotation}deg)`,opacity:isSellable&&!wholeVisible?.12:1,pointerEvents:isSellable&&!wholeVisible?"none":undefined}}>
                {!isSellable?<div className={`${styles.decoration} ${styles[`decoration${object.objectType}`]??""}`}><strong>{object.label}</strong></div>:<div className={`${styles.furniture} ${styles[`furniture${object.objectType}`]??""}`} onClick={()=>{if(object.priceMode!=="WHOLE_TABLE"||object.reserved||!wholeVisible)return;setSelectedSeatIds([]);setWholeObjectId(selectedWhole?null:object.id);}}>
                  <div className={`${styles.core} ${selectedWhole?styles.coreSelected:""}`}><strong>{object.label}</strong></div>
                  {object.objectType==="ROW"?<div className={styles.rowSeats}>{object.seatItems.map(seat=>{const categoryId=seat.categoryId??object.categoryId;const color=categories.find(item=>item.id===categoryId)?.colorHex??"#e3e7eb";const eligible=eligibleSeatIds.has(seat.id);return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status==="AVAILABLE"?color:"#e3e7eb"} selected={selectedSeatIds.includes(seat.id)} eligible={eligible} disabled={object.priceMode==="WHOLE_TABLE"||!eligible} onClick={()=>chooseSeat(object,seat)}/>;})}</div>:object.seatItems.map(seat=>{const categoryId=seat.categoryId??object.categoryId;const color=categories.find(item=>item.id===categoryId)?.colorHex??"#e3e7eb";const eligible=eligibleSeatIds.has(seat.id);return <SeatDot key={seat.id} seat={seat} object={object} color={seat.status==="AVAILABLE"?color:"#e3e7eb"} selected={selectedSeatIds.includes(seat.id)} eligible={eligible} disabled={object.priceMode==="WHOLE_TABLE"||!eligible} onClick={()=>chooseSeat(object,seat)}/>;})}
                </div>}
              </div>;
            })}
          </div></div>
          {eligibleSeatIds.size===0&&!wholeObject&&<div className={styles.noSeats}>{local.noSeats}</div>}
        </div>
      </section>
      <aside className={styles.sidebar}>
        <div className={styles.eventInfo}>
          <img src={posterUrl} alt={title}/>
          <div className={styles.eventDetails}>
            <h1>{title}</h1>
            <p>{venueName}</p>
            <div className={styles.eventPills}>
              <div className={styles.offerWrap}><button type="button" className={styles.offerButton} onClick={()=>setOfferOpen(value=>!value)}><Menu size={17}/><span>{offerLabel}</span></button>{offerOpen&&<div className={styles.offerMenu}><button type="button" className={offer==="ALL"?styles.offerSelected:""} onClick={()=>chooseOffer("ALL")}>{local.all}</button>{hasOnePlusOne&&<button type="button" className={offer==="BUY_ONE_GET_ONE"?styles.offerSelected:""} onClick={()=>chooseOffer("BUY_ONE_GET_ONE")}>{local.onePlusOne}</button>}</div>}</div>
              <div className={styles.quantity} aria-label={local.quantity}><button type="button" onClick={()=>changeQty(-1)}><Minus size={16}/></button><strong>{qty}</strong><button type="button" onClick={()=>changeQty(1)}><Plus size={16}/></button></div>
            </div>
          </div>
        </div>
        <p className={styles.together}>{local.together}</p>
        <div className={styles.summary}><span>{local.selected}</span><strong>{wholeObject?wholeObject.seats:selectedSeatIds.length} / {wholeObject?wholeObject.seats:qty}</strong></div>
        {selectionComplete&&<div className={styles.total}><span>{local.price}</span><strong>{money(total,"ILS",locale)}</strong></div>}
        <button type="button" className={styles.continue} disabled={!selectionComplete} onClick={go}>{local.continue}</button>
      </aside>
    </div>
  </main>;
}
