const branch=process.env.VERCEL_GIT_COMMIT_REF||'';
if(branch!=='fix/valuecard-city-field-20260821') process.exit(0);
const url='https://valuecard.co.il/Documentation/POS/swagger.json';
try{
 const r=await fetch(url); const spec=await r.json();
 const schemas=spec?.components?.schemas||{};
 const citySchemas=[];
 for(const [name,schema] of Object.entries(schemas)){
   const s=JSON.stringify(schema);
   if(/city/i.test(s)) citySchemas.push({name,schema});
 }
 console.log('[valuecard-city-schemas]',JSON.stringify(citySchemas));
 const schemaNames=new Set(citySchemas.map(x=>x.name));
 const pathHits=[];
 for(const [path,item] of Object.entries(spec?.paths||{})){
   const s=JSON.stringify(item);
   if([...schemaNames].some(name=>s.includes(`#/components/schemas/${name}`)) || /ClubMember/i.test(s)) {
     pathHits.push({path,item});
   }
 }
 console.log('[valuecard-member-paths]',JSON.stringify(pathHits));
 const likelyInputs=[];
 for(const [name,schema] of Object.entries(schemas)){
   const props=schema?.properties||{};
   if((props.firstName||props.FirstName) && (props.cellPhone||props.CellPhone)) likelyInputs.push({name,schema});
 }
 console.log('[valuecard-member-input-like-schemas]',JSON.stringify(likelyInputs));
}catch(e){console.log('[valuecard-city-probe-error]',e instanceof Error?e.message:String(e));}
