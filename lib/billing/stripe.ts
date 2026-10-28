import Stripe from "stripe";
import type { Env } from "../cloudflare";
import { OFFERS, type OfferKey } from "./catalog";

export function stripeClient(env: Env) {
  return new Stripe(env.STRIPE_SECRET_KEY!, { httpClient: Stripe.createFetchHttpClient() });
}

export async function offerPrice(stripe: Stripe, offerKey: OfferKey) {
  const expected = OFFERS[offerKey];
  const prices = await stripe.prices.list({ lookup_keys: [offerKey], active: true, limit: 2, expand: ["data.product"] });
  if (prices.data.length !== 1) throw new Error("PRICE_CONFIGURATION_INVALID");
  const price = prices.data[0];
  const interval = price.recurring?.interval || null;
  if (price.unit_amount !== expected.amount || price.currency !== expected.currency || interval !== expected.interval) throw new Error("PRICE_CONFIGURATION_INVALID");
  return price;
}

export function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  return value && typeof value === "object" && "id" in value ? String((value as {id:string}).id) : null;
}
