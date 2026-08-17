if (process.env.VERCEL_ENV !== 'preview') { console.log('[HYP custom page probe] skipped outside preview'); process.exit(0); }
const endpoint='https://pay.hyp.co.il/p/'; const Masof=(process.env.HYP_MASOF||'').trim(); const KEY=(process.env.HYP_API_KEY||'').trim(); const PassP=(process.env.HYP_PASSP||'').trim();
if(!Masof||!KEY||!PassP){console.log('[HYP custom page probe] missing HYP vars');process.exit(0);}
const config=JSON.stringify({frameAncestorURLs:'https://atlas-one.co',uiCustomData:{customStyle:'#cg-amount-title,#cg-form-title,#cg-pd-title,#cg-header{display:none}'}});
const payment=new URLSearchParams({action:'pay',Masof,Amount:'1.00',Coin:'1',Info:'Atlas custom page POC',Order:`ATLAS-POC-${Date.now()}`,ClientName:'Atlas',ClientLName:'POC',PageLang:'ENG',UTF8:'True',UTF8out:'True',MoreData:'True',Sign:'True',Tash:'1',FixTash:'True',sendemail:'False',SendHesh:'False',Postpone:'False',J5:'False',tmp:'5',ReturnUrl:'https://atlas-one.co/payments/hyp/result',SuccessUrl:'https://atlas-one.co/payments/hyp/result',ErrorUrl:'https://atlas-one.co/payments/hyp/result',CancelUrl:'https://atlas-one.co/payments/hyp/result',ppsJSONConfig:config});
const sign=new URLSearchParams({action:'APISign',What:'SIGN',KEY,PassP,Masof});for(const[k,v]of payment)if(!['action','Masof'].includes(k))sign.append(k,v);
try{
 const sr=await fetch(`${endpoint}?${sign}`,{signal:AbortSignal.timeout(15000)});const st=(await sr.text()).trim();let signed;try{const j=JSON.parse(st);signed=new URLSearchParams(Object.entries(j).map(([k,v])=>[k,v==null?'':String(v)]));}catch{signed=new URLSearchParams(st.replace(/^\?/,''));}
 if(!signed.get('signature')){console.log('[HYP custom page probe] no signature');process.exit(0);}
 const pr=await fetch(`${endpoint}?${signed.toString()}`,{signal:AbortSignal.timeout(15000)});const html=(await pr.text()).slice(0,300000);
 const scriptSources=[...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>m[1]))];
 const formTag=html.match(/<form\b[^>]*>/i)?.[0]||'';
 const recaptchaScript=scriptSources.find(x=>/recaptcha/i.test(x))||'';
 const siteKey=(recaptchaScript.match(/[?&]render=([^&"']+)/i)?.[1]||html.match(/data-sitekey=["']([^"']+)/i)?.[1]||'');
 const protection={hasGrecaptchaExecute:/grecaptcha\s*\.\s*execute/i.test(html),hasGrecaptchaReady:/grecaptcha\s*\.\s*ready/i.test(html),hasRecapTokenField:/name=["']recapToken["']/i.test(html),hasRecapActionField:/name=["']recapAction["']/i.test(html),hasSecTransField:/name=["']SecTrans["']/i.test(html),secTransHasNonEmptyValue:/name=["']SecTrans["'][^>]*value=["'][^"']+/i.test(html)||/value=["'][^"']+["'][^>]*name=["']SecTrans["']/i.test(html),formHasOnSubmit:/<form\b[^>]*onsubmit=/i.test(formTag),recaptchaScriptHost:(()=>{try{return new URL(recaptchaScript,endpoint).host}catch{return''}})(),siteKeyPresent:Boolean(siteKey)};
 console.log('[HYP custom page probe] protections',JSON.stringify(protection));
}catch(error){console.log('[HYP custom page probe] error',JSON.stringify({message:error instanceof Error?error.message:'probe failed'}));}
