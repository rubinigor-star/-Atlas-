import fs from 'node:fs';

// Keep both browser payment permissions on the final HYP iframe emitted by the build.
// React 19 does not type allowPaymentRequest as an iframe JSX prop, so set the
// legacy compatibility attribute through the ref while keeping allow="payment".
const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('className={styles.paymentLegal}')){
  const iframe='<iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/>';
  const legal=`<><iframe ref={node=>{iframeRef.current=node;if(node)node.setAttribute("allowpaymentrequest","true")}} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/><div className={styles.paymentLegal}>{locale==="he"?<span>ע״י לחיצה על כפתור התשלום אני מאשר/ת את <a href="/privacy" target="_blank" rel="noreferrer">מדיניות הפרטיות</a> ו<a href="/terms" target="_blank" rel="noreferrer">תנאי השימוש</a></span>:locale==="ru"?<span>Нажимая кнопку оплаты, я подтверждаю согласие с <a href="/privacy" target="_blank" rel="noreferrer">Политикой конфиденциальности</a> и <a href="/terms" target="_blank" rel="noreferrer">Условиями использования</a></span>:<span>By clicking the payment button, I agree to the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a></span>}</div></>`;
  if(!src.includes(iframe)) throw new Error('payment iframe anchor not found');
  src=src.replace(iframe,legal);
  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_PAYMENT_LEGAL_POLISH')){
  css+=`\n/* ATLAS_PAYMENT_LEGAL_POLISH */\n.consentList{gap:2px!important;margin-top:8px!important}.consentRow{padding:6px 12px!important;min-height:30px!important}.paymentLegal{padding:8px 18px 14px;text-align:center;font-size:10.5px;line-height:1.4;color:#5e6472;background:#fff}.paymentLegal a{color:inherit;text-decoration:underline;text-underline-offset:2px}.paymentLegal a:hover{color:#11152f}@media(max-width:640px){.consentList{gap:0!important}.consentRow{padding:5px 10px!important}.paymentLegal{font-size:10px;padding:7px 14px 12px}}\n`;
}

// The legal text belongs directly under HYP branding. The hosted HYP document
// otherwise leaves a large empty viewport below "Powered by HYP" because the
// checkout iframe historically used a 680px fixed height. Use one compact
// viewport at every breakpoint so desktop, tablet and mobile remain consistent.
if(!css.includes('ATLAS_COMPACT_HYP_FOOTER')){
  css+=`\n/* ATLAS_COMPACT_HYP_FOOTER */\n.paymentCard{min-height:0!important}.paymentFrame{height:175px!important;min-height:175px!important}.paymentLegal{padding-top:4px!important}@media(max-width:900px){.paymentFrame{height:175px!important;min-height:175px!important}}@media(max-width:640px){.paymentFrame{height:175px!important;min-height:175px!important}}\n`;
}

fs.writeFileSync(cssPath,css);
