import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_CONSENTS_VOUCHER_BUTTON')){
  src=src.replace(
    '/* ATLAS_REQUIRED_AUTO_PAYMENT */const[validationAttempted,setValidationAttempted]=useState(false);',
    '/* ATLAS_REQUIRED_AUTO_PAYMENT */ /* ATLAS_CONSENTS_VOUCHER_BUTTON */ const[consentAtlas,setConsentAtlas]=useState(false);const[consentOrganizer,setConsentOrganizer]=useState(false);const[validationAttempted,setValidationAttempted]=useState(false);'
  );

  src=src.replace(
    ' const formReady=contactReady&&requiredExtrasReady;',
    ' const consentReady=consentAtlas&&consentOrganizer;\n const formReady=contactReady&&requiredExtrasReady&&consentReady;'
  );

  src=src.replace(
    ' const genderRequiredInvalid=(validationAttempted||Boolean(touched.gender))&&!gender;\n const remaining=',
    ' const genderRequiredInvalid=(validationAttempted||Boolean(touched.gender))&&!gender;\n const consentAtlasInvalid=validationAttempted&&!consentAtlas;\n const consentOrganizerInvalid=validationAttempted&&!consentOrganizer;\n const remaining='
  );

  const buttonAnchor='{!paymentStage&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.contactContinue} disabled={busy} onClick={()=>{if(!formReady){setValidationAttempted(true);return;}setPaymentStage(true);void startPayment();}}>{locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}<span aria-hidden="true">→</span></button>}';
  const consentBlock=`<div className={styles.consentList}>
   <label className={\`${'${styles.consentRow}'}${'${consentAtlasInvalid?` ${styles.consentInvalid}`:""}'}\`}><input type="checkbox" checked={consentAtlas} onChange={e=>setConsentAtlas(e.target.checked)}/><span>{locale==="he"?"אני מאשר/ת קבלת מידע וחומר פרסומי מ-ATLAS":locale==="ru"?"Я согласен(на) получать информацию и рекламные материалы от ATLAS":"I agree to receive information and promotional materials from ATLAS"}</span></label>
   <label className={\`${'${styles.consentRow}'}${'${consentOrganizerInvalid?` ${styles.consentInvalid}`:""}'}\`}><input type="checkbox" checked={consentOrganizer} onChange={e=>setConsentOrganizer(e.target.checked)}/><span>{locale==="he"?"אני מאשר/ת קבלת מידע וחומר פרסומי ממארגן/ת האירוע":locale==="ru"?"Я согласен(на) получать информацию и рекламные материалы от организатора мероприятия":"I agree to receive information and promotional materials from the event organizer"}</span></label>
  </div>`;
  if(src.includes(buttonAnchor)) src=src.replace(buttonAnchor,consentBlock+buttonAnchor); else throw new Error('consent CTA anchor not found');

  src=src.replace(/\n useEffect\(\(\)=>\{if\(!paymentStage\|\|!orderId\|\|\(!promo\.trim\(\)&&!voucherWasApplied\)\)return;setQuoteBusy\(true\);.*?\},\[promo,orderId,paymentStage,voucherWasApplied,locale,props\.subtotal,props\.serviceFee,props\.total\]\);/s,'');

  const startAnchor=' async function startPayment(){';
  const applyFn=` async function applyVoucher(){if(!orderId||quoteBusy||(!promo.trim()&&!voucherWasApplied))return;setQuoteBusy(true);setError("");try{const response=await fetch(\`/api/orders/\${orderId}/promo\`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:promo.trim(),locale})});const data=await response.json();if(!response.ok){setQuote({valid:false,discountPercent:0,subtotalMinor:props.subtotal,serviceFeeMinor:props.serviceFee,totalMinor:props.total});return;}setQuote(data);setVoucherWasApplied(Boolean(promo.trim()));if(data.paymentUrl)setPaymentUrl(data.paymentUrl);}catch{setQuote(null);}finally{setQuoteBusy(false);}}\n`;
  if(src.includes(startAnchor)) src=src.replace(startAnchor,applyFn+startAnchor); else throw new Error('voucher function anchor not found');

  const voucherInput='<input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);}} placeholder={locale==="he"?"הזן קוד קופון":locale==="ru"?"Введите ваучерный код":"Enter voucher code"}/>';
  const voucherRow='<div className={styles.voucherRow}><input className={styles.couponInput} value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setQuote(null);}} placeholder={locale==="he"?"קוד ההטבה הולך לכאן":locale==="ru"?"Введите ваучерный код":"Enter voucher code"}/><button type="button" className={styles.voucherApply} disabled={quoteBusy||(!promo.trim()&&!voucherWasApplied)} onClick={()=>void applyVoucher()}>{quoteBusy?"…":locale==="he"?"אישור":locale==="ru"?"Применить":"Apply"}</button></div>';
  if(src.includes(voucherInput)) src=src.replace(voucherInput,voucherRow); else throw new Error('voucher input anchor not found');

  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_CONSENTS_VOUCHER_STYLES')){
  css+=`\n/* ATLAS_CONSENTS_VOUCHER_STYLES */\n.consentList{display:grid;gap:8px;margin-top:12px}.consentRow{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid transparent;border-radius:12px;color:#4d5566;font-size:12px;line-height:1.45;cursor:pointer;background:transparent}.consentRow input{appearance:none;width:18px;height:18px;flex:0 0 18px;margin:0;border:1.5px solid #ff4f4f;border-radius:3px;background:#fff;display:grid;place-items:center;cursor:pointer}.consentRow input:checked{background:linear-gradient(135deg,#ff6b00,#ff007a);border-color:transparent}.consentRow input:checked:after{content:"✓";color:#fff;font-size:13px;font-weight:900;line-height:1}.consentInvalid{border-color:#e53935;background:#fff7f7;color:#b42318}.voucherRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.voucherApply{height:46px;min-width:94px;border:0;border-radius:999px;padding:0 18px;background:linear-gradient(90deg,#ff6b00,#ff007a);color:#fff;font-size:13px;font-weight:850;cursor:pointer;white-space:nowrap}.voucherApply:disabled{opacity:.42;cursor:not-allowed}.paymentWrap .voucherCard{border-bottom:0!important}.paymentWrap .paymentCard{border-top:0!important}@media(max-width:640px){.consentRow{font-size:11.5px}.voucherRow{grid-template-columns:1fr auto}.voucherApply{min-width:88px;padding:0 15px}}\n`;
  fs.writeFileSync(cssPath,css);
}
