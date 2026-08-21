import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
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

// Keep voucher directly above the two consent checkboxes. Its title is a
// separate section heading, matching the contact-details hierarchy.
if(!src.includes('ATLAS_EXTERNAL_HYP_VOUCHER')){
  const consentAnchor='<div className={styles.consentList}>';
  const voucher=`{/* ATLAS_EXTERNAL_HYP_VOUCHER */}<div className={styles.voucherSection}><h2 className={styles.voucherSectionTitle}>{locale==="he"?"קוד קופון":locale==="ru"?"Ваучерный код":"Voucher code"}</h2><div className={styles.voucherCard}><p className={styles.couponHint}>{locale==="he"?"אם יש לכם קוד קופון, הזינו אותו כאן.":locale==="ru"?"Если у вас есть ваучерный код, введите его здесь.":"If you have a voucher code, enter it here."}</p><div className={styles.voucherRow}><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);setVoucherWasApplied(false);}} placeholder={locale==="he"?"הזן קוד קופון":locale==="ru"?"Введите ваучерный код":"Enter voucher code"}/><button type="button" className={styles.voucherApply} disabled={quoteBusy||!promo.trim()} onClick={()=>void applyVoucher()}>{quoteBusy?"…":locale==="he"?"אישור":locale==="ru"?"Применить":"Apply"}</button></div>{promo.trim()&&<div className={`${styles.couponStatus}${quote?.valid?` ${styles.couponOk}`:quote&&!quote.valid?` ${styles.couponBad}`:""}`}>{quoteBusy?"…":quote?.valid?(locale==="he"?`הנחה: ${quote.discountPercent}%`:locale==="ru"?`Скидка: ${quote.discountPercent}%`:`Discount: ${quote.discountPercent}%`):quote?(locale==="he"?"קוד הקופון אינו תקין או אינו פעיל":locale==="ru"?"Ваучерный код недействителен или неактивен":"Voucher code is invalid or inactive"):""}</div>}</div></div>`;
  if(src.includes(consentAnchor)) src=src.replace(consentAnchor,voucher+consentAnchor);
  else throw new Error('consent block anchor not found for voucher placement');
}

// Restore the original concise consent copy only. The checkbox state, payload,
// persistence endpoints and consent bindings remain unchanged.
src=src.replaceAll('אני מאשר/ת קבלת מידע וחומר פרסומי ממארגן/ת האירוע, מסכים/ה לתנאי מועדון הלקוחות שלו/ה, ואם איני חבר/ה עדיין - מאשר/ת את רישומי למועדון באמצעות מערכת הנאמנות המחוברת של המארגן/ת.','אני מאשר/ת קבלת מידע וחומר פרסומי ממארגן/ת האירוע');
src=src.replaceAll('Я согласен(на) получать информацию и рекламные материалы от организатора мероприятия, принимаю условия его клубной программы и, если я ещё не являюсь участником, разрешаю зарегистрировать меня в клубе через подключённую организатором систему лояльности.','Я согласен(на) получать информацию и рекламные материалы от организатора мероприятия');
src=src.replaceAll("I agree to receive information and promotional materials from the event organizer, accept the organizer's club terms, and, if I am not yet a member, authorize my registration in the organizer's club through the organizer's connected loyalty system.",'I agree to receive information and promotional materials from the event organizer');

// CTA validates everything first and starts checkout directly. The next visible
// page is HYP; do not enter any embedded payment stage.
src=src.replaceAll('setPaymentStage(true);void startPayment();','void startPayment();');

// Never render the legacy embedded HYP payment area.
src=src.replace(/\n const paymentBlock=.*?;\n return /s,'\n const paymentBlock=null;\n return ');

fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_EXTERNAL_HYP_LAYOUT_POLISH')){
  css+=`\n/* ATLAS_EXTERNAL_HYP_LAYOUT_POLISH */\n.voucherSection{display:grid;gap:10px;margin-top:4px}.voucherSectionTitle{font-size:18px;line-height:1.15;margin:0;font-weight:850;color:#11152f;text-transform:uppercase}.voucherSection .voucherCard{margin:0!important;padding:16px 18px 18px!important}.voucherSection .couponHint{margin:0 0 12px!important}.consentList{margin-top:10px!important}.title{min-width:0;max-width:100%}@media(max-width:900px){.title{font-size:clamp(16px,4.4vw,20px)!important;letter-spacing:-.45px!important;min-width:0;max-width:100%;overflow:visible}.voucherSectionTitle{font-size:17px}}@media(max-width:390px){.title{font-size:16px!important;letter-spacing:-.55px!important}.timer{padding-left:13px!important;padding-right:13px!important}.voucherSectionTitle{font-size:16px}}\n`;
  fs.writeFileSync(cssPath,css);
}
