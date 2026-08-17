if (process.env.VERCEL_ENV !== 'preview') { console.log('[HYP custom page probe] skipped outside preview'); process.exit(0); }
const endpoint='https://pay.hyp.co.il/p/'; const Masof=(process.env.HYP_MASOF||'').trim(); const KEY=(process.env.HYP_API_KEY||'').trim(); const PassP=(process.env.HYP_PASSP||'').trim();
if(!Masof||!KEY||!PassP){console.log('[HYP custom page probe] missing HYP vars');process.exit(0);}
const config=JSON.stringify({frameAncestorURLs:'https://atlas-one.co',uiCustomData:{customStyle:'#cg-amount-title,#cg-form-title,#cg-pd-title,#cg-header{display:none}',customText:{'cg-submit-btn':'Pay with Atlas'}}});
const payment=new URLSearchParams({action:'pay',Masof,Amount:'1.00',Coin:'1',Info:'Atlas custom page POC',Order:`ATLAS-POC-${Date.now()}`,ClientName:'Atlas',ClientLName:'POC',PageLang:'ENG',UTF8:'True',UTF8out:'True',MoreData:'True',Sign:'True',Tash:'1',FixTash:'True',sendemail:'False',SendHesh:'False',Postpone:'False',J5:'False',tmp:'5',ReturnUrl:'https://atlas-one.co/payments/hyp/result',SuccessUrl:'https://atlas-one.co/payments/hyp/result',ErrorUrl:'https://atlas-one.co/payments/hyp/result',CancelUrl:'https://atlas-one.co/payments/hyp/result',ppsJSONConfig:config});
const sign=new URLSearchParams({action:'APISign',What:'SIGN',KEY,PassP,Masof}); for(const[k,v]of payment)if(!['action','Masof'].includes(k))sign.append(k,v);
try{
 const sr=await fetch(`${endpoint}?${sign}`,{signal:AbortSignal.timeout(15000)}); const st=(await sr.text()).trim(); let signed; try{const j=JSON.parse(st);signed=new URLSearchParams(Object.entries(j).map(([k,v])=>[k,v==null?'':String(v)]));}catch{signed=new URLSearchParams(st.replace(/^\?/,''));}
 console.log('[HYP custom page probe] sign',JSON.stringify({httpStatus:sr.status,action:signed.get('action'),hasSignature:Boolean(signed.get('signature')),ppsJSONConfigPreserved:signed.get('ppsJSONConfig')===config}));
 if(!signed.get('signature'))process.exit(0);
 const pr=await fetch(`${endpoint}?${signed.toString()}`,{signal:AbortSignal.timeout(15000)}); const html=(await pr.text()).slice(0,250000);
 const form=html.match(/<form\b[\s\S]*?<\/form>/i)?.[0]||''; const formTag=form.match(/<form\b[^>]*>/i)?.[0]||'';
 const method=formTag.match(/method=["']([^"']+)/i)?.[1]||'GET'; const action=formTag.match(/action=["']([^"']+)/i)?.[1]||'';
 const fields=[...form.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].map(m=>{const attrs=m[2];return {tag:m[1].toLowerCase(),name:attrs.match(/name=["']([^"']+)/i)?.[1]||'',type:attrs.match(/type=["']([^"']+)/i)?.[1]||'',id:attrs.match(/id=["']([^"']+)/i)?.[1]||''};}).filter(x=>x.name);
 const safeFields=[...new Map(fields.map(x=>[`${x.tag}:${x.name}`,x])).values()];
 console.log('[HYP custom page probe] legacy-form',JSON.stringify({httpStatus:pr.status,method,action,fieldCount:safeFields.length,fields:safeFields.slice(0,120),hasCg:/cg-container|cg-submit-btn/i.test(html)}));
}catch(error){console.log('[HYP custom page probe] error',JSON.stringify({message:error instanceof Error?error.message:'probe failed'}));}
