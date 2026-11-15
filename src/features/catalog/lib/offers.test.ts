import { describe, expect, it } from "vitest";
import {
  buildActiveOfferMap,
  isOfferActive,
  offerBasePrice,
  resolveActiveOffers,
} from "./offers";
import type { PublicProduct, StoreOfferItem } from "./api";

const now = Date.UTC(2026, 3, 24, 12, 0, 0);

function makeOffer(partial?: Partial<StoreOfferItem>): StoreOfferItem {
  return {
    product_id: "p-1",
    label: "Promo",
    expires_at: new Date(now + 60_000).toISOString(),
    ...partial,
  };
}

function makeProduct(partial?: Partial<PublicProduct>): PublicProduct {
  return {
    id: "p-1",
    name: "Vainilla",
    description: "Clasico",
    price: 3.25,
    is_available: true,
    ...partial,
  };
}

describe("isOfferActive", () => {
  it("returns true when offer has not expired", () => {
    expect(isOfferActive(makeOffer(), now)).toBe(true);
  });

  it("returns false when offer is expired", () => {
    const expired = makeOffer({
      expires_at: new Date(now - 1_000).toISOString(),
    });
    expect(isOfferActive(expired, now)).toBe(false);
  });
});

describe("buildActiveOfferMap", () => {
  it("includes only active offers", () => {
    const map = buildActiveOfferMap(
      [
        makeOffer({ product_id: "active" }),
        makeOffer({
          product_id: "expired",
          expires_at: new Date(now - 1_000).toISOString(),
        }),
      ],
      now,
    );

    expect(map.has("active")).toBe(true);
    expect(map.has("expired")).toBe(false);
  });
});

describe("resolveActiveOffers", () => {
  it("joins active offers with products and excludes missing products", () => {
    const offers = [
      makeOffer({ product_id: "p-1" }),
      makeOffer({ product_id: "missing" }),
    ];

    const resolved = resolveActiveOffers(
      offers,
      [makeProduct({ id: "p-1" })],
      now,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].product.id).toBe("p-1");
  });
});

describe("offerBasePrice", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const future = "2026-10-26T13:00:00Z";
  const past = "2026-10-26T11:00:00Z";
  const offer = (
    product_id: string,
    discount_price: number | undefined,
    expires_at: string,
  ) =>
    ({
      product_id,
      label: "Oferta",
      discount_price,
      expires_at,
    }) as StoreOfferItem;

  it("returns the lowest active positive discount for the product", () => {
    const offers = [
      offer("p1", 0.75, future),
      offer("p1", 0.6, future),
      offer("p2", 0.1, future),
    ];
    expect(offerBasePrice("p1", offers, now)).toBe(0.6);
  });

  it("ignores expired, label-only and invalid-expiry offers", () => {
    const offers = [
      offer("p1", 0.5, past),
      offer("p1", 0, future),
      offer("p1", 0.4, ""),
    ];
    expect(offerBasePrice("p1", offers, now)).toBeUndefined();
  });
});
