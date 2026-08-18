import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

// CTA must disappear while any checkout popover is open.
src=src.replaceAll(
  '!paymentStepOpen&&!paymentUrl&&<button type="button" className={styles.openPaymentButton}',
  '!paymentStepOpen&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.openPaymentButton}'
);
src=src.replaceAll(
  '!paymentStepOpen&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.openPaymentButton}',
  '!paymentStepOpen&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.openPaymentButton}'
);

// Keep exactly one checkout CTA even if earlier build patches injected several variants.
const ctaRe=/(?:\{[^{}]*?)?<button\s+type="button"\s+className=\{styles\.openPaymentButton\}[\s\S]*?<\/button>(?:\})?/g;
let seen=0;
src=src.replace(ctaRe,(match)=>{
  seen+=1;
  if(seen===1){
    const buttonStart=match.indexOf('<button');
    const buttonEnd=match.lastIndexOf('</button>')+'</button>'.length;
    const button=match.slice(buttonStart,buttonEnd);
    return `{!paymentStepOpen&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&${button}}`;
  }
  return '';
});

fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
const marker='ATLAS_POPOVER_LAYERING_FIX_V2';
if(!css.includes(marker)){
  css+=`\n/* ${marker} */\n.birthField,.genderField,.phoneField{position:relative}\n.birthField:has(.birthMenu),.genderField:has(.genderMenu),.phoneField:has(.countryMenu){z-index:99999!important;isolation:isolate!important}\n.birthMenu,.genderMenu,.countryMenu{z-index:100000!important;opacity:1!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(100deg,#ff6b00,#ff007a) border-box!important;box-shadow:0 18px 45px rgba(8,18,38,.20)!important;filter:none!important;backdrop-filter:none!important}\n.birthMenu *,.genderMenu *,.countryMenu *{opacity:1!important}\n.birthColumns{overflow:hidden!important}\n.birthColumn{max-height:190px!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin;background:#fff!important}\n.birthColumn button{background:#fff;color:#9aa1ad;opacity:1!important}\n.birthColumn button:hover{color:#111827}\n.birthColumn .birthActive,.birthActive{background:#e9edf2!important;color:#111827!important;font-weight:800!important}\n.birthActions{position:relative;z-index:2;background:#fff!important}\n.openPaymentButton{position:relative!important;z-index:0!important}\n`;
  fs.writeFileSync(cssPath,css);
}
