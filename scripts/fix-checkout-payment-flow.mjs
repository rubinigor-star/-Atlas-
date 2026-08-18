import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_MANUAL_PAYMENT_FLOW')){
  src=src.replace(
    'const[extras,setExtras]=useState<Record<string,string>>({});',
    '/* ATLAS_MANUAL_PAYMENT_FLOW */\n const[quote,setQuote]=useState<{valid:boolean;discountPercent:number;subtotalMinor:number;serviceFeeMinor:number;totalMinor:number}|null>(null);const[quoteBusy,setQuoteBusy]=useState(false);\n const[extras,setExtras]=useState<Record<string,string>>({});'
  );

  src=src.replace(
    ' const remaining=Math.max(0,(expiresAt||now)-now);',
    ' const formReady=contactReady&&requiredExtrasReady;const quotedTotal=quote?.valid?quote.totalMinor:props.total;const quotedDiscount=Math.max(0,props.total-quotedTotal);\n const remaining=Math.max(0,(expiresAt||now)-now);'
  );

  src=src.replace(/\n useEffect\(\(\)=>\{if\(cancelled\|\|!contactReady\|\|paymentUrl\|\|startingRef\.current\|\|expiredOpen\)return;const id=window\.setTimeout\(\(\)=>void startPayment\(\),500\);return\(\)=>clearTimeout\(id\);\},\[contactReady,paymentUrl,expiredOpen,cancelled,countryIso\]\);/, '');

  const captureEffect=' useEffect(()=>{if(!contactReady||cancelled)return;if(contactCaptureRef.current)clearTimeout(contactCaptureRef.current);contactCaptureRef.current=window.setTimeout(()=>capture("CONTACTS_ENTERED",customer()),500);},[fullName,email,phone,countryIso,contactReady,cancelled]);';
  if(src.includes(captureEffect)){
    src=src.replace(captureEffect, captureEffect+`\n useEffect(()=>{const code=promo.trim();if(!code){setQuote(null);setQuoteBusy(false);return;}setQuoteBusy(true);const controller=new AbortController();const id=window.setTimeout(async()=>{try{const response=await fetch("/api/checkout/promo-preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId:props.eventId,code,subtotalMinor:props.subtotal}),signal:controller.signal});const data=await response.json();if(response.ok)setQuote(data);else setQuote({valid:false,discountPercent:0,subtotalMinor:props.subtotal,serviceFeeMinor:props.serviceFee,totalMinor:props.total});}catch(error){if((error as Error).name!=="AbortError")setQuote(null);}finally{setQuoteBusy(false);}},350);return()=>{clearTimeout(id);controller.abort();};},[promo,props.eventId,props.subtotal,props.serviceFee,props.total]);`);
  }

  src=src.replace(
    'async function startPayment(){if(cancelled||startingRef.current||paymentUrl||!contactReady)return;',
    'async function startPayment(){if(cancelled||startingRef.current||paymentUrl||!formReady)return;'
  );

  src=src.replace('{paymentUrl&&<div className={styles.fadeIn}>','<div className={styles.fadeIn}>');
  src=src.replace(/\n\s*\{!approvalRequired&&<div className=\{`\$\{styles\.field\} \$\{styles\.promo\}`\}>.*?<\/div>\}/s,'');
  src=src.replace('  </div>}\n </div></div>;','  </div>\n </div></div>;');
  src=src.replace(
    '<span className={styles.calendarIcon}>▣</span>',
    '<svg className={styles.calendarIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>'
  );

  const paymentRegex=/ const paymentBlock=.*?;\n return /s;
  const paymentReplacement=` const paymentBlock=<div className={styles.paymentWrap}><h2 className={styles.sectionTitle}>{text.payment}</h2>{paymentUrl?<div className={\`\${styles.paymentCard} \${styles.fadeIn}\`}><iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/></div>:<div className={styles.checkoutActionCard}><div className={styles.couponCard}><label className={styles.couponLabel}>{locale==="he"?"קוד קופון":locale==="ru"?"Код купона":"Coupon code"}</label><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);}} placeholder={locale==="he"?"הזן קוד":locale==="ru"?"Введите код":"Enter code"}/>{promo.trim()&&<div className={\`\${styles.couponStatus}\${quote?.valid?\` \${styles.couponOk}\`:quote&&!quote.valid?\` \${styles.couponBad}\`:""}\`}>{quoteBusy?"…":quote?.valid?(locale==="he"?\`הנחת קופון: \${quote.discountPercent}%\`:locale==="ru"?\`Скидка по купону: \${quote.discountPercent}%\`:\`Coupon discount: \${quote.discountPercent}%\`):quote?(locale==="he"?"הקופון לא נמצא או אינו פעיל":locale==="ru"?"Купон не найден или неактивен":"Coupon not found or inactive"):""}</div>}</div><div className={styles.checkoutPriceCard}><div className={styles.priceBreakdown}><div><span>{locale==="he"?"מחיר":locale==="ru"?"Цена":"Price"}</span><strong>{money(props.total,"ILS",locale)}</strong></div>{quotedDiscount>0&&<div className={styles.discountLine}><span>{locale==="he"?"הנחה":locale==="ru"?"Скидка":"Discount"}</span><strong>-{money(quotedDiscount,"ILS",locale)}</strong></div>}<div className={styles.priceFinal}><span>{text.total}</span><strong>{money(quotedTotal,"ILS",locale)}</strong></div></div><button type="button" className={styles.continueButton} disabled={busy||!formReady||quoteBusy||Boolean(promo.trim()&&(!quote||!quote.valid))} onClick={()=>void startPayment()}>{busy?"…":locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}</button></div></div>}</div>;\n return `;
  if(paymentRegex.test(src)) src=src.replace(paymentRegex,paymentReplacement);
  else throw new Error('checkout payment block not found');

  fs.writeFileSync(tsxPath,src);
}

// Windows renders regional-indicator emoji as IL/US/etc. Replace emoji flags with real flag images.
if(!src.includes('ATLAS_REAL_COUNTRY_FLAGS')){
  src=fs.readFileSync(tsxPath,'utf8');
  src=src.replace(
    '<span>{selectedCountry.flag}</span><span className={styles.flagChevron}>⌄</span>',
    '<span className={styles.flagImageWrap}>{/* ATLAS_REAL_COUNTRY_FLAGS */}<img src={`https://flagcdn.com/20x15/${selectedCountry.iso.toLowerCase()}.png`} alt={selectedCountry.name}/></span><span className={styles.flagChevron}>⌄</span>'
  );
  src=src.replace(
    '<span>{c.flag}</span><span>{c.name}</span><span>{c.dial}</span>',
    '<span className={styles.countryFlag}><img src={`https://flagcdn.com/20x15/${c.iso.toLowerCase()}.png`} alt=""/></span><span>{c.name}</span><span>{c.dial}</span>'
  );
  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_MANUAL_PAYMENT_STYLES')){
  css+=`\n/* ATLAS_MANUAL_PAYMENT_STYLES */\n.checkoutActionCard{display:grid;gap:14px;background:transparent;border:0;padding:0}.couponCard,.checkoutPriceCard{background:#fff;border:1px solid #d8dce4;border-radius:18px;padding:18px}.couponLabel{display:block;font-size:12px;font-weight:800;margin-bottom:7px;color:#171b35}.couponInput{width:100%;height:46px;border:1px solid #d8dce4;border-radius:12px;padding:0 13px;font-size:15px;outline:0;background:#fff;color:#11152f}.couponInput:focus{border-color:#ff7b66;box-shadow:0 0 0 2px rgba(255,107,0,.08)}.couponStatus{min-height:22px;padding-top:7px;font-size:12px;color:#72798a}.couponOk{color:#15803d}.couponBad{color:#c62828}.priceBreakdown{margin-top:0}.priceBreakdown>div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px}.discountLine{color:#15803d}.priceFinal{border-top:1px solid #e6e8ed;margin-top:4px;padding-top:12px!important;font-size:17px!important;font-weight:850}.continueButton{width:100%;min-height:48px;border:0;border-radius:999px;background:linear-gradient(90deg,#ff6b00,#ff007a);color:#fff;font-size:15px;font-weight:850;cursor:pointer;margin-top:14px}.continueButton:disabled{opacity:.42;cursor:not-allowed}\n`;
}
if(!css.includes('ATLAS_PHONE_ROW_VISUAL_FIX')){
  css+=`\n/* ATLAS_PHONE_ROW_VISUAL_FIX */\n.phoneControl{min-height:24px;border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}.phoneControl:focus-within,.phoneControlInvalid{border:0!important;box-shadow:none!important}.flagButton{padding:0 8px 0 0;gap:6px}.flagImageWrap,.countryFlag{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}.flagImageWrap img,.countryFlag img{display:block;width:20px;height:15px;object-fit:cover;border-radius:2px}.dialCode{font-size:16px;font-weight:650;padding-right:8px}.phoneControl input{font-size:16px}.countryOption{grid-template-columns:28px 1fr auto}.countryMenu{border-radius:16px}\n`;
}
if(!css.includes('ATLAS_SEPARATE_CHECKOUT_FIELDS')){
  css+=`\n/* ATLAS_SEPARATE_CHECKOUT_FIELDS */\n.contactCard{background:transparent!important;border:0!important;border-radius:0!important;display:grid!important;gap:12px!important;overflow:visible!important}.contactCard>.field,.contactCard>.phoneField,.contactCard>.fadeIn>.field,.contactCard>.fadeIn>.detailsRow>.field{background:#fff!important;border:1px solid #d8dce4!important;border-radius:14px!important;min-height:62px!important}.contactCard>.field:first-child{border-radius:14px!important}.contactCard>.phoneField{padding:13px 20px 12px!important}.contactCard>.fadeIn{display:grid!important;gap:12px!important}.contactCard>.fadeIn>.detailsRow{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;border:0!important}.contactCard>.fadeIn>.detailsRow>.field:first-child{border-right:1px solid #d8dce4!important}.contactCard .field:last-child{border-bottom:1px solid #d8dce4!important}.calendarIcon{width:20px!important;height:20px!important;display:block;flex:0 0 20px;color:#11152f}.birthTrigger{align-items:center}.phoneError{top:calc(100% + 7px)}@media(max-width:640px){.contactCard>.fadeIn>.detailsRow{grid-template-columns:1fr!important}.contactCard>.fadeIn>.detailsRow>.field:first-child{border-right:1px solid #d8dce4!important}}\n`;
}
fs.writeFileSync(cssPath,css);
