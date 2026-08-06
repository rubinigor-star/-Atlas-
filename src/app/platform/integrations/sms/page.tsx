import { SmsTestPanel } from "@/components/sms-test-panel";
import { getSms019ConfigurationStatus } from "@/lib/sms-019";
import { getSmsPriceMinor } from "@/lib/order-sms";
import { getSmsLedgerSummary, listNotificationDeliveries } from "@/lib/notification-ledger";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(value);
}

export default async function SmsIntegrationPage() {
  const config = getSms019ConfigurationStatus();
  const priceMinor = getSmsPriceMinor();
  const ready = config.username && config.token && config.source;
  const [summary, deliveries] = await Promise.all([getSmsLedgerSummary(), listNotificationDeliveries(50)]);

  return <div style={{maxWidth:1100,margin:"0 auto",padding:"36px 24px"}}>
    <h1>SMS integration</h1>
    <p>019SMS is used for automatic ticket delivery, customer login links and manual ticket resending.</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"24px 0"}}>
      <div className="card"><strong>Username</strong><div>{config.username ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>API token</strong><div>{config.token ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>Sender</strong><div>{config.source ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>Organizer price</strong><div>{(priceMinor / 100).toFixed(2)} ₪ per SMS</div></div>
      <div className="card"><strong>Sent</strong><div>{summary.sentCount}</div></div>
      <div className="card"><strong>Failed</strong><div>{summary.failedCount}</div></div>
      <div className="card"><strong>Total billed</strong><div>{(summary.billedMinor / 100).toFixed(2)} ₪</div></div>
    </div>

    <div className="toast" style={{marginBottom:20}}>{ready ? "Configuration is ready for testing." : "One or more Vercel variables are missing."}</div>
    <SmsTestPanel initialPhone="0547997275" />

    <section style={{marginTop:40}}>
      <h2>Recent deliveries</h2>
      <div style={{overflowX:"auto",border:"1px solid #e5e7eb",borderRadius:14}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
          <thead>
            <tr style={{background:"#f8fafc",textAlign:"left"}}>
              <th style={{padding:12}}>Date</th>
              <th style={{padding:12}}>Type</th>
              <th style={{padding:12}}>Recipient</th>
              <th style={{padding:12}}>Status</th>
              <th style={{padding:12}}>Provider</th>
              <th style={{padding:12}}>Cost</th>
              <th style={{padding:12}}>Message</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((item) => <tr key={item.id} style={{borderTop:"1px solid #e5e7eb"}}>
              <td style={{padding:12,whiteSpace:"nowrap"}}>{formatDate(item.sentAt ?? item.createdAt)}</td>
              <td style={{padding:12}}>{item.type}</td>
              <td style={{padding:12}}>{item.recipient}</td>
              <td style={{padding:12}}>{item.status}</td>
              <td style={{padding:12}}>{item.providerStatus ?? "-"}</td>
              <td style={{padding:12,whiteSpace:"nowrap"}}>{(item.priceMinor / 100).toFixed(2)} ₪</td>
              <td style={{padding:12,maxWidth:300,overflowWrap:"anywhere"}}>{item.providerMessage ?? "-"}</td>
            </tr>)}
            {!deliveries.length && <tr><td colSpan={7} style={{padding:24,textAlign:"center",color:"#64748b"}}>No SMS deliveries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
