import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

// CTA must disappear while any checkout popover is open.
src=src.replaceAll(
  '!paymentStepOpen&&!paymentUrl&&<button type="button" className={styles.openPaymentButton}',
  '!paymentStepOpen&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.openPaymentButton}'
);

// Some earlier build patches can inject the same CTA twice. Keep exactly the first one.
const ctaRe=/<button type="button" className=\{styles\.openPaymentButton\}[\s\S]*?<\/button>/g;
let seen=0;
src=src.replace(ctaRe,(match)=>{seen+=1;return seen===1?match:'';});

fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_POPOVER_LAYERING_FIX')){
  css+=`\n/* ATLAS_POPOVER_LAYERING_FIX */\n.birthField,.genderField,.phoneField{position:relative}.birthMenu,.genderMenu,.countryMenu{z-index:10000!important;opacity:1!important;isolation:isolate!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(100deg,#ff6b00,#ff007a) border-box!important;box-shadow:0 18px 45px rgba(8,18,38,.18)!important}.openPaymentButton{position:relative;z-index:1}\n`;
  fs.writeFileSync(cssPath,css);
}
