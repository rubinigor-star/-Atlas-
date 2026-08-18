import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_CHECKOUT_UX_V2')){
  const quoteState='const[quote,setQuote]=useState<{valid:boolean;discountPercent:number;subtotalMinor:number;serviceFeeMinor:number;totalMinor:number}|null>(null);const[quoteBusy,setQuoteBusy]=useState(false);';
  if(src.includes(quoteState)){
    src=src.replace(quoteState,`${quoteState}/* ATLAS_CHECKOUT_UX_V2 */const[paymentStepOpen,setPaymentStepOpen]=useState(false);`);
  } else {
    throw new Error('checkout quote state not found');
  }

  const oldPayment=/ const paymentBlock=<div className=\{styles\.paymentWrap\}>.*?<\/div>;\n return /s;
  const newPayment=` const paymentBlock=paymentStepOpen?<div className={styles.paymentWrap}><h2 className={styles.sectionTitle}>{text.payment}</h2>{paymentUrl?<div className={\`\${styles.paymentCard} \${styles.fadeIn}\`}><iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/></div>:<div className={styles.paymentPreflight}><div className={styles.couponCard}><label className={styles.couponLabel}>{locale==="he"?"קוד קופון":locale==="ru"?"Код купона":"Coupon code"}</label><p className={styles.couponHelp}>{locale==="he"?"אם יש לכם קוד קופון, הזינו אותו כאן.":locale==="ru"?"Если у вас есть код купона, введите его здесь.":"If you have a coupon code, enter it here."}</p><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);}} placeholder={locale==="he"?"הזן קוד קופון":locale==="ru"?"Введите код купона":"Enter coupon code"}/>{promo.trim()&&<div className={\`\${styles.couponStatus}\${quote?.valid?\` \${styles.couponOk}\`:quote&&!quote.valid?\` \${styles.couponBad}\`:""}\`}>{quoteBusy?"…":quote?.valid?(locale==="he"?\`הנחת קופון: \${quote.discountPercent}%\`:locale==="ru"?\`Скидка по купону: \${quote.discountPercent}%\`:\`Coupon discount: \${quote.discountPercent}%\`):quote?(locale==="he"?"הקופון לא נמצא או אינו פעיל":locale==="ru"?"Купон не найден или неактивен":"Coupon not found or inactive"):""}</div>}</div><div className={styles.paymentSummaryCard}><div className={styles.priceBreakdown}><div><span>{locale==="he"?"מחיר מקורי":locale==="ru"?"Исходная цена":"Original price"}</span><strong>{money(props.total,"ILS",locale)}</strong></div>{quotedDiscount>0&&<div className={styles.discountLine}><span>{locale==="he"?"הנחה":locale==="ru"?"Скидка":"Discount"}</span><strong>-{money(quotedDiscount,"ILS",locale)}</strong></div>}<div className={styles.priceFinal}><span>{text.total}</span><strong>{money(quotedTotal,"ILS",locale)}</strong></div></div><button type="button" className={styles.continueButton} disabled={busy||!formReady||quoteBusy||Boolean(promo.trim()&&(!quote||!quote.valid))} onClick={()=>void startPayment()}>{busy?"…":locale==="he"?"המשך לתשלום":locale==="ru"?"Продолжить к оплате":"Continue to payment"}</button></div></div>}</div>:null;\n return `;
  if(oldPayment.test(src)) src=src.replace(oldPayment,newPayment);
  else throw new Error('checkout payment block not found for v2');

  const returnNeedle='<section className={styles.leftColumn}><h1 className={styles.title}>{text.checkout}</h1>{contactBlock}{error&&<div className={styles.error}>{error}</div>}</section>';
  const returnReplacement='<section className={styles.leftColumn}><h1 className={styles.title}>{text.checkout}</h1>{contactBlock}{!paymentStepOpen&&!paymentUrl&&<button type="button" className={styles.openPaymentButton} disabled={!formReady||cancelled} onClick={()=>setPaymentStepOpen(true)}><span>{locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}</span><span aria-hidden="true">→</span></button>}{error&&<div className={styles.error}>{error}</div>}</section>';
  if(src.includes(returnNeedle))src=src.replace(returnNeedle,returnReplacement);
  else throw new Error('checkout left column return not found');

  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_CHECKOUT_UX_V2_STYLES')){
  css+=`\n/* ATLAS_CHECKOUT_UX_V2_STYLES */\n.openPaymentButton{width:100%;min-height:52px;border:0;border-radius:999px;background:linear-gradient(90deg,#ff6b00,#ff007a);color:#fff;font-size:15px;font-weight:850;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;box-shadow:0 8px 22px rgba(255,0,122,.14);margin-top:-4px}.openPaymentButton span:last-child{font-size:21px;line-height:1;transform:translateY(-1px)}.openPaymentButton:disabled{opacity:.38;cursor:not-allowed}.paymentPreflight{display:grid;gap:14px}.couponCard,.paymentSummaryCard{background:#fff;border:1px solid #d8dce4;border-radius:18px;padding:18px}.couponHelp{margin:0 0 13px;font-size:12px;line-height:1.45;color:#6d7586}.couponLabel{font-size:14px!important;margin-bottom:5px!important}.priceBreakdown{margin-top:0!important;border-top:0!important;padding-top:0!important}.paymentSummaryCard .continueButton{margin-top:14px}.birthMenu,.genderMenu,.countryMenu{border:1px solid transparent!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(100deg,#ff6b00,#ff007a) border-box!important}.birthMenu{border-radius:22px!important}.genderMenu,.countryMenu{border-radius:18px!important}\n@media(max-width:900px){.openPaymentButton{min-height:50px}.paymentPreflight{gap:12px}.couponCard,.paymentSummaryCard{padding:16px}}\n`;
  fs.writeFileSync(cssPath,css);
}
