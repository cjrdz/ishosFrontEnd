import type { PublicProduct, StoreOfferItem } from "./api";

export type ActiveOffer = StoreOfferItem & {
  product: PublicProduct;
  expiresMs: number;
};

export function isOfferActive(
  offer: StoreOfferItem,
  now = Date.now(),
): boolean {
  return new Date(offer.expires_at).getTime() > now;
}

export function buildActiveOfferMap(
  offers: StoreOfferItem[],
  now = Date.now(),
): Map<string, StoreOfferItem> {
  const map = new Map<string, StoreOfferItem>();

  for (const offer of offers) {
    if (isOfferActive(offer, now)) {
      map.set(offer.product_id, offer);
    }
  }

  return map;
}

export function resolveActiveOffers(
  offers: StoreOfferItem[],
  products: PublicProduct[],
  now = Date.now(),
): ActiveOffer[] {
  return offers
    .map((offer) => {
      const product = products.find(
        (candidate) => candidate.id === offer.product_id,
      );
      const expiresMs = new Date(offer.expires_at).getTime();
      if (!product || expiresMs <= now) {
        return null;
      }
      return { ...offer, product, expiresMs };
    })
    .filter((offer): offer is ActiveOffer => !!offer);
}

/**
 * The special base price for a product while it has an active offer, or
 * undefined when it has none. Mirrors the backend rule that prices orders
 * (AdminSettingService.ActiveOfferPrices): active offers with a positive
 * discount_price, the lowest one if several overlap. Add-ons are charged on
 * top of it.
 */
export function offerBasePrice(
  productId: string,
  offers: StoreOfferItem[],
  now = Date.now(),
): number | undefined {
  let best: number | undefined;
  for (const offer of offers) {
    if (offer.product_id !== productId || !isOfferActive(offer, now)) continue;
    const price = offer.discount_price;
    if (
      typeof price === "number" &&
      price > 0 &&
      (best === undefined || price < best)
    ) {
      best = price;
    }
  }
  return best;
}
