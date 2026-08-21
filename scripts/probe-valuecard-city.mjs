const branch=process.env.VERCEL_GIT_COMMIT_REF||'';
if(branch!=='fix/valuecard-city-field-20260821') process.exit(0);
const url='https://valuecard.co.il/Documentation/POS/swagger.json';
try{
 const r=await fetch(url); const spec=await r.json();
 const schemas=spec?.components?.schemas||{};
 const hits=[];
 for(const [name,schema] of Object.entries(schemas)){
   const s=JSON.stringify(schema);
   if(/city/i.test(s)) hits.push({name,schema});
 }
 console.log('[valuecard-city-schemas]',JSON.stringify(hits));
 const pathHits=[];
 for(const [path,item] of Object.entries(spec?.paths||{})){
   const s=JSON.stringify(item);
   if(/city/i.test(s)) pathHits.push({path,item});
 }
 console.log('[valuecard-city-paths]',JSON.stringify(pathHits));
}catch(e){console.log('[valuecard-city-probe-error]',e instanceof Error?e.message:String(e));}
