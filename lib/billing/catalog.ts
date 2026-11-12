export const TOOL_RATES = {
  "image-to-image": 1,
  "face-swap": 2,
  "multiple-face-swap": 2,
} as const;

export type ToolKey = keyof typeof TOOL_RATES;

export const OFFERS = {
  pro_monthly_v1: { kind: "subscription", amount: 900, currency: "usd", credits: 300, interval: "month" },
  pro_yearly_v1: { kind: "subscription", amount: 8600, currency: "usd", credits: 3600, interval: "year" },
  credits_200_v1: { kind: "pack", amount: 900, currency: "usd", credits: 200, interval: null },
  credits_700_v1: { kind: "pack", amount: 2500, currency: "usd", credits: 700, interval: null },
} as const;

export type OfferKey = keyof typeof OFFERS;
export function isOfferKey(value: string): value is OfferKey { return value in OFFERS; }

