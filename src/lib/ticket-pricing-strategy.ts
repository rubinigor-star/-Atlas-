export type PricingMarketingIntensity = "CALM" | "STANDARD" | "ACTIVE" | "MAXIMUM";

export type PricingMarketingStrategy = {
  intensity: PricingMarketingIntensity;
  showCountdown: boolean;
  showNextPrice: boolean;
  showStageRemaining: boolean;
  showTotalRemaining: boolean;
  showSoldCount: boolean;
};

const MARKER = /\n?<!--ATLAS_PRICING_STRATEGY:([A-Za-z0-9_-]+)-->/g;

export const defaultPricingMarketingStrategy: PricingMarketingStrategy = {
  intensity: "STANDARD",
  showCountdown: true,
  showNextPrice: true,
  showStageRemaining: false,
  showTotalRemaining: false,
  showSoldCount: false,
};

function encode(value: PricingMarketingStrategy) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(value: string): PricingMarketingStrategy | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PricingMarketingStrategy>;
    const intensity = ["CALM", "STANDARD", "ACTIVE", "MAXIMUM"].includes(String(parsed.intensity))
      ? parsed.intensity as PricingMarketingIntensity
      : "STANDARD";
    return {
      intensity,
      showCountdown: parsed.showCountdown ?? true,
      showNextPrice: parsed.showNextPrice ?? intensity !== "CALM",
      showStageRemaining: parsed.showStageRemaining ?? (intensity === "ACTIVE" || intensity === "MAXIMUM"),
      showTotalRemaining: parsed.showTotalRemaining ?? false,
      showSoldCount: parsed.showSoldCount ?? false,
    };
  } catch {
    return null;
  }
}

export function parsePricingMarketingStrategy(description?: string | null): PricingMarketingStrategy {
  if (!description) return defaultPricingMarketingStrategy;
  const matches = [...description.matchAll(MARKER)];
  const encoded = matches.at(-1)?.[1];
  return encoded ? decode(encoded) ?? defaultPricingMarketingStrategy : defaultPricingMarketingStrategy;
}

export function stripPricingMarketingStrategy(description?: string | null) {
  return (description || "").replace(MARKER, "").trim();
}

export function withPricingMarketingStrategy(description: string | null | undefined, strategy: PricingMarketingStrategy) {
  const clean = stripPricingMarketingStrategy(description);
  return `${clean}${clean ? "\n" : ""}<!--ATLAS_PRICING_STRATEGY:${encode(strategy)}-->`;
}
