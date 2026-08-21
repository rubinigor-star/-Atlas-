import fs from 'node:fs';

// Client-side registration remains as a harmless fallback, but ownership must
// primarily be written by the checkout API itself. That makes returning from
// HYP/back-forward cache/tab close independent of client timing.
const clientPath='src/components/checkout-form.tsx';
let client=fs.readFileSync(clientPath,'utf8');
const clientAnchor='if(!details.ok)throw new Error(text.detailsError);window.location.assign(data.paymentUrl);';
const clientReplacement='if(!details.ok)throw new Error(text.detailsError);await fetch("/api/cart/hold/checkout-owner",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:data.orderId})}).catch(()=>undefined);window.location.assign(data.paymentUrl);';
if(!client.includes(clientReplacement)){
  if(!client.includes(clientAnchor)) throw new Error('Checkout redirect anchor not found for cart ownership registration');
  client=client.replace(clientAnchor,clientReplacement);
  fs.writeFileSync(clientPath,client);
}

const serverPath='src/app/api/checkout/route.ts';
let server=fs.readFileSync(serverPath,'utf8');

const ownerImport='import { rememberPendingCheckoutOwner } from "@/lib/cart-checkout-owner";';
if(!server.includes(ownerImport)){
  const importAnchor='import { getActiveGuestSeatLocks, isGuestListPromoter } from "@/lib/guest-links";';
  if(!server.includes(importAnchor)) throw new Error('Checkout API guest-links import anchor not found');
  server=server.replace(importAnchor,`${importAnchor}\n${ownerImport}`);
}

if(!server.includes('async function rememberCheckoutOwner(')){
  const helperAnchor='function launchUrl(paymentUrl:string){return `/payments/hyp/launch?target=${encodeURIComponent(paymentUrl)}`;}';
  if(!server.includes(helperAnchor)) throw new Error('Checkout API launchUrl anchor not found');
  const helper=`${helperAnchor}\nfunction checkoutCartSessionId(req:Request){const raw=req.headers.get("cookie")||"";for(const part of raw.split(";")){const [key,...rest]=part.trim().split("=");if(key==="atlas_cart_session")return decodeURIComponent(rest.join("="));}return "";}\nasync function rememberCheckoutOwner(req:Request,orderPublicId:string){const sessionId=checkoutCartSessionId(req);if(!sessionId)return;await rememberPendingCheckoutOwner({sessionId,orderPublicId}).catch(()=>undefined);}`;
  server=server.replace(helperAnchor,helper);
}

const existingAnchor='if(existing.status==="PENDING"){const persistedSalesMode=';
if(!server.includes('if(existing.status==="PENDING"){await rememberCheckoutOwner(req,existing.publicId);const persistedSalesMode=')){
  if(!server.includes(existingAnchor)) throw new Error('Existing pending checkout anchor not found');
  server=server.replace(existingAnchor,'if(existing.status==="PENDING"){await rememberCheckoutOwner(req,existing.publicId);const persistedSalesMode=');
}

const createdAnchor='await linkAbandonedCheckoutToOrder(input.abandonToken,result.order.id);const paymentUrl=';
if(!server.includes('await linkAbandonedCheckoutToOrder(input.abandonToken,result.order.id);await rememberCheckoutOwner(req,result.order.publicId);const paymentUrl=')){
  if(!server.includes(createdAnchor)) throw new Error('New checkout ownership anchor not found');
  server=server.replace(createdAnchor,'await linkAbandonedCheckoutToOrder(input.abandonToken,result.order.id);await rememberCheckoutOwner(req,result.order.publicId);const paymentUrl=');
}

fs.writeFileSync(serverPath,server);
console.log('Checkout ownership is registered server-side and reinforced client-side before HYP redirect.');
