import type Stripe from "stripe";
import type { OfferKey } from "./catalog";

export type PendingCheckout = {
  id: string;
  offerKey: string;
  sessionId: string | null;
  createdAt: number;
};

export type PendingCheckoutAction = "create" | "expire" | "reuse" | "wait" | "confirming";

export function pendingCheckoutAction(
  pending: PendingCheckout | null,
  session: Pick<Stripe.Checkout.Session, "status" | "url"> | null,
  requestedOffer: OfferKey,
  now = Date.now(),
): PendingCheckoutAction {
  if (!pending) return "create";
  if (!pending.sessionId) return now - pending.createdAt < 5 * 60_000 ? "wait" : "expire";
  if (!session) return "wait";
  if (session.status === "complete") return "confirming";
  if (session.status !== "open") return "create";
  return pending.offerKey === requestedOffer && !!session.url ? "reuse" : "expire";
}
