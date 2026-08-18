import fs from 'node:fs';

const cssPath = 'src/components/checkout-form.module.css';
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('ATLAS_UNIFIED_PAYMENT_CARD')) {
  css += `
/* ATLAS_UNIFIED_PAYMENT_CARD */
.paymentWrap .voucherCard{
  margin-bottom:0!important;
  border-radius:18px 18px 0 0!important;
  border-bottom:1px solid #edf0f3!important;
  box-shadow:none!important;
}
.paymentWrap .paymentCard{
  border-radius:0 0 18px 18px!important;
  border-top:0!important;
  box-shadow:none!important;
}
.paymentWrap .voucherCard + .paymentCard{
  margin-top:0!important;
}
@media(max-width:640px){
  .paymentWrap .voucherCard{border-radius:18px 18px 0 0!important}
  .paymentWrap .paymentCard{border-radius:0 0 18px 18px!important}
}
`;
  fs.writeFileSync(cssPath, css);
}
