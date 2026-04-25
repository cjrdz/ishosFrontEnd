import { describe, expect, it } from "vitest";
import {
  buildActiveOfferMap,
  isOfferActive,
  resolveActiveOffers,
} from "./offers";
import type { PublicProduct, StoreOfferItem } from "../api/store";

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
