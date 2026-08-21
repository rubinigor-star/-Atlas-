import fs from 'node:fs';

// Keep both browser payment permissions on the final HYP iframe emitted by the build.
// React 19 does not type allowPaymentRequest as an iframe JSX prop, so set the
// legacy compatibility attribute through the ref while keeping allow="payment".
const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('className={styles.paymentLegal}')){
  const iframe='<iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/>';
  const legal=`<><div className={styles.paymentFrameViewport}><iframe ref={node=>{iframeRef.current=node;if(node)node.setAttribute("allowpaymentrequest","true")}} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/></div><div className={styles.paymentLegal}>{locale==="he"?<span>ע״י לחיצה על כפתור התשלום אני מאשר/ת את <a href="/privacy" target="_blank" rel="noreferrer">מדיניות הפרטיות</a> ו<a href="/terms" target="_blank" rel="noreferrer">תנאי השימוש</a></span>:locale==="ru"?<span>Нажимая кнопку оплаты, я подтверждаю согласие с <a href="/privacy" target="_blank" rel="noreferrer">Политикой конфиденциальности</a> и <a href="/terms" target="_blank" rel="noreferrer">Условиями использования</a></span>:<span>By clicking the payment button, I agree to the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a></span>}</div></>`;
  if(!src.includes(iframe)) throw new Error('payment iframe anchor not found');
  src=src.replace(iframe,legal);
  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_PAYMENT_LEGAL_POLISH')){
  css+=`\n/* ATLAS_PAYMENT_LEGAL_POLISH */\n.consentList{gap:2px!important;margin-top:8px!important}.consentRow{padding:6px 12px!important;min-height:30px!important}.paymentLegal{padding:8px 18px 14px;text-align:center;font-size:10.5px;line-height:1.4;color:#5e6472;background:#fff}.paymentLegal a{color:inherit;text-decoration:underline;text-underline-offset:2px}.paymentLegal a:hover{color:#11152f}@media(max-width:640px){.consentList{gap:0!important}.consentRow{padding:5px 10px!important}.paymentLegal{font-size:10px;padding:7px 14px 12px}}\n`;
}

// HYP is cross-origin, so individual nodes inside the hosted payment page cannot
// be styled from Atlas. Keep the iframe itself at its full native 680px height
// (so it never becomes a scroll box), but expose only the useful middle section.
// The top crop hides HYP's duplicated merchant/Total summary; the bottom crop
// removes the provider's empty tail after "Powered by HYP". Wallet and card
// controls stay inside the full-size iframe and remain interactive.
if(!css.includes('ATLAS_HYP_VISUAL_CROP')){
  css+=`\n/* ATLAS_HYP_VISUAL_CROP */\n.paymentCard{min-height:0!important}.paymentFrameViewport{height:505px;overflow:hidden;background:#fff}.paymentFrame{width:100%!important;height:680px!important;min-height:680px!important;border:0!important;display:block!important;background:#fff!important;transform:translateY(-128px);transform-origin:top center;overflow:hidden!important}.paymentLegal{padding-top:4px!important}@media(max-width:900px){.paymentFrameViewport{height:505px}.paymentFrame{height:680px!important;min-height:680px!important;transform:translateY(-128px)}}@media(max-width:640px){.paymentFrameViewport{height:505px}.paymentFrame{height:680px!important;min-height:680px!important;transform:translateY(-128px)}}\n`;
}

fs.writeFileSync(cssPath,css);
