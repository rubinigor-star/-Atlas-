if (process.env.VERCEL_ENV !== 'preview') { console.log('[HYP XPO auth probe] skipped outside preview'); process.exit(0); }
const masof=(process.env.HYP_MASOF||'').trim(); const key=(process.env.HYP_API_KEY||'').trim(); const passp=(process.env.HYP_PASSP||'').trim();
if(!masof||!key||!passp){console.log('[HYP XPO auth probe] missing HYP vars');process.exit(0);}
const endpoint='https://cguat2.creditguard.co.il/xpo/Relay';
const esc=v=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const extract=(text,tag)=>text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]?.trim()||'';
const variants=[
 {label:'key/passp/masof',user:key,password:passp,terminal:masof},
 {label:'masof/passp/masof',user:masof,password:passp,terminal:masof},
 {label:'masof/key/masof',user:masof,password:key,terminal:masof},
 {label:'key/masof/masof',user:key,password:masof,terminal:masof},
 {label:'passp/key/masof',user:passp,password:key,terminal:masof},
 {label:'passp/masof/masof',user:passp,password:masof,terminal:masof},
 {label:'key/passp/key',user:key,password:passp,terminal:key},
 {label:'masof/passp/key',user:masof,password:passp,terminal:key}
];
for(const v of variants){
 const xml=`<ashrait><request><version>2000</version><language>Eng</language><dateTime/><requestId/><command>getSessionId</command><getSessionId><terminalNumber>${esc(v.terminal)}</terminalNumber></getSessionId></request></ashrait>`;
 try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Atlas-One-XPO-Auth-Probe/1.0'},body:new URLSearchParams({user:v.user,password:v.password,int_in:xml}),signal:AbortSignal.timeout(12000)});const text=(await r.text()).slice(0,20000);console.log('[HYP XPO auth probe]',JSON.stringify({variant:v.label,httpStatus:r.status,result:extract(text,'result')||null,message:extract(text,'message')||extract(text,'userMessage')||null,additionalInfo:extract(text,'additionalInfo')||null,hasSessionId:Boolean(extract(text,'sessionId'))}));}catch(error){console.log('[HYP XPO auth probe]',JSON.stringify({variant:v.label,error:error instanceof Error?error.message:'probe failed'}));}
}
