if (process.env.VERCEL_ENV !== 'preview') {
  console.log('[HYP XPO probe] skipped outside preview');
  process.exit(0);
}

const terminal = (process.env.HYP_MASOF || '').trim();
const user = (process.env.HYP_API_KEY || '').trim();
const password = (process.env.HYP_PASSP || '').trim();
if (!terminal || !user || !password) {
  console.log('[HYP XPO probe] missing existing HYP variables');
  process.exit(0);
}

const endpoint = 'https://pay.hyp.co.il/xpo/Relay';
const esc = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const xml = `<ashrait><request><version>2000</version><language>Eng</language><dateTime/><requestId/><command>getSessionId</command><getSessionId><terminalNumber>${esc(terminal)}</terminalNumber></getSessionId></request></ashrait>`;
const body = new URLSearchParams({ user, password, int_in: xml });
const extract = (text, tag) => text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]?.trim() || '';

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Atlas-One-HYP-XPO-Probe/1.0' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = (await response.text()).slice(0, 12000);
  const result = extract(text, 'result');
  const message = extract(text, 'message') || extract(text, 'userMessage');
  const sessionId = extract(text, 'sessionId');
  console.log('[HYP XPO probe]', JSON.stringify({ endpointHost:'pay.hyp.co.il', httpStatus:response.status, responseType:text.trim().startsWith('<')?'xml':'other', result:result||null, message:message||null, hasSessionId:Boolean(sessionId), credentialsPresent:true }));
} catch (error) {
  console.log('[HYP XPO probe]', JSON.stringify({ endpointHost:'pay.hyp.co.il', error:error instanceof Error?error.message:'probe failed', credentialsPresent:true }));
}
