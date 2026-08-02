import { randomBytes } from "node:crypto";
import { PKPass } from "passkit-generator";
import { PNG } from "pngjs";
import { db } from "@/lib/db";
import { parseTicketDesign } from "@/lib/ticket-template";
import { getTicketLocale, localizedStatus, ticketCopy } from "@/lib/ticket-language";

export function walletConfigured(){return Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID&&process.env.APPLE_WALLET_TEAM_ID&&process.env.APPLE_WALLET_SIGNER_CERT_BASE64&&process.env.APPLE_WALLET_SIGNER_KEY_BASE64&&process.env.APPLE_WALLET_WWDR_CERT_BASE64)}
function hexRgb(hex:string){const clean=hex.replace("#","");return [0,2,4].map(index=>Number.parseInt(clean.slice(index,index+2),16)) as [number,number,number]}
function rgbColor(hex:string){const [r,g,b]=hexRgb(hex);return `rgb(${r}, ${g}, ${b})`}
function setPixel(png:PNG,x:number,y:number,color:[number,number,number,number]){if(x<0||y<0||x>=png.width||y>=png.height)return;const i=(png.width*y+x)<<2;png.data[i]=color[0];png.data[i+1]=color[1];png.data[i+2]=color[2];png.data[i+3]=color[3]}
function atlasIcon(accentHex:string,size=174){const png=new PNG({width:size,height:size});const navy:[number,number,number,number]=[8,20,38,255];const white:[number,number,number,number]=[255,255,255,255];const [ar,ag,ab]=hexRgb(accentHex);const accent:[number,number,number,number]=[ar,ag,ab,255];const radius=Math.round(size*.23);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=Math.max(radius-x,0,x-(size-1-radius));const dy=Math.max(radius-y,0,y-(size-1-radius));if(dx*dx+dy*dy<=radius*radius)setPixel(png,x,y,navy)}const cx=size/2;const top=size*.22;const bottom=size*.76;for(let y=Math.floor(top);y<bottom;y++){const t=(y-top)/(bottom-top);const half=size*(.08+.19*t);const inner=Math.max(0,half-size*.075);for(let x=Math.floor(cx-half);x<=Math.ceil(cx+half);x++){if(Math.abs(x-cx)>=inner)setPixel(png,x,y,white)}}for(let y=Math.floor(size*.55);y<Math.floor(size*.63);y++)for(let x=Math.floor(size*.39);x<Math.floor(size*.61);x++)setPixel(png,x,y,white);const dotR=size*.075;const dotX=size*.77;const dotY=size*.23;for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x-dotX)**2+(y-dotY)**2<=dotR**2)setPixel(png,x,y,accent);return PNG.sync.write(png)}
function atlasStrip(backgroundHex:string,accentHex:string){const png=new PNG({width:750,height:246});const bg=hexRgb(backgroundHex),ac=hexRgb(accentHex);for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){const t=x/(png.width-1);const i=(png.width*y+x)<<2;png.data[i]=Math.round(bg[0]*(1-t)+ac[0]*t);png.data[i+1]=Math.round(bg[1]*(1-t)+ac[1]*t);png.data[i+2]=Math.round(bg[2]*(1-t)+ac[2]*t);png.data[i+3]=255}return PNG.sync.write(png)}

export async function ensureWalletIdentity(ticketId:string){const current=await db.ticket.findUniqueOrThrow({where:{id:ticketId}});if(current.walletSerial&&current.walletAuthToken)return current;return db.ticket.update({where:{id:ticketId},data:{walletSerial:current.walletSerial??`ATL-${randomBytes(8).toString("hex")}`,walletAuthToken:current.walletAuthToken??randomBytes(24).toString("base64url"),walletUpdatedAt:new Date()}})}

export async function buildWalletPass(ticketId:string){
  if(!walletConfigured())throw new Error("Apple Wallet не подключён: добавьте Pass Type ID и сертификаты");
  const identity=await ensureWalletIdentity(ticketId);
  const ticket=await db.ticket.findUniqueOrThrow({where:{id:ticketId},include:{category:true,order:{include:{event:{include:{venue:true,ticketTemplate:true}}}}}});
  const event=ticket.order.event;
  const design=parseTicketDesign(event.ticketTemplate);
  const locale=getTicketLocale(design);
  const copy=ticketCopy[locale];
  const webServiceURL=process.env.APPLE_WALLET_WEB_SERVICE_URL||`${process.env.NEXT_PUBLIC_APP_URL}/api/wallet`;
  const icon=atlasIcon(design.accentColor,174);
  const logo=atlasIcon(design.accentColor,120);
  const strip=atlasStrip(design.backgroundColor,design.accentColor);
  const pass=new PKPass({"icon.png":icon,"icon@2x.png":icon,"logo.png":logo,"logo@2x.png":logo,"strip.png":strip,"strip@2x.png":strip},{wwdr:Buffer.from(process.env.APPLE_WALLET_WWDR_CERT_BASE64!,"base64"),signerCert:Buffer.from(process.env.APPLE_WALLET_SIGNER_CERT_BASE64!,"base64"),signerKey:Buffer.from(process.env.APPLE_WALLET_SIGNER_KEY_BASE64!,"base64"),signerKeyPassphrase:process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE},{formatVersion:1,serialNumber:identity.walletSerial!,description:`${copy.ticket}: ${event.title}`,organizationName:"Atlas One",passTypeIdentifier:process.env.APPLE_WALLET_PASS_TYPE_ID!,teamIdentifier:process.env.APPLE_WALLET_TEAM_ID!,logoText:"ATLAS ONE",backgroundColor:rgbColor(design.backgroundColor),foregroundColor:rgbColor(design.textColor),labelColor:rgbColor(design.accentColor),webServiceURL,authenticationToken:identity.walletAuthToken!,voided:ticket.status==="CANCELLED",groupingIdentifier:ticket.order.publicId});
  pass.type="eventTicket";
  pass.primaryFields.push({key:"event",label:copy.event,value:event.title});
  pass.secondaryFields.push({key:"date",label:copy.date,value:event.startsAt.toISOString(),dateStyle:"PKDateStyleMedium",timeStyle:"PKDateStyleShort",changeMessage:locale==="he"?"תאריך האירוע השתנה: %@":locale==="en"?"Event date changed: %@":"Дата мероприятия изменена: %@"});
  pass.auxiliaryFields.push({key:"ticket",label:copy.ticket,value:ticket.category.name},{key:"holder",label:copy.guest,value:ticket.holderName},{key:"status",label:copy.status,value:localizedStatus(ticket.status,locale)});
  pass.backFields.push({key:"venue",label:copy.venue,value:`${event.venue.name}, ${event.venue.address}`,changeMessage:locale==="he"?"מיקום האירוע השתנה: %@":locale==="en"?"Venue changed: %@":"Площадка изменена: %@"},{key:"order",label:copy.order,value:ticket.order.publicId},{key:"code",label:copy.code,value:ticket.publicCode},{key:"support",label:copy.support,value:copy.singleUse});
  pass.setBarcodes({format:"PKBarcodeFormatQR",message:ticket.publicCode,messageEncoding:"iso-8859-1",altText:ticket.publicCode.slice(0,18)});
  pass.setRelevantDate(event.startsAt);
  pass.setExpirationDate(new Date(event.startsAt.getTime()+18*60*60*1000));
  return pass.getAsBuffer();
}

export function walletAuthorization(request:Request,token:string|null){return Boolean(token&&request.headers.get("authorization")===`ApplePass ${token}`)}
