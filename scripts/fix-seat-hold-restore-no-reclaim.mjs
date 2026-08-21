import fs from 'node:fs';

const path='src/components/seat-hold-bridge.tsx';
let src=fs.readFileSync(path,'utf8');

const oldBlock=`    const finishRestore = () => {\n      window.dispatchEvent(new CustomEvent("atlas-cart-restore-complete"));\n      const wantsCheckout = new URLSearchParams(window.location.search).get("checkout") === "1";`;
const newBlock=`    const finishRestore = () => {\n      // Rehydrating a persisted cart is not a new seat selection. The clicks above\n      // only rebuild React UI state. Record that rebuilt state as already synced so\n      // the polling loop does not immediately POST /api/cart/hold and try to claim\n      // the buyer's own reservation a second time.\n      const restoredItems = captureCart(categories, objects);\n      signatureRef.current = JSON.stringify(restoredItems);\n      restoringUntilRef.current = 0;\n      const restoredGroup = currentStoredGroup();\n      if (restoredGroup?.expiresAt) {\n        window.dispatchEvent(new CustomEvent("atlas-server-hold", { detail: { eventId, expiresAt: new Date(restoredGroup.expiresAt).toISOString() } }));\n      }\n      window.dispatchEvent(new CustomEvent("atlas-cart-restore-complete"));\n      const wantsCheckout = new URLSearchParams(window.location.search).get("checkout") === "1";`;

if(src.includes(newBlock)){
  console.log('Persisted cart restore already avoids re-claiming owned seats.');
  process.exit(0);
}
if(!src.includes(oldBlock)) throw new Error('SeatHoldBridge finishRestore anchor not found');
src=src.replace(oldBlock,newBlock);
fs.writeFileSync(path,src);
console.log('Persisted cart restore now rebuilds UI without re-claiming owned seats.');
