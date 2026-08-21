import fs from 'node:fs';

const path='src/app/events/[slug]/seats/page.tsx';
let src=fs.readFileSync(path,'utf8');

const importAnchor='import { CART_SESSION_COOKIE, cartHoldOrderId, getHeldInventory } from "@/lib/cart-hold";';
const importReplacement='import { CART_SESSION_COOKIE, cartHoldOrderId, getHeldInventory } from "@/lib/cart-hold";\nimport { getPendingCheckoutOwner } from "@/lib/cart-checkout-owner";';
if(!src.includes('import { getPendingCheckoutOwner } from "@/lib/cart-checkout-owner";')){
  if(!src.includes(importAnchor)) throw new Error('Seat page cart-hold import anchor not found');
  src=src.replace(importAnchor,importReplacement);
}

const heldAnchor='const sessionId=store.get(CART_SESSION_COOKIE)?.value||"";\n  const held=await getHeldInventory({categoryIds:categories.map(category=>category.id),excludeOrderId:sessionId?cartHoldOrderId(sessionId,event.id):undefined});';
const heldReplacement='const sessionId=store.get(CART_SESSION_COOKIE)?.value||"";\n  // A buyer returning from HYP/checkout may already have a PENDING order whose\n  // reservation contains the exact same seats. That order belongs to this cart\n  // session and must not be rendered as a foreign reservation on the first SSR.\n  const checkoutOwner=sessionId?await getPendingCheckoutOwner(sessionId,event.id).catch(()=>null):null;\n  const ownedReservationIds=sessionId?[cartHoldOrderId(sessionId,event.id),...(checkoutOwner?.orderId?[checkoutOwner.orderId]:[])]:[];\n  const held=await getHeldInventory({categoryIds:categories.map(category=>category.id),excludeOrderIds:ownedReservationIds});';
const ownershipAlreadyApplied=
  src.includes('excludeOrderIds:ownedReservationIds') ||
  src.includes('excludeOrderIds:excludedOrderIds');
if(!ownershipAlreadyApplied){
  if(!src.includes(heldAnchor)) throw new Error('Seat page held inventory anchor not found');
  src=src.replace(heldAnchor,heldReplacement);
}

fs.writeFileSync(path,src);
console.log('Seat page SSR now excludes reservations owned by the returning checkout session.');