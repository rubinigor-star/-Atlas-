"use client";

import { useState } from "react";

export function SmsTestPanel({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState("Atlas One: SMS integration test completed successfully.");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function sendTest() {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/platform/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return <section style={{maxWidth:720,margin:"40px auto",padding:24}}>
    <h1>019SMS integration test</h1>
    <p>This page is available only to the Atlas platform administrator.</p>
    <label style={{display:"grid",gap:8,marginTop:20}}>
      Phone
      <input value={phone} onChange={event=>setPhone(event.target.value)} style={{padding:12,fontSize:16}} />
    </label>
    <label style={{display:"grid",gap:8,marginTop:16}}>
      Message
      <textarea value={message} onChange={event=>setMessage(event.target.value)} rows={4} style={{padding:12,fontSize:16}} />
    </label>
    <button type="button" onClick={sendTest} disabled={loading} style={{marginTop:18,padding:"12px 18px",fontSize:16,cursor:"pointer"}}>
      {loading ? "Sending..." : "Send test SMS"}
    </button>
    {result && <pre style={{marginTop:20,padding:16,background:"#111",color:"#fff",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{result}</pre>}
  </section>;
}
