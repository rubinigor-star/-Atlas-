import fs from 'node:fs';

const path='src/components/checkout-form.tsx';
let src=fs.readFileSync(path,'utf8');

// Keep the same idempotency key while the browser still owns an active cart hold.
const oldOrderKey=' function orderKey(){if(!orderKeyRef.current)orderKeyRef.current=crypto.randomUUID();return orderKeyRef.current;}';
const newOrderKey=' function orderKey(){if(orderKeyRef.current)return orderKeyRef.current;const key=`atlas-checkout-order-key-v1:${props.eventId}:${props.eventSlug}`;let value="";try{if(readExpiry(props.eventSlug,props.title)>Date.now())value=localStorage.getItem(key)||"";}catch{}if(!value)value=crypto.randomUUID();try{localStorage.setItem(key,value);}catch{}orderKeyRef.current=value;return value;}';
if(src.includes(oldOrderKey))src=src.replace(oldOrderKey,newOrderKey);
else if(!src.includes('atlas-checkout-order-key-v1:'))throw new Error('checkout orderKey anchor not found');

if(!src.includes('ATLAS_CHECKOUT_DRAFT_MEMORY')){
  const consentAnchor='/* ATLAS_REQUIRED_AUTO_PAYMENT */ /* ATLAS_CONSENTS_VOUCHER_BUTTON */ const[consentAtlas,setConsentAtlas]=useState(false);const[consentOrganizer,setConsentOrganizer]=useState(false);const[validationAttempted,setValidationAttempted]=useState(false);';
  if(!src.includes(consentAnchor))throw new Error('checkout consent state anchor not found for draft memory');
  const draft=`${consentAnchor}\n /* ATLAS_CHECKOUT_DRAFT_MEMORY */ const checkoutDraftKey=\`atlas-checkout-draft-v1:\${props.eventId}:\${props.eventSlug}\`;const checkoutDraftLoadedRef=useRef(false);const checkoutDraftSkipSaveRef=useRef(true);\n useEffect(()=>{try{const raw=localStorage.getItem(checkoutDraftKey);if(raw){const value=JSON.parse(raw);if(value&&Date.now()-Number(value.savedAt||0)<30*60*1000){if(typeof value.firstName==="string")setFirstName(value.firstName);if(typeof value.lastName==="string")setLastName(value.lastName);if(typeof value.email==="string")setEmail(value.email);if(typeof value.phone==="string")setPhone(value.phone);if(typeof value.promo==="string")setPromo(value.promo);if(typeof value.gender==="string")setGender(value.gender);if(typeof value.countryIso==="string")setCountryIso(value.countryIso);if(value.extras&&typeof value.extras==="object"){setExtras(value.extras);const parts=String(value.extras.birthDate||"").split("-").map(Number);if(parts.length===3&&parts.every(Number.isFinite)){setBirthYear(parts[0]);setBirthMonth(parts[1]);setBirthDay(parts[2]);}}if(typeof value.consentAtlas==="boolean")setConsentAtlas(value.consentAtlas);if(typeof value.consentOrganizer==="boolean")setConsentOrganizer(value.consentOrganizer);}else localStorage.removeItem(checkoutDraftKey);}}catch{}checkoutDraftLoadedRef.current=true;},[checkoutDraftKey]);\n useEffect(()=>{if(!checkoutDraftLoadedRef.current)return;if(checkoutDraftSkipSaveRef.current){checkoutDraftSkipSaveRef.current=false;return;}const timer=window.setTimeout(()=>{try{localStorage.setItem(checkoutDraftKey,JSON.stringify({savedAt:Date.now(),firstName,lastName,email,phone,promo,gender,countryIso,extras,consentAtlas,consentOrganizer}));}catch{}},80);return()=>window.clearTimeout(timer);},[checkoutDraftKey,firstName,lastName,email,phone,promo,gender,countryIso,extras,consentAtlas,consentOrganizer]);`;
  src=src.replace(consentAnchor,draft);
}

fs.writeFileSync(path,src);
console.log('Checkout draft and active cart order identity persist across HYP navigation.');
