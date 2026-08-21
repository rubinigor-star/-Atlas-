import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
let src=fs.readFileSync(tsxPath,'utf8');

// Final checkout mode: ATLAS collects and validates customer data, then sends
// the browser to HYP as a normal top-level page. HYP must never render inside
// an iframe. This intentionally runs after all older checkout patch scripts.

// Remove the legacy auto-start effect. Payment starts only from the CTA click.
src=src.replace(/\n useEffect\(\(\)=>\{if\(!formReady\|\|paymentStage\|\|paymentUrl\|\|busy\|\|expiredOpen\|\|cancelled\)return;const id=window\.setTimeout\(\(\)=>\{setPaymentStage\(true\);void startPayment\(\);\},450\);return\(\)=>window\.clearTimeout\(id\);\},\[formReady,paymentStage,paymentUrl,busy,expiredOpen,cancelled,countryIso\]\);/g,'');

// Voucher validation happens on ATLAS before an order exists.
src=src.replace(
  / async function applyVoucher\(\)\{.*?\}\n async function startPayment\(\)\{/s,
  ` async function applyVoucher(){if(quoteBusy||!promo.trim())return;setQuoteBusy(true);setError("");try{const response=await fetch("/api/checkout/promo-preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:props.eventId,code:promo.trim(),subtotalMinor:props.subtotal})});const data=await response.json();if(!response.ok){setQuote({valid:false,discountPercent:0,subtotalMinor:props.subtotal,serviceFeeMinor:props.serviceFee,totalMinor:props.total});setVoucherWasApplied(false);return;}setQuote(data);setVoucherWasApplied(Boolean(data.valid&&promo.trim()));}catch{setQuote(null);setVoucherWasApplied(false);}finally{setQuoteBusy(false);}}\n async function startPayment(){`
);

// Persist checkout details, then navigate the top-level page to HYP.
const iframeSuccess='if(data.paymentUrl){setOrderId(data.orderId);setPaymentUrl(data.paymentUrl);setPaymentReady(false);return;}';
const redirectSuccess=`if(data.paymentUrl){setOrderId(data.orderId);const birthDate=extras.birthDate?birthDateToIso(extras.birthDate):"";const demo=await fetch(\`/api/orders/\${data.orderId}/demographics\`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idempotencyKey,gender,birthDate})});if(!demo.ok)throw new Error(text.detailsError);const details=await fetch(\`/api/orders/\${data.orderId}/checkout-details\`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idempotencyKey,city:extras.city||"",facebook:extras.facebook||"",instagram:extras.instagram||""})});if(!details.ok)throw new Error(text.detailsError);window.location.assign(data.paymentUrl);return;}`;
if(src.includes(iframeSuccess)) src=src.replace(iframeSuccess,redirectSuccess);
else if(!src.includes('window.location.assign(data.paymentUrl)')) throw new Error('HYP iframe success anchor not found');

// Keep voucher directly above the two consent checkboxes. The existing CTA
// already renders immediately after the consent list.
if(!src.includes('ATLAS_EXTERNAL_HYP_VOUCHER')){
  const consentAnchor='<div className={styles.consentList}>';
  const voucher=`{/* ATLAS_EXTERNAL_HYP_VOUCHER */}<div className={styles.voucherCard}><label className={styles.couponLabel}>{locale==="he"?"קוד קופון":locale==="ru"?"Ваучерный код":"Voucher code"}</label><p className={styles.couponHint}>{locale==="he"?"אם יש לכם קוד קופון, הזינו אותו כאן.":locale==="ru"?"Если у вас есть ваучерный код, введите его здесь.":"If you have a voucher code, enter it here."}</p><div className={styles.voucherRow}><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);setVoucherWasApplied(false);}} placeholder={locale==="he"?"הזן קוד קופון":locale==="ru"?"Введите ваучерный код":"Enter voucher code"}/><button type="button" className={styles.voucherApply} disabled={quoteBusy||!promo.trim()} onClick={()=>void applyVoucher()}>{quoteBusy?"…":locale==="he"?"אישור":locale==="ru"?"Применить":"Apply"}</button></div>{promo.trim()&&<div className={\`\${styles.couponStatus}\${quote?.valid?\` \${styles.couponOk}\`:quote&&!quote.valid?\` \${styles.couponBad}\`:""}\`}>{quoteBusy?"…":quote?.valid?(locale==="he"?\`הנחה: \${quote.discountPercent}%\`:locale==="ru"?\`Скидка: \${quote.discountPercent}%\`:\`Discount: \${quote.discountPercent}%\`):quote?(locale==="he"?"קוד הקופון אינו תקין או אינו פעיל":locale==="ru"?"Ваучерный код недействителен или неактивен":"Voucher code is invalid or inactive"):""}</div>}</div>`;
  if(src.includes(consentAnchor)) src=src.replace(consentAnchor,voucher+consentAnchor);
  else throw new Error('consent block anchor not found for voucher placement');
}

// CTA validates everything first and starts checkout directly. The next visible
// page is HYP; do not enter any embedded payment stage.
src=src.replaceAll('setPaymentStage(true);void startPayment();','void startPayment();');

// Never render the legacy embedded HYP payment area.
src=src.replace(/\n const paymentBlock=.*?;\n return /s,'\n const paymentBlock=null;\n return ');

fs.writeFileSync(tsxPath,src);
