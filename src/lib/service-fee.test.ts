import { describe, expect, it } from "vitest";
import { calculateServiceFee, roundBuyerTotalToWholeShekel } from "@/lib/service-fee";

describe("service fee public totals", () => {
  it("rounds the buyer-facing amount upward to a whole shekel", () => {
    expect(roundBuyerTotalToWholeShekel(10601)).toBe(10700);
    expect(roundBuyerTotalToWholeShekel(10700)).toBe(10700);
  });

  it("includes buyer-paid commission in the same rounded amount shown and charged", () => {
    const result = calculateServiceFee(10000, {
      salesFeePercentBps: 650,
      salesFeeFixedMinor: 0,
      serviceFeePayer: "BUYER",
    });

    expect(result.buyerTotalMinor).toBe(10700);
    expect(result.serviceFeeMinor).toBe(700);
    expect(result.organizerNetMinor).toBe(10000);
  });

  it("keeps 1+1 package pricing as one commission-bearing transaction", () => {
    const result = calculateServiceFee(19900, {
      salesFeePercentBps: 600,
      salesFeeFixedMinor: 600,
      serviceFeePayer: "BUYER",
    });

    expect(result.buyerTotalMinor % 100).toBe(0);
    expect(result.buyerTotalMinor).toBe(21800);
    expect(result.serviceFeeMinor).toBe(result.buyerTotalMinor - result.subtotalMinor);
  });

  it("also charges a whole-shekel total when the organizer pays the fee", () => {
    const result = calculateServiceFee(10050, {
      salesFeePercentBps: 500,
      salesFeeFixedMinor: 0,
      serviceFeePayer: "ORGANIZER",
    });

    expect(result.buyerTotalMinor).toBe(10100);
    expect(result.organizerNetMinor + result.serviceFeeMinor).toBe(result.buyerTotalMinor);
  });
});
