export type ServiceFeePayer = "BUYER" | "ORGANIZER";

export type ServiceFeeTerms = {
  salesFeePercentBps: number;
  salesFeeFixedMinor: number;
  serviceFeePayer: ServiceFeePayer;
};

/**
 * Public ticket prices in Atlas are always charged as whole shekels.
 * We round upward so the configured commission is never reduced by rounding.
 */
export function roundBuyerTotalToWholeShekel(minor: number) {
  if (!Number.isFinite(minor) || minor < 0) throw new Error("Invalid buyer total");
  return Math.ceil(minor / 100) * 100;
}

export function calculateServiceFee(subtotalMinor: number, terms: ServiceFeeTerms) {
  // A fixed per-order component belongs to the same commission-bearing
  // transaction. This keeps package pricing aligned with the configured terms.
  const percentMinor = Math.round(((subtotalMinor + terms.salesFeeFixedMinor) * terms.salesFeePercentBps) / 10000);
  const configuredServiceFeeMinor = Math.max(0, percentMinor + terms.salesFeeFixedMinor);
  const unroundedBuyerTotalMinor = terms.serviceFeePayer === "BUYER"
    ? subtotalMinor + configuredServiceFeeMinor
    : subtotalMinor;
  const buyerTotalMinor = roundBuyerTotalToWholeShekel(unroundedBuyerTotalMinor);

  // The rounding difference is absorbed into the same commercial side that pays
  // the service fee, keeping the public price, order total and HYP charge identical.
  const serviceFeeMinor = terms.serviceFeePayer === "BUYER"
    ? Math.max(0, buyerTotalMinor - subtotalMinor)
    : configuredServiceFeeMinor;
  const organizerNetMinor = terms.serviceFeePayer === "ORGANIZER"
    ? Math.max(0, buyerTotalMinor - serviceFeeMinor)
    : subtotalMinor;

  return {
    subtotalMinor,
    serviceFeeMinor,
    buyerTotalMinor,
    organizerNetMinor,
  };
}
