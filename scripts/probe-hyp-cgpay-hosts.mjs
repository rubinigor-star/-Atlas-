if (process.env.VERCEL_ENV !== 'preview') { console.log('[HYP host probe] skipped outside preview'); process.exit(0); }
const terminal=(process.env.HYP_MASOF||'').trim();
const user=(process.env.HYP_API_KEY||'').trim();
const password=(process.env.HYP_PASSP||'').trim();
if(!terminal||!user||!password){console.log('[HYP host probe] missing HYP vars');process.exit(0);}
const xml=`<ashrait><request><version>2000</version><language>ENG</language><command>getSessionId</command><getSessionId><terminalNumber>${terminal.replace(/[^0-9]/g,'')}</terminalNumber></getSessionId></request></ashrait>`;
const targets=[];
for(let i=1;i<=10;i++) for(const path of ['/xpo/Relay','/xpo/services/Relay']) targets.push(`https://cgpay${i}.creditguard.co.il${path}`);
console.log('[HYP host probe] probing',targets.length,'production endpoints');
for(const url of targets){
  try{
    const body=new URLSearchParams({user,password,int_in:xml});
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)});
    const text=(await res.text()).slice(0,12000);
    const result=text.match(/<result>([^<]*)<\/result>/i)?.[1]||'';
    const message=text.match(/<message>([^<]*)<\/message>/i)?.[1]||'';
    const hasSession=/<sessionId>[^<]+<\/sessionId>/i.test(text);
    console.log('[HYP host probe]',JSON.stringify({url,httpStatus:res.status,result,message,hasSession,responseType:/<ashrait>/i.test(text)?'xml':'other'}));
  }catch(error){console.log('[HYP host probe]',JSON.stringify({url,error:error instanceof Error?error.message:'failed'}));}
}
