import { NextResponse } from "next/server";
import { processOrderReviewJobs } from "@/lib/order-review-queue";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const result = await processOrderReviewJobs(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("order_review_queue.cron_failed", {
      message: error instanceof Error ? error.message : "Unknown queue error",
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "QUEUE_FAILED" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
