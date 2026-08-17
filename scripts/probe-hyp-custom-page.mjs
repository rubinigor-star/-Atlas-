if (process.env.VERCEL_ENV !== 'preview') {
  console.log('[HYP custom page probe] skipped outside preview');
  process.exit(0);
}

const endpoint = 'https://pay.hyp.co.il/p/';
const Masof = (process.env.HYP_MASOF || '').trim();
const KEY = (process.env.HYP_API_KEY || '').trim();
const PassP = (process.env.HYP_PASSP || '').trim();
if (!Masof || !KEY || !PassP) {
  console.log('[HYP custom page probe] missing HYP vars');
  process.exit(0);
}

const config = JSON.stringify({
  frameAncestorURLs: 'https://atlas-one.co',
  uiCustomData: {
    customStyle: '#cg-amount-title,#cg-form-title,#cg-pd-title,#cg-header{display:none}',
    customText: {'cg-submit-btn':'Pay with Atlas'},
    disableTxnRedirectPopup: true
  }
});

const payment = new URLSearchParams({
  action:'pay', Masof, Amount:'1.00', Coin:'1', Info:'Atlas custom page POC', Order:`ATLAS-POC-${Date.now()}`,
  ClientName:'Atlas', ClientLName:'POC', PageLang:'ENG', UTF8:'True', UTF8out:'True', MoreData:'True', Sign:'True',
  Tash:'1', FixTash:'True', sendemail:'False', SendHesh:'False', Postpone:'False', J5:'False', tmp:'5',
  ReturnUrl:'https://atlas-one.co/payments/hyp/result', SuccessUrl:'https://atlas-one.co/payments/hyp/result',
  ErrorUrl:'https://atlas-one.co/payments/hyp/result', CancelUrl:'https://atlas-one.co/payments/hyp/result',
  ppsJSONConfig: config
});
const sign = new URLSearchParams({action:'APISign',What:'SIGN',KEY,PassP,Masof});
for (const [k,v] of payment) if (!['action','Masof'].includes(k)) sign.append(k,v);

try {
  const response = await fetch(`${endpoint}?${sign}`, {headers:{accept:'text/plain,application/x-www-form-urlencoded,*/*'}, signal:AbortSignal.timeout(15000)});
  const text = (await response.text()).trim();
  let signed;
  try { const j=JSON.parse(text); signed=new URLSearchParams(Object.entries(j).map(([k,v])=>[k,v==null?'':String(v)])); }
  catch { signed=new URLSearchParams(text.replace(/^\?/,'')); }
  const hasSignature=Boolean(signed.get('signature'));
  const configValue=signed.get('ppsJSONConfig') || '';
  const preserved=configValue===config;
  const action=signed.get('action')||'';
  console.log('[HYP custom page probe] sign', JSON.stringify({httpStatus:response.status,action,hasSignature,ppsJSONConfigPresent:Boolean(configValue),ppsJSONConfigPreserved:preserved,returnedKeys:[...signed.keys()].filter(k=>!['signature','KEY','PassP'].includes(k))}));
  if (!response.ok || !hasSignature || action!=='pay') process.exit(0);
  const pageUrl=`${endpoint}?${signed.toString()}`;
  const page=await fetch(pageUrl,{redirect:'manual',headers:{'user-agent':'Atlas-One-HYP-Custom-Page-Probe/1.0'},signal:AbortSignal.timeout(15000)});
  const html=(await page.text()).slice(0,200000);
  console.log('[HYP custom page probe] page', JSON.stringify({httpStatus:page.status,location:page.headers.get('location')||null,contentType:page.headers.get('content-type')||null,hasCgContainer:/cg-container|cg-submit-btn|cg-tx-form/i.test(html),hasLegacyMarkers:/yaad|tmp=|credit card/i.test(html),htmlLength:html.length}));
} catch (error) {
  console.log('[HYP custom page probe] error', JSON.stringify({message:error instanceof Error?error.message:'probe failed'}));
}
