import { SmsTestPanel } from "@/components/sms-test-panel";
import { getSms019ConfigurationStatus } from "@/lib/sms-019";
import { getSmsPriceMinor } from "@/lib/order-sms";

export const dynamic = "force-dynamic";

export default function SmsIntegrationPage() {
  const config = getSms019ConfigurationStatus();
  const priceMinor = getSmsPriceMinor();
  const ready = config.username && config.token && config.source;

  return <div style={{maxWidth:900,margin:"0 auto",padding:"36px 24px"}}>
    <h1>SMS integration</h1>
    <p>019SMS is used for ticket delivery and system notifications.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"24px 0"}}>
      <div className="card"><strong>Username</strong><div>{config.username ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>API token</strong><div>{config.token ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>Sender</strong><div>{config.source ? "Configured" : "Missing"}</div></div>
      <div className="card"><strong>Organizer price</strong><div>{(priceMinor / 100).toFixed(2)} ₪ per SMS</div></div>
    </div>
    <div className="toast" style={{marginBottom:20}}>{ready ? "Configuration is ready for testing." : "One or more Vercel variables are missing."}</div>
    <SmsTestPanel initialPhone="0547997275" />
  </div>;
}
