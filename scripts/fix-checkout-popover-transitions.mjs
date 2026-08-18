import fs from 'node:fs';

const tsxPath='src/components/checkout-form.tsx';
const cssPath='src/components/checkout-form.module.css';
let src=fs.readFileSync(tsxPath,'utf8');

if(!src.includes('ATLAS_POPOVER_SMOOTH_CLOSE')){
  src=src.replace(
    'const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");const[promo,setPromo]=useState("");const[gender,setGender]=useState("");const[genderOpen,setGenderOpen]=useState(false);const[countryIso,setCountryIso]=useState("IL");const[countryOpen,setCountryOpen]=useState(false);const[phoneTouched,setPhoneTouched]=useState(false);const[birthOpen,setBirthOpen]=useState(false);',
    'const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[phone,setPhone]=useState("");const[promo,setPromo]=useState("");const[gender,setGender]=useState("");const[genderOpen,setGenderOpen]=useState(false);const[genderClosing,setGenderClosing]=useState(false);const[countryIso,setCountryIso]=useState("IL");const[countryOpen,setCountryOpen]=useState(false);const[countryClosing,setCountryClosing]=useState(false);const[phoneTouched,setPhoneTouched]=useState(false);const[birthOpen,setBirthOpen]=useState(false);const[birthClosing,setBirthClosing]=useState(false);'
  );

  src=src.replace(
    'function setExtra(key:string,value:string){setDetailsReady(false);setExtras(prev=>({...prev,[key]:value}));}',
    'function closeBirth(){if(!birthOpen||birthClosing)return;setBirthClosing(true);window.setTimeout(()=>{setBirthOpen(false);setBirthClosing(false)},180);} function closeGender(){if(!genderOpen||genderClosing)return;setGenderClosing(true);window.setTimeout(()=>{setGenderOpen(false);setGenderClosing(false)},180);} function closeCountry(){if(!countryOpen||countryClosing)return;setCountryClosing(true);window.setTimeout(()=>{setCountryOpen(false);setCountryClosing(false)},180);} function setExtra(key:string,value:string){setDetailsReady(false);setExtras(prev=>({...prev,[key]:value}));}'
  );

  src=src.replace('function chooseGender(value:string){setDetailsReady(false);setGender(value);setGenderOpen(false);}','function chooseGender(value:string){setDetailsReady(false);setGender(value);closeGender();}');
  src=src.replace('setExtra("birthDate",iso);setBirthOpen(false);','setExtra("birthDate",iso);closeBirth();');
  src=src.replaceAll('setGenderOpen(false);if(countryOpen','closeGender();if(countryOpen');
  src=src.replaceAll('setCountryOpen(false);if(birthOpen','closeCountry();if(birthOpen');
  src=src.replaceAll('setBirthOpen(false)};const esc','closeBirth()};const esc');
  src=src.replace('setGenderOpen(false);setCountryOpen(false);setBirthOpen(false)','closeGender();closeCountry();closeBirth()');

  src=src.replace('onClick={()=>setBirthOpen(v=>!v)}','onClick={()=>{if(birthOpen)closeBirth();else{setBirthClosing(false);setBirthOpen(true)}}}');
  src=src.replace('onClick={()=>setGenderOpen(open=>!open)}','onClick={()=>{if(genderOpen)closeGender();else{setGenderClosing(false);setGenderOpen(true)}}}');
  src=src.replace('onClick={()=>setCountryOpen(v=>!v)}','onClick={()=>{if(countryOpen)closeCountry();else{setCountryClosing(false);setCountryOpen(true)}}}');
  src=src.replaceAll('setCountryIso(c.iso);setCountryOpen(false)','setCountryIso(c.iso);closeCountry()');
  src=src.replaceAll('className={styles.birthMenu}>','className={`${styles.birthMenu}${birthClosing?` ${styles.popoverClosing}`:""}`}>');
  src=src.replaceAll('className={styles.genderMenu} role="listbox">','className={`${styles.genderMenu}${genderClosing?` ${styles.popoverClosing}`:""}`} role="listbox">');
  src=src.replaceAll('className={styles.countryMenu} role="listbox">','className={`${styles.countryMenu}${countryClosing?` ${styles.popoverClosing}`:""}`} role="listbox">');
  src=src.replace('className={styles.birthCancel} onClick={()=>setBirthOpen(false)}','className={styles.birthCancel} onClick={closeBirth}');
  src='/* ATLAS_POPOVER_SMOOTH_CLOSE */\n'+src;
}

// Hebrew checkout action follows RTL direction. Keep RU/EN unchanged.
src=src.replaceAll('<span aria-hidden="true">→</span>','<span aria-hidden="true">{locale==="he"?"←":"→"}</span>');
fs.writeFileSync(tsxPath,src);

let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('ATLAS_POPOVER_TRANSITIONS_FINAL')){
  css+=`\n/* ATLAS_POPOVER_TRANSITIONS_FINAL */\n.contactBlock{position:relative}\n.contactBlock:has(.birthMenu),.contactBlock:has(.genderMenu),.contactBlock:has(.countryMenu){z-index:5000!important}\n.birthField:has(.birthMenu),.genderField:has(.genderMenu),.phoneField:has(.countryMenu){z-index:6000!important;isolation:isolate!important}\n.birthMenu,.genderMenu,.countryMenu{z-index:7000!important;background:#fff!important;opacity:1!important;transform-origin:top center!important;animation:atlasPopoverOpen .2s cubic-bezier(.2,.8,.2,1) both!important;will-change:transform,opacity!important}\n.popoverClosing{pointer-events:none!important;animation:atlasPopoverClose .18s cubic-bezier(.4,0,1,1) both!important}\n.contactContinue{position:relative!important;z-index:1!important}\n@keyframes atlasPopoverOpen{0%{opacity:0;transform:translateY(-10px) scale(.975)}100%{opacity:1;transform:translateY(0) scale(1)}}\n@keyframes atlasPopoverClose{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-9px) scale(.985)}}\n@media(prefers-reduced-motion:reduce){.birthMenu,.genderMenu,.countryMenu,.popoverClosing{animation-duration:.01ms!important}}\n`;
}
if(!css.includes('ATLAS_POPOVER_ABOVE_CTA_FINAL')){
  css+=`\n/* ATLAS_POPOVER_ABOVE_CTA_FINAL */\n.contactCard:has(.birthMenu),.contactCard:has(.genderMenu),.contactCard:has(.countryMenu){position:relative!important;z-index:12000!important;overflow:visible!important}\n.contactBlock:has(.birthMenu),.contactBlock:has(.genderMenu),.contactBlock:has(.countryMenu){position:relative!important;z-index:11000!important;overflow:visible!important}\n.birthField:has(.birthMenu),.genderField:has(.genderMenu),.phoneField:has(.countryMenu){position:relative!important;z-index:13000!important}\n.birthMenu,.genderMenu,.countryMenu{z-index:14000!important}\n.contactContinue{z-index:0!important}\n`;
}
fs.writeFileSync(cssPath,css);
