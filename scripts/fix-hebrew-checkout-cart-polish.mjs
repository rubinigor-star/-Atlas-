import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
const cartCssPath='src/app/cart-drawer-motion.css';

let src=fs.readFileSync(tsxPath,'utf8');
if(!src.includes('ATLAS_HEBREW_CHECKOUT_POLISH')){
  src='/* ATLAS_HEBREW_CHECKOUT_POLISH */\n'+src;
  src=src.replace('total:"סה״כ",serviceFee:"עמלת שירות"','total:"סה״כ לתשלום",serviceFee:"עמלת שירות"');
  src=src.replace('locale==="he"?`כולל עמלת שירות ${money(props.serviceFee,"ILS",locale)}`','locale==="he"?`+ עמלת שירות ${money(props.serviceFee,"ILS",locale)}`');
  src=src.replace('locale==="he"?"יום.חודש.שנה":"DD.MM.YYYY"','locale==="he"?"תאריך לידה":"DD.MM.YYYY"');
}
if(!src.includes('ATLAS_PHONE_LTR_ORDER')){
  src=src.replace('className={`${styles.phoneControl}${phoneInvalid?` ${styles.phoneControlInvalid}`:""}`}>','className={`${styles.phoneControl}${phoneInvalid?` ${styles.phoneControlInvalid}`:""}`} dir="ltr" data-atlas-phone-ltr="true">');
  src='/* ATLAS_PHONE_LTR_ORDER */\n'+src;
}
fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_HEBREW_CHECKOUT_POLISH_STYLES')){
  css+=`\n/* ATLAS_HEBREW_CHECKOUT_POLISH_STYLES */\n:global([dir="rtl"]) .phoneControl{direction:ltr!important;justify-content:flex-start!important;flex-direction:row!important}\n:global([dir="rtl"]) .phoneControl input{direction:ltr!important;text-align:left!important;unicode-bidi:plaintext!important}\n:global([dir="rtl"]) .dialCode{direction:ltr!important;unicode-bidi:isolate!important}\n:global([dir="rtl"]) .flagButton{order:1!important}\n:global([dir="rtl"]) .dialCode{order:2!important}\n:global([dir="rtl"]) .phoneControl input{order:3!important}\n:global([dir="rtl"]) .birthTrigger{direction:rtl!important;display:flex!important;align-items:center!important}\n:global([dir="rtl"]) .birthTrigger::after{content:"‹";font-size:25px;line-height:1;color:#9aa0ac;margin-inline-start:2px}\n:global([dir="rtl"]) .birthTrigger .calendarIcon{margin-inline-start:auto!important}\n`;
} else if(!css.includes('ATLAS_PHONE_LTR_FORCE')){
  css+=`\n/* ATLAS_PHONE_LTR_FORCE */\n:global([dir="rtl"]) .phoneControl{direction:ltr!important;justify-content:flex-start!important;flex-direction:row!important}\n:global([dir="rtl"]) .phoneControl input{direction:ltr!important;text-align:left!important;unicode-bidi:plaintext!important;order:3!important}\n:global([dir="rtl"]) .flagButton{order:1!important}\n:global([dir="rtl"]) .dialCode{direction:ltr!important;unicode-bidi:isolate!important;order:2!important}\n`;
}
fs.writeFileSync(cssPath,css);

let cartCss=fs.readFileSync(cartCssPath,'utf8');
if(!cartCss.includes('ATLAS_HEBREW_CART_LEFT_EDGE')){
  cartCss+=`\n/* ATLAS_HEBREW_CART_LEFT_EDGE */\n[dir="rtl"] .atlas-cart-panel{left:0!important;right:auto!important;inset-inline-start:0!important;inset-inline-end:auto!important}\n[dir="rtl"] .atlas-cart-panel{animation-name:atlas-cart-drawer-in-rtl!important}\n[dir="rtl"] .atlas-cart-overlay[data-cart-closing="true"] .atlas-cart-panel{animation-name:atlas-cart-drawer-out-rtl!important}\n`;
  fs.writeFileSync(cartCssPath,cartCss);
}
