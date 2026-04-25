import type { PublicProduct, StoreOfferItem } from "../api/store";

export type ActiveOffer = StoreOfferItem & {
  product: PublicProduct;
  expiresMs: number;
};

export function offerExpiryMs(offer: StoreOfferItem): number {
  return new Date(offer.expires_at).getTime();
}

export function isOfferActive(
  offer: StoreOfferItem,
  now = Date.now(),
): boolean {
  return offerExpiryMs(offer) > now;
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
      const expiresMs = offerExpiryMs(offer);
      if (!product || expiresMs <= now) {
        return null;
      }
      return { ...offer, product, expiresMs };
    })
    .filter((offer): offer is ActiveOffer => !!offer);
}
