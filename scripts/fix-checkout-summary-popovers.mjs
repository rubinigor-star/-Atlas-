import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_SUMMARY_POPOVER_V2')){
  src=src.replace(
    '<p className={styles.ticketCount}>{props.quantity} {ticketWord(props.quantity,locale)}</p>',
    '{/* ATLAS_SUMMARY_POPOVER_V2: quantity is shown on ticket line */}'
  );

  src=src.replace(
    '<div className={styles.seatLabel}>{item.label}</div>{item.quantity>1&&<div className={styles.seatMeta}>{item.quantity} {ticketWord(item.quantity,locale)}</div>}',
    '<div className={styles.seatLabel}>{item.label} × {item.quantity}</div>'
  );

  // Popovers must never change page height by hiding the CTA.
  src=src.replaceAll('&&!birthOpen&&!genderOpen&&!countryOpen','');
  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_SUMMARY_POPOVER_STYLES_V2')){
  css+=`\n/* ATLAS_SUMMARY_POPOVER_STYLES_V2 */\n.summaryTop{grid-template-columns:128px minmax(0,1fr)!important;gap:16px!important;align-items:start!important}.poster{width:128px!important;height:128px!important;border-radius:14px!important}.seatLabel{font-weight:850!important;font-size:14px!important}.ticketCount{display:none!important}\n.birthField,.genderField,.phoneField{position:relative!important}.birthMenu,.genderMenu,.countryMenu{z-index:2000!important;background:#fff!important;opacity:1!important;isolation:isolate!important;animation:atlasPopoverIn .18s cubic-bezier(.2,.8,.2,1) both;transform-origin:top center!important;will-change:transform,opacity}.birthMenu *,.genderMenu *,.countryMenu *{opacity:1}.contactContinue{position:relative;z-index:1}\n@keyframes atlasPopoverIn{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}\n@media(max-width:900px){.summaryTop{grid-template-columns:108px minmax(0,1fr)!important}.poster{width:108px!important;height:108px!important}}\n`;
  fs.writeFileSync(cssPath,css);
}
