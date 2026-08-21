import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_REQUIRED_AUTO_PAYMENT')){
  src=src.replace(
    'const[voucherWasApplied,setVoucherWasApplied]=useState(false);',
    'const[voucherWasApplied,setVoucherWasApplied]=useState(false);/* ATLAS_REQUIRED_AUTO_PAYMENT */const[validationAttempted,setValidationAttempted]=useState(false);const[touched,setTouched]=useState<Record<string,boolean>>({});const touch=(key:string)=>setTouched(prev=>({...prev,[key]:true}));'
  );

  src=src.replace(
    ' const formReady=contactReady&&requiredExtrasReady;\n const remaining=',
    ' const formReady=contactReady&&requiredExtrasReady;\n const nameInvalid=validationAttempted&&!contactReady&&(firstName.trim().length<2||lastName.trim().length<2);\n const emailInvalid=validationAttempted&&!validEmail(email);\n const phoneRequiredInvalid=validationAttempted&&(!validPhone(fullPhone)||!localPhoneValid);\n const requiredExtraInvalid=(key:GuestFieldKey)=>Boolean(props.guestFields[key]?.required)&&validationAttempted&&(key==="birthDate"?!birthDateToIso(extras[key]||""):!(extras[key]||"").trim());\n const genderRequiredInvalid=validationAttempted&&!gender;\n const remaining='
  );

  const autoAnchor=' useEffect(()=>{if(cancelled||!paymentUrl||!orderId||!requiredExtrasReady)return;if(detailsTimerRef.current)clearTimeout(detailsTimerRef.current);';
  if(src.includes(autoAnchor)){
    src=src.replace(autoAnchor,` useEffect(()=>{if(!formReady||paymentStage||paymentUrl||busy||expiredOpen||cancelled)return;const id=window.setTimeout(()=>{setPaymentStage(true);void startPayment();},450);return()=>window.clearTimeout(id);},[formReady,paymentStage,paymentUrl,busy,expiredOpen,cancelled,countryIso]);\n${autoAnchor}`);
  } else throw new Error('auto-payment insertion anchor not found');

  src=src.replace(
    '<div className={styles.field}><label>{text.fullName}</label><input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder={locale==="ru"?"Имя и фамилия":""}/></div>',
    '<div className={`${styles.field}${nameInvalid?` ${styles.requiredInvalid}`:""}`}><label>{text.fullName}</label><input value={fullName} onBlur={()=>touch("fullName")} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder={locale==="ru"?"Имя и фамилия":""}/></div>'
  );
  src=src.replace(
    '<div className={styles.field}><label>{text.email}</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>',
    '<div className={`${styles.field}${emailInvalid?` ${styles.requiredInvalid}`:""}`}><label>{text.email}</label><input type="email" value={email} onBlur={()=>touch("email")} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>'
  );
  src=src.replace(
    '<div className={styles.phoneField} ref={countryRef}>',
    '<div className={`${styles.phoneField}${phoneRequiredInvalid?` ${styles.requiredInvalid}`:""}`} ref={countryRef}>'
  );
  src=src.replace(
    'onBlur={()=>setPhoneTouched(true)} onChange={e=>{setPhoneTouched(true);setPhone(',
    'onBlur={()=>{setPhoneTouched(true);touch("phone")}} onChange={e=>{setPhoneTouched(true);setPhone('
  );
  src=src.replace(
    '<div className={`${styles.field} ${styles.birthField}`} ref={birthRef}>',
    '<div className={`${styles.field} ${styles.birthField}${requiredExtraInvalid("birthDate")?` ${styles.requiredInvalid}`:""}`} ref={birthRef}>'
  );
  src=src.replace(
    'className={styles.birthCancel} onClick={()=>setBirthOpen(false)}',
    'className={styles.birthCancel} onClick={()=>{touch("birthDate");setBirthOpen(false)}}'
  );
  src=src.replace(
    'className={styles.birthChoose} onClick={commitBirthDate}',
    'className={styles.birthChoose} onClick={()=>{touch("birthDate");commitBirthDate()}}'
  );
  src=src.replace(
    '<div className={`${styles.field} ${styles.genderField}`} ref={genderRef}>',
    '<div className={`${styles.field} ${styles.genderField}${genderRequiredInvalid?` ${styles.requiredInvalid}`:""}`} ref={genderRef}>'
  );
  src=src.replace(
    'function chooseGender(value:string){setDetailsReady(false);setGender(value);setGenderOpen(false);}',
    'function chooseGender(value:string){touch("gender");setDetailsReady(false);setGender(value);setGenderOpen(false);}'
  );

  src=src.replace(
    '{otherExtraKeys.map(key=><div className={styles.field} key={key}>',
    '{otherExtraKeys.map(key=><div className={`${styles.field}${requiredExtraInvalid(key)?` ${styles.requiredInvalid}`:""}`} key={key}>'
  );
  src=src.replace(
    'value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)} autoComplete="address-level2"',
    'value={extras[key]||""} onBlur={()=>touch(key)} onChange={e=>setExtra(key,e.target.value)} autoComplete="address-level2"'
  );
  src=src.replace(
    '<input value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)} placeholder=',
    '<input value={extras[key]||""} onBlur={()=>touch(key)} onChange={e=>setExtra(key,e.target.value)} placeholder='
  );

  const oldButton='{!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.contactContinue} disabled={!formReady||busy} onClick={()=>{setPaymentStage(true);void startPayment();}}>{locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}<span aria-hidden="true">→</span></button>}';
  const newButton='{!paymentStage&&!paymentUrl&&!birthOpen&&!genderOpen&&!countryOpen&&<button type="button" className={styles.contactContinue} disabled={busy} onClick={()=>{if(!formReady){setValidationAttempted(true);return;}setPaymentStage(true);void startPayment();}}>{locale==="he"?"מעבר לתשלום":locale==="ru"?"Перейти к оплате":"Continue to payment"}<span aria-hidden="true">→</span></button>}';
  if(src.includes(oldButton)) src=src.replace(oldButton,newButton); else throw new Error('checkout CTA anchor not found');
}

// Do not show phone validation before the customer explicitly attempts to continue.
src=src.replaceAll('const phoneInvalid=phoneTouched&&phone.length>0&&!localPhoneValid;','const phoneInvalid=validationAttempted&&phone.length>0&&!localPhoneValid;');
// Neutral example number: with Israel selected the rendered example is +972 00 000 0000.
src=src.replaceAll('placeholder="52 556 5457"','placeholder="00 000 0000"');
fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
const strongFrame=`\n/* ATLAS_REQUIRED_FIELD_STRONG_FRAME */\n.requiredInvalid{position:relative!important;border-color:transparent!important;box-shadow:none!important;isolation:isolate!important;background:#fff!important}.requiredInvalid::before{content:"";position:absolute;inset:-3px;border-radius:calc(18px + 3px);padding:3px;background:linear-gradient(100deg,#ff6a00 0%,#ff1f00 20%,#ff003d 42%,#ff008c 62%,#ff1f00 82%,#ff6a00 100%);background-size:420% 420%;animation:atlasRequiredFrameStrong 1.05s linear infinite;pointer-events:none;z-index:6;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;filter:saturate(1.35) contrast(1.08)}.requiredInvalid::after{display:none!important;content:none!important}.requiredInvalid:focus-within{border-color:transparent!important;box-shadow:none!important;background:#fff!important}.requiredInvalid label{color:#171b35!important;font-weight:750!important}.requiredInvalid .phoneControl,.requiredInvalid .phoneControlInvalid{border-color:#d8dce4!important;box-shadow:none!important;background:#fff!important}@keyframes atlasRequiredFrameStrong{0%{background-position:0% 50%}100%{background-position:420% 50%}}@media(prefers-reduced-motion:reduce){.requiredInvalid::before{animation:none!important}}\n`;
if(!css.includes('ATLAS_REQUIRED_FIELD_STRONG_FRAME')){
  css+=strongFrame;
  fs.writeFileSync(cssPath,css);
}
