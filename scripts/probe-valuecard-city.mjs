const branch=process.env.VERCEL_GIT_COMMIT_REF||'';
if(branch!=='fix/valuecard-city-field-20260821') process.exit(0);
const url='https://valuecard.co.il/Documentation/POS/swagger.json';
try{
 const r=await fetch(url); const spec=await r.json();
 const schemas=spec?.components?.schemas||{};
 console.log('[valuecard-update-schema]',JSON.stringify(schemas.ClubMemberUpdateParameters||null));
 console.log('[valuecard-register-schema]',JSON.stringify(schemas.RegisterClubMemberParameters||null));
 console.log('[valuecard-details-schema]',JSON.stringify(schemas.SpClubMemberDetailsResult||null));
}catch(e){console.log('[valuecard-city-probe-error]',e instanceof Error?e.message:String(e));}
