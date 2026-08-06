import fs from "node:fs";

const paymentRoute = "src/app/api/payments/hyp/order/route.ts";
let source = fs.readFileSync(paymentRoute, "utf8");

if (!source.includes('import { sendOrderTicketSms } from "@/lib/order-sms";')) {
  source = source.replace(
    'import { sendOrderTicketEmail } from "@/lib/order-email";',
    'import { sendOrderTicketEmail } from "@/lib/order-email";\nimport { sendOrderTicketSms } from "@/lib/order-sms";',
  );
}

const emailLine = '    try { await sendOrderTicketEmail(publicId); } catch (error) { console.error("[hyp-ticket-email]", publicId, error); }';
const smsLine = '    try { await sendOrderTicketSms(publicId, { automatic: true }); } catch (error) { console.error("[hyp-ticket-sms]", publicId, error); }';
if (!source.includes(smsLine)) {
  if (!source.includes(emailLine)) throw new Error("HYP ticket email hook was not found");
  source = source.replace(emailLine, `${emailLine}\n${smsLine}`);
}

fs.writeFileSync(paymentRoute, source);
console.log("Automatic ticket SMS is connected to successful HYP payment finalization.");
