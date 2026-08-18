import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';

let src=fs.readFileSync(tsxPath,'utf8');
const iframe='<iframe ref={iframeRef} src={paymentUrl} title={text.payment} allow="payment" onLoad={handleFrameLoad} className={styles.paymentFrame}/>';
if(!src.includes('ATLAS_HYP_HEADER_CROP') && src.includes(iframe)){
  src=src.replace(iframe,`{/* ATLAS_HYP_HEADER_CROP */}<div className={styles.paymentFrameCrop}>${iframe}</div>`);
  fs.writeFileSync(tsxPath,src);
}

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_HYP_HEADER_CROP_STYLES')){
  css+=`\n/* ATLAS_HYP_HEADER_CROP_STYLES */\n.paymentFrameCrop{height:548px;overflow:hidden;background:#fff}.paymentFrameCrop .paymentFrame{height:680px!important;min-height:680px!important;transform:translateY(-132px);display:block}\n@media(max-width:900px){.paymentFrameCrop{height:548px}.paymentFrameCrop .paymentFrame{width:calc(100% + 50px)!important;max-width:none!important;margin-left:-25px!important;transform:translateY(-132px)!important}}\n`;
  fs.writeFileSync(cssPath,css);
}
