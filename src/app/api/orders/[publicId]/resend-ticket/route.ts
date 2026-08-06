import { NextResponse } from "next/server";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { sendOrderTicketSms } from "@/lib/order-sms";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const body = await request.json().catch(() => ({}));
    const channel = body?.channel === "sms" ? "sms" : "email";

    if (channel === "sms") {
      const result = await sendOrderTicketSms(publicId);
      return NextResponse.json({
        sent: true,
        channel,
        recipient: result.recipient,
        priceMinor: result.priceMinor,
        providerStatus: result.providerStatus,
      });
    }

    const result = await sendOrderTicketEmail(publicId);
    return NextResponse.json({ sent: true, channel, recipient: result.recipient, id: result.id, priceMinor: 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить билет" },
      { status: 400 },
    );
  }
}
