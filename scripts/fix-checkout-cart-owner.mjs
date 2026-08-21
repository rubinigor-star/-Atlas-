import fs from 'node:fs';

const path='src/components/checkout-form.tsx';
let src=fs.readFileSync(path,'utf8');
const anchor='if(!details.ok)throw new Error(text.detailsError);window.location.assign(data.paymentUrl);';
const replacement='if(!details.ok)throw new Error(text.detailsError);await fetch("/api/cart/hold/checkout-owner",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:data.orderId})}).catch(()=>undefined);window.location.assign(data.paymentUrl);';
if(src.includes(replacement)){
  console.log('Checkout cart ownership registration already applied.');
  process.exit(0);
}
if(!src.includes(anchor))throw new Error('Checkout redirect anchor not found for cart ownership registration');
src=src.replace(anchor,replacement);
fs.writeFileSync(path,src);
console.log('Registered pending checkout ownership before HYP redirect.');
