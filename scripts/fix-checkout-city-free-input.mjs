import fs from 'node:fs';

const path='src/components/checkout-form.tsx';
let src=fs.readFileSync(path,'utf8');

if(!src.includes('ATLAS_FREE_CITY_INPUT')){
  const old=`{key==="city"?<><input list="checkout-cities" value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)}/><datalist id="checkout-cities">{israelCities.map(city=><option value={city} key={city}/>)}</datalist></>:<input value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)} placeholder={key==="instagram"?(locale==="he"?"שם משתמש אינסטגרם (לא קישור)":locale==="ru"?"Имя пользователя Instagram (не ссылка)":"Instagram username (not a link)"):""}/>`;
  const replacement=`{key==="city"?<input /* ATLAS_FREE_CITY_INPUT */ value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)} autoComplete="address-level2" placeholder={locale==="he"?"הקלידו עיר":locale==="ru"?"Введите город":"Enter city"}/>:<input value={extras[key]||""} onChange={e=>setExtra(key,e.target.value)} placeholder={key==="instagram"?(locale==="he"?"שם משתמש אינסטגרם (לא קישור)":locale==="ru"?"Имя пользователя Instagram (не ссылка)":"Instagram username (not a link)"):""}/>`;
  if(src.includes(old)) src=src.replace(old,replacement);
  else throw new Error('checkout city datalist block not found');
  src=src.replace('import { israelCities } from "@/lib/israel-cities";\n','');
  fs.writeFileSync(path,src);
}
