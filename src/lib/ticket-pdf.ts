import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template";
import { defaultTicketDesign, resolveTicketText } from "@/lib/ticket-template";
import { drawMultilingualText, multilingualWidth, type PdfFontSet } from "@/lib/pdf-multilingual";

export type TicketPdfInput = { eventTitle:string; startsAt:Date; venueName:string; venueCity:string; venueAddress:string; posterUrl?:string|null; holderName:string; categoryName:string; orderNumber:string; ticketCode:string; ticketStatus?:"VALID"|"USED"|"CANCELLED"|"REFUNDED"; design?:TicketDesign };
const PAGE_WIDTH=420, PAGE_HEIGHT=680;
const FONT_FILES = {
  latinRegular: path.join(process.cwd(),"node_modules","@fontsource","noto-sans","files","noto-sans-latin-400-normal.woff"),
  latinBold: path.join(process.cwd(),"node_modules","@fontsource","noto-sans","files","noto-sans-latin-700-normal.woff"),
  cyrillicRegular: path.join(process.cwd(),"node_modules","@fontsource","noto-sans","files","noto-sans-cyrillic-400-normal.woff"),
  cyrillicBold: path.join(process.cwd(),"node_modules","@fontsource","noto-sans","files","noto-sans-cyrillic-700-normal.woff"),
  hebrew: path.join(process.cwd(),"node_modules","@fontsource","noto-sans-hebrew","files","noto-sans-hebrew-hebrew-400-normal.woff"),
} as const;
const fontBytesCache: Partial<Record<keyof typeof FONT_FILES, Promise<Uint8Array>>> = {};

function hex(value:string){const clean=/^#[0-9a-f]{6}$/i.test(value)?value.slice(1):"000000";return rgb(parseInt(clean.slice(0,2),16)/255,parseInt(clean.slice(2,4),16)/255,parseInt(clean.slice(4,6),16)/255)}
function containsHebrew(value:string){return /[\u0590-\u05FF]/.test(value)}
function clean(value:string){return value.replace(/\s+/g," ").trim()}
function clip(value:string,max=90){const text=clean(value);return text.length>max?`${text.slice(0,max-1)}…`:text}
async function loadFontFile(filePath:string){return new Uint8Array(await readFile(filePath))}
function getFontBytes(key:keyof typeof FONT_FILES){if(!fontBytesCache[key])fontBytesCache[key]=loadFontFile(FONT_FILES[key]);return fontBytesCache[key]!}
async function loadOfficialAtlasLogo(pdf:PDFDocument){const logo=await loadImage(pdf,"/branding/atlas-one-logo.jpg");if(!logo)throw new Error("Official Atlas One logo could not be loaded");return logo}
async function loadImage(pdf:PDFDocument,url?:string|null):Promise<PDFImage|null>{if(!url)return null;try{const absolute=url.startsWith("http")?url:`${(process.env.NEXT_PUBLIC_APP_URL||"https://www.atlas-one.co").replace(/\/$/,"")}/${url.replace(/^\/+/,"")}`;const response=await fetch(absolute,{signal:AbortSignal.timeout(8000)});if(!response.ok)return null;const bytes=new Uint8Array(await response.arrayBuffer());const type=response.headers.get("content-type")||"";return type.includes("png")||absolute.toLowerCase().endsWith(".png")?pdf.embedPng(bytes):pdf.embedJpg(bytes)}catch{return null}}
function fit(fonts:PdfFontSet,value:string,preferred:number,maxWidth:number,bold:boolean){let size=preferred;while(size>6&&multilingualWidth(value,size,fonts,bold)>maxWidth)size-=0.5;return size}
function drawTextElement(page:PDFPage,fonts:PdfFontSet,element:TicketElement,value:string){const text=clip(value);if(!text)return;const x0=PAGE_WIDTH*element.x/100,top=PAGE_HEIGHT*element.y/100,width=PAGE_WIDTH*element.width/100,height=PAGE_HEIGHT*element.height/100;const size=fit(fonts,text,Math.max(7,element.fontSize*0.72),width,element.bold);const measured=multilingualWidth(text,size,fonts,element.bold);let x=x0;if(element.align==="center")x=x0+(width-measured)/2;if(element.align==="right"||containsHebrew(value))x=x0+width-measured;const y=PAGE_HEIGHT-top-Math.min(height,size*1.25);drawMultilingualText({page,value:text,x:Math.max(0,x),y:Math.max(0,y),size,color:hex(element.color),fonts,bold:element.bold,maxWidth:width})}
async function drawTicketPage(pdf:PDFDocument,fonts:PdfFontSet,ticket:TicketPdfInput){const design=ticket.design||defaultTicketDesign();const page=pdf.addPage([PAGE_WIDTH,PAGE_HEIGHT]);page.drawRectangle({x:0,y:0,width:PAGE_WIDTH,height:PAGE_HEIGHT,color:hex(design.backgroundColor)});const background=await loadImage(pdf,design.backgroundUrl||ticket.posterUrl);if(background&&design.backgroundUrl)page.drawImage(background,{x:0,y:0,width:PAGE_WIDTH,height:PAGE_HEIGHT,opacity:.35});page.drawRectangle({x:0,y:PAGE_HEIGHT-6,width:PAGE_WIDTH,height:6,color:hex(design.accentColor)});const customLogo=await loadImage(pdf,design.logoUrl);const logo=customLogo||await loadOfficialAtlasLogo(pdf);const ratio=logo.width/logo.height,logoWidth=145,logoHeight=Math.min(54,logoWidth/ratio);page.drawImage(logo,{x:28,y:PAGE_HEIGHT-28-logoHeight,width:logoWidth,height:logoHeight});const qrBytes=await QRCode.toBuffer(ticket.ticketCode,{width:1000,margin:2,errorCorrectionLevel:"Q"});const qr=await pdf.embedPng(qrBytes);const data={eventTitle:ticket.eventTitle,startsAt:ticket.startsAt,venue:ticket.venueName,address:[ticket.venueCity,ticket.venueAddress].filter(Boolean).join(", "),customerName:ticket.holderName,ticketType:ticket.categoryName,orderNumber:ticket.orderNumber,ticketCode:ticket.ticketCode};for(const element of design.elements.filter(item=>!item.hidden)){const x=PAGE_WIDTH*element.x/100,top=PAGE_HEIGHT*element.y/100,width=PAGE_WIDTH*element.width/100,height=PAGE_HEIGHT*element.height/100,y=PAGE_HEIGHT-top-height;if(element.binding==="QR"){page.drawRectangle({x,y,width,height,color:rgb(1,1,1),borderColor:hex("#D8E0EA"),borderWidth:1});const padding=Math.min(7,width*.05,height*.05);page.drawImage(qr,{x:x+padding,y:y+padding,width:width-padding*2,height:height-padding*2})}else if(element.binding==="IMAGE"){const image=await loadImage(pdf,element.content);if(image)page.drawImage(image,{x,y,width,height})}else drawTextElement(page,fonts,element,resolveTicketText(element,data))}const footerColor=design.backgroundColor.toLowerCase()==="#081426"?"#B5C0CF":"#667085";drawMultilingualText({page,value:"Powered by Atlas One · atlas-one.co",x:118,y:10,size:8,color:hex(footerColor),fonts})}
export async function generateTicketPdf(tickets:TicketPdfInput[]){if(!tickets.length)throw new Error("Для генерации PDF не переданы билеты");const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const [latinRegular,latinBold,cyrillicRegular,cyrillicBold,hebrew]=await Promise.all([
  pdf.embedFont(await getFontBytes("latinRegular"),{subset:true}),
  pdf.embedFont(await getFontBytes("latinBold"),{subset:true}),
  pdf.embedFont(await getFontBytes("cyrillicRegular"),{subset:true}),
  pdf.embedFont(await getFontBytes("cyrillicBold"),{subset:true}),
  pdf.embedFont(await getFontBytes("hebrew"),{subset:true}),
]);const fonts:PdfFontSet={latinRegular,latinBold,cyrillicRegular,cyrillicBold,hebrew};pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);pdf.setAuthor("Atlas One");for(const ticket of tickets)await drawTicketPage(pdf,fonts,ticket);return Buffer.from(await pdf.save({useObjectStreams:false,addDefaultPage:false}))}
