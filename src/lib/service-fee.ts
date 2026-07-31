export type ServiceFeePayer = "BUYER" | "ORGANIZER";

export type ServiceFeeTerms = {
  salesFeePercentBps: number;
  salesFeeFixedMinor: number;
  serviceFeePayer: ServiceFeePayer;
};

export function calculateServiceFee(subtotalMinor: number, terms: ServiceFeeTerms) {
  const percentMinor = Math.round((subtotalMinor * terms.salesFeePercentBps) / 10000);
  const serviceFeeMinor = Math.max(0, percentMinor + terms.salesFeeFixedMinor);
  const buyerTotalMinor = terms.serviceFeePayer === "BUYER" ? subtotalMinor + serviceFeeMinor : subtotalMinor;
  const organizerNetMinor = terms.serviceFeePayer === "ORGANIZER" ? Math.max(0, subtotalMinor - serviceFeeMinor) : subtotalMinor;
  return { subtotalMinor, serviceFeeMinor, buyerTotalMinor, organizerNetMinor };
}
