import { randomBytes } from "node:crypto";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { db } from "@/lib/db";
import { parseTicketDesign } from "@/lib/ticket-template";
import { getTicketLocale, localizedStatus, ticketCopy } from "@/lib/ticket-language";
import { atlasLogoSvg } from "@/lib/atlas-brand";

export function walletConfigured(){return Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID&&process.env.APPLE_WALLET_TEAM_ID&&process.env.APPLE_WALLET_SIGNER_CERT_BASE64&&process.env.APPLE_WALLET_SIGNER_KEY_BASE64&&process.env.APPLE_WALLET_WWDR_CERT_BASE64)}
function hexRgb(hex:string){const clean=hex.replace("#","");return [0,2,4].map(index=>Number.parseInt(clean.slice(index,index+2),16)) as [number,number,number]}
function rgbColor(hex:string){const [r,g,b]=hexRgb(hex);return `rgb(${r}, ${g}, ${b})`}

async function officialWalletAssets(backgroundColor:string,accentColor:string){
  const dark=backgroundColor.toUpperCase()==="#081426";
  const svg=Buffer.from(atlasLogoSvg({dark,width:904,height:257}));
  const logo=await sharp(svg).resize({width:300,height:84,fit:"contain"}).png().toBuffer();
  const icon=await sharp({create:{width:174,height:174,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:await sharp(svg).resize({width:154,height:44,fit:"contain"}).png().toBuffer(),gravity:"center"}])
    .png().toBuffer();
  const [br,bg,bb]=hexRgb(backgroundColor);
  const [ar,ag,ab]=hexRgb(accentColor);
  const strip=await sharp({
    create:{width:750,height:246,channels:4,background:{r:br,g:bg,b:bb,alpha:1}},
  })
    .composite([{
      input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="246"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="rgb(${br},${bg},${bb})"/><stop offset="1" stop-color="rgb(${ar},${ag},${ab})" stop-opacity=".55"/></linearGradient></defs><rect width="750" height="246" fill="url(#g)"/><circle cx="650" cy="40" r="170" fill="rgb(${ar},${ag},${ab})" fill-opacity=".16"/></svg>`),
      gravity:"center",
    }])
    .png().toBuffer();
  return {icon,logo,strip};
}

export async function ensureWalletIdentity(ticketId:string){const current=await db.ticket.findUniqueOrThrow({where:{id:ticketId}});if(current.walletSerial&&current.walletAuthToken)return current;return db.ticket.update({where:{id:ticketId},data:{walletSerial:current.walletSerial??`ATL-${randomBytes(8).toString("hex")}`,walletAuthToken:current.walletAuthToken??randomBytes(24).toString("base64url"),walletUpdatedAt:new Date()}})}

export async function buildWalletPass(ticketId:string){
  if(!walletConfigured())throw new Error("Apple Wallet не подключён: добавьте Pass Type ID и сертификаты");
  const identity=await ensureWalletIdentity(ticketId);
  const ticket=await db.ticket.findUniqueOrThrow({where:{id:ticketId},include:{category:true,order:{include:{event:{include:{venue:true,ticketTemplate:true}}}}}});
  const event=ticket.order.event;
  const design=parseTicketDesign(event.ticketTemplate);
  const locale=getTicketLocale(design,ticket.order.communicationLocale);
  const copy=ticketCopy[locale];
  const publicAppUrl=(process.env.PUBLIC_APP_URL||"https://www.atlas-one.co").replace(/\/$/,"");
  const webServiceURL=process.env.APPLE_WALLET_WEB_SERVICE_URL||`${publicAppUrl}/api/wallet`;
  const assets=await officialWalletAssets(design.backgroundColor,design.accentColor);
  const pass=new PKPass({"icon.png":assets.icon,"icon@2x.png":assets.icon,"logo.png":assets.logo,"logo@2x.png":assets.logo,"strip.png":assets.strip,"strip@2x.png":assets.strip},{wwdr:Buffer.from(process.env.APPLE_WALLET_WWDR_CERT_BASE64!,"base64"),signerCert:Buffer.from(process.env.APPLE_WALLET_SIGNER_CERT_BASE64!,"base64"),signerKey:Buffer.from(process.env.APPLE_WALLET_SIGNER_KEY_BASE64!,"base64"),signerKeyPassphrase:process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE},{formatVersion:1,serialNumber:identity.walletSerial!,description:`${copy.ticket}: ${event.title}`,organizationName:"Atlas One",passTypeIdentifier:process.env.APPLE_WALLET_PASS_TYPE_ID!,teamIdentifier:process.env.APPLE_WALLET_TEAM_ID!,logoText:"Atlas One",backgroundColor:rgbColor(design.backgroundColor),foregroundColor:rgbColor(design.textColor),labelColor:rgbColor(design.accentColor),webServiceURL,authenticationToken:identity.walletAuthToken!,voided:ticket.status==="CANCELLED",groupingIdentifier:ticket.order.publicId});
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
