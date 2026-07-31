import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { effectiveTicketPrice } from "@/lib/ticketing";
import { calculateServiceFee } from "@/lib/service-fee";

const EVENT_ID = "cms499jws001ljc6l6sf4e9is";

export async function GET() {
  const event = await db.event.findUnique({ where: { id: EVENT_ID }, include: { categories: { include: { priceTiers: true } } } });
  if (!event) return NextResponse.json({ error: "EVENT_NOT_FOUND" }, { status: 404 });
  const terms = await getEffectiveEventTerms(event.id, event.organizationId);
  return NextResponse.json({
    event: { id: event.id, title: event.title, slug: event.slug, status: event.status },
    terms: {
      useOrganizerDefaults: terms.useOrganizerDefaults,
      serviceFeePayer: terms.serviceFeePayer,
      salesFeePercentBps: terms.organizer.salesFeePercentBps,
      salesFeeFixedMinor: terms.organizer.salesFeeFixedMinor,
    },
    categories: event.categories.map((category) => {
      const subtotalMinor = effectiveTicketPrice(category);
      const pricing = calculateServiceFee(subtotalMinor, {
        salesFeePercentBps: terms.organizer.salesFeePercentBps,
        salesFeeFixedMinor: terms.organizer.salesFeeFixedMinor,
        serviceFeePayer: terms.serviceFeePayer,
      });
      return {
        id: category.id,
        name: category.name,
        subtotalMinor,
        serviceFeeMinor: pricing.serviceFeeMinor,
        buyerTotalMinor: pricing.buyerTotalMinor,
        checkoutUrl: `https://www.atlas-one.co/checkout?eventId=${event.id}&categoryId=${category.id}&quantity=1&locale=ru`,
      };
    }),
  });
}
