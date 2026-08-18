import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_FINAL_PAYMENT_FLOW')){
  src=src.replace(
    'const[extras,setExtras]=useState<Record<string,string>>({});',
    '/* ATLAS_FINAL_PAYMENT_FLOW */\n const[quote,setQuote]=useState<{valid:boolean;discountPercent:number;subtotalMinor:number;serviceFeeMinor:number;totalMinor:number}|null>(null);const[quoteBusy,setQuoteBusy]=useState(false);const[paymentStage,setPaymentStage]=useState(false);const[voucherWasApplied,setVoucherWasApplied]=useState(false);\n const[extras,setExtras]=useState<Record<string,string>>({});'
  );

  src=src.replace(
    ' const remaining=Math.max(0,(expiresAt||now)-now);',
    ' const formReady=contactReady&&requiredExtrasReady;\n const remaining=Math.max(0,(expiresAt||now)-now);'
  );

  src=src.replace(/\n useEffect\(\(\)=>\{if\(cancelled\|\|!contactReady\|\|paymentUrl\|\|startingRef\.current\|\|expiredOpen\)return;const id=window\.setTimeout\(\(\)=>void startPayment\(\),500\);return\(\)=>clearTimeout\(id\);\},\[contactReady,paymentUrl,expiredOpen,cancelled,countryIso\]\);/, '');

  const captureEffect=' useEffect(()=>{if(!contactReady||cancelled)return;if(contactCaptureRef.current)clearTimeout(contactCaptureRef.current);contactCaptureRef.current=window.setTimeout(()=>capture("CONTACTS_ENTERED",customer()),500);},[fullName,email,phone,countryIso,contactReady,cancelled]);';
  if(src.includes(captureEffect)){
    src=src.replace(captureEffect,captureEffect+`\n useEffect(()=>{if(!paymentStage||!orderId||(!promo.trim()&&!voucherWasApplied))return;setQuoteBusy(true);const controller=new AbortController();const id=window.setTimeout(async()=>{try{const response=await fetch(\`/api/orders/\${orderId}/promo\`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:promo.trim(),locale}),signal:controller.signal});const data=await response.json();if(!response.ok){setQuote({valid:false,discountPercent:0,subtotalMinor:props.subtotal,serviceFeeMinor:props.serviceFee,totalMinor:props.total});return;}setQuote(data);setVoucherWasApplied(Boolean(promo.trim()));if(data.paymentUrl)setPaymentUrl(data.paymentUrl);}catch(error){if((error as Error).name!=="AbortError")setQuote(null);}finally{setQuoteBusy(false);}},450);return()=>{clearTimeout(id);controller.abort();};},[promo,orderId,paymentStage,voucherWasApplied,locale,props.subtotal,props.serviceFee,props.total]);`);
  }

  src=src.replace(
    'async function startPayment(){if(cancelled||startingRef.current||paymentUrl||!contactReady)return;',
    'async function startPayment(){if(cancelled||startingRef.current||paymentUrl||!formReady)return;'
  );

  src=src.replace('{paymentUrl&&<div className={styles.fadeIn}>','<div className={styles.fadeIn}>');
  src=src.replace(/\n\s*\{!approvalRequired&&<div className=\{`\$\{styles\.field\} \$\{styles\.promo\}`\}>.*?<\/div>\}/s,'');
  src=src.replace('  </div>}\n </div></div>;','  </div>\n </div>{!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.contactContinue} disabled={!formReady||busy} onClick={()=>{setPaymentStage(true);void startPayment();}}>{locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}<span aria-hidden="true">→</span></button>}</div>;');

  src=src.replace(
    '<span className={styles.calendarIcon}>▣</span>',
    '<svg className={styles.calendarIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>'
  );

  src=src.replace(
    '<span>{selectedCountry.flag}</span><span className={styles.flagChevron}>⌄</span>',
    '<span className={styles.flagImageWrap}><img src={`https://flagcdn.com/20x15/${selectedCountry.iso.toLowerCase()}.png`} alt={selectedCountry.name}/></span><span className={styles.flagChevron}>⌄</span>'
  );
  src=src.replace(
    '<span>{c.flag}</span><span>{c.name}</span><span>{c.dial}</span>',
    '<span className={styles.countryFlag}><img src={`https://flagcdn.com/20x15/${c.iso.toLowerCase()}.png`} alt=""/></span><span>{c.name}</span><span>{c.dial}</span>'
  );

  const paymentRegex=/ const paymentBlock=.*?;\n return /s;
  const paymentReplacement=` const paymentBlock=paymentStage?<div className={styles.paymentWrap}><h2 className={styles.sectionTitle}>{text.payment}</h2><div className={styles.voucherCard}><label className={styles.couponLabel}>{locale==="he"?"קוד קופון":locale==="ru"?"Ваучерный код":"Voucher code"}</label><p className={styles.couponHint}>{locale==="he"?"אם יש לכם קוד קופון, הזינו אותו כאן.":locale==="ru"?"Если у вас есть ваучерный код, введите его здесь.":"If you have a voucher code, enter it here."}</p><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);}} placeholder={locale==="he"?"הזן קוד קופון":locale==="ru"?"Введите ваучерный код":"Enter voucher code"}/>{promo.trim()&&<div className={\`\${styles.couponStatus}\${quote?.valid?\` \${styles.couponOk}\`:quote&&!quote.valid?\` \${styles.couponBad}\`:""}\`}>{quoteBusy?"…":quote?.valid?(locale==="he"?\`הנחה: \${quote.discountPercent}%\`:locale==="ru"?\`Скидка: \${quote.discountPercent}%\`:\`Discount: \${quote.discountPercent}%\`):quote?(locale==="he"?"קוד הקופון אינו תקין או אינו פעיל":locale==="ru"?"Ваучерный код недействителен или неактивен":"Voucher code is invalid or inactive"):""}</div>}</div><div className={\`\${styles.paymentCard} \${styles.fadeIn}\`}>{busy&&!paymentUrl&&<div className={styles.paymentLoading}>{text.paymentLoading}</div>}{paymentUrl&&<iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/>}</div></div>:null;\n return `;
  if(paymentRegex.test(src))src=src.replace(paymentRegex,paymentReplacement);else throw new Error('checkout payment block not found');

  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_FINAL_PAYMENT_STYLES')){
  css+=`\n/* ATLAS_FINAL_PAYMENT_STYLES */\n.contactContinue{width:100%;min-height:50px;border:0;border-radius:999px;background:linear-gradient(90deg,#ff6b00,#ff007a);color:#fff;font-size:15px;font-weight:850;cursor:pointer;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 8px 22px rgba(255,0,122,.14);position:relative;z-index:1}.contactContinue span{font-size:20px;line-height:1}.contactContinue:disabled{opacity:.42;cursor:not-allowed}.voucherCard{background:#fff;border:1px solid #d8dce4;border-radius:18px;padding:18px;margin-bottom:14px}.couponLabel{display:block;font-size:14px;font-weight:850;color:#171b35}.couponHint{margin:6px 0 12px;font-size:12px;line-height:1.45;color:#72798a}.couponInput{width:100%;height:46px;border:1px solid #d8dce4;border-radius:12px;padding:0 13px;font-size:15px;outline:0;background:#fff;color:#11152f}.couponInput:focus{border-color:#ff7b66;box-shadow:0 0 0 2px rgba(255,107,0,.08)}.couponStatus{min-height:20px;padding-top:7px;font-size:12px;color:#72798a}.couponOk{color:#15803d}.couponBad{color:#c62828}.phoneControl{min-height:24px;border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}.phoneControl:focus-within,.phoneControlInvalid{border:0!important;box-shadow:none!important}.flagButton{padding:0 8px 0 0;gap:6px}.flagImageWrap,.countryFlag{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}.flagImageWrap img,.countryFlag img{display:block;width:20px;height:15px;object-fit:cover;border-radius:2px}.dialCode{font-size:16px;font-weight:650;padding-right:8px}.phoneControl input{font-size:16px}.countryOption{grid-template-columns:28px 1fr auto}.contactCard{background:transparent!important;border:0!important;border-radius:0!important;display:grid!important;gap:12px!important;overflow:visible!important}.contactCard>.field,.contactCard>.phoneField,.contactCard>.fadeIn>.field,.contactCard>.fadeIn>.detailsRow>.field{background:#fff!important;border:1px solid #d8dce4!important;border-radius:14px!important;min-height:62px!important}.contactCard>.field:first-child{border-radius:14px!important}.contactCard>.phoneField{padding:13px 20px 12px!important}.contactCard>.fadeIn{display:grid!important;gap:12px!important}.contactCard>.fadeIn>.detailsRow{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;border:0!important}.contactCard>.fadeIn>.detailsRow>.field:first-child{border-right:1px solid #d8dce4!important}.contactCard .field:last-child{border-bottom:1px solid #d8dce4!important}.calendarIcon{width:20px!important;height:20px!important;display:block;flex:0 0 20px;color:#11152f}.birthTrigger{align-items:center}.birthField,.genderField,.phoneField{position:relative;z-index:20}.birthMenu,.genderMenu,.countryMenu{border:1px solid transparent!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#ff6b00,#ff007a) border-box!important;box-shadow:0 20px 50px rgba(17,21,47,.18)!important;z-index:10000!important;opacity:1!important;isolation:isolate!important}.birthMenu{border-radius:22px!important;background:#fff!important;border:1px solid #ff5b52!important}.birthColumns{background:#fff!important}.birthColumn{max-height:165px!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin}.birthColumn button{opacity:1!important;background:#fff;color:#8d94a3}.birthColumn button[class*="birthActive"]{background:#e9ebef!important;color:#20242e!important}.genderMenu,.countryMenu{border-radius:18px!important}.phoneError{top:calc(100% + 7px)}@media(max-width:640px){.contactCard>.fadeIn>.detailsRow{grid-template-columns:1fr!important}.contactCard>.fadeIn>.detailsRow>.field:first-child{border-right:1px solid #d8dce4!important}.contactContinue{min-height:48px}.voucherCard{padding:16px}}\n`;
  fs.writeFileSync(cssPath,css);
}
