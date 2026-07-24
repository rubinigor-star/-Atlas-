import { NextResponse } from "next/server";
import { sendOrderTicketEmail } from "@/lib/order-email";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const result = await sendOrderTicketEmail(publicId);
    return NextResponse.json({ sent: true, recipient: result.recipient, id: result.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить билет" },
      { status: 400 },
    );
  }
}
