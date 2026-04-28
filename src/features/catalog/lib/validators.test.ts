import { describe, it, expect } from "vitest";
import {
  CartItemSchema,
  CreateOrderSchema,
  ProductListSchema,
} from "./validators";

describe("ProductListSchema", () => {
  it("applies defaults when fields are missing", () => {
    const result = ProductListSchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("rejects limit above 100", () => {
    expect(() => ProductListSchema.parse({ limit: 101 })).toThrow();
  });
});

describe("CartItemSchema", () => {
  it("accepts valid uuid + positive quantity", () => {
    const data = {
      product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      quantity: 2,
    };
    expect(() => CartItemSchema.parse(data)).not.toThrow();
  });

  it("rejects non-uuid product_id", () => {
    expect(() =>
      CartItemSchema.parse({ product_id: "not-a-uuid", quantity: 1 }),
    ).toThrow();
  });

  it("rejects quantity less than 1", () => {
    expect(() =>
      CartItemSchema.parse({
        product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        quantity: 0,
      }),
    ).toThrow();
  });
});

describe("CreateOrderSchema", () => {
  const validOrder = {
    customer_name: "Jane Doe",
    customer_phone: "50312345678",
    items: [
      { product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", quantity: 1 },
    ],
  };

  it("accepts a minimal valid order", () => {
    expect(() => CreateOrderSchema.parse(validOrder)).not.toThrow();
  });

  it("rejects customer_name shorter than 2 characters", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customer_name: "A" }),
    ).toThrow();
  });

  it("rejects invalid phone format", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customer_phone: "abc" }),
    ).toThrow();
  });

  it("rejects empty items array", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, items: [] }),
    ).toThrow();
  });

  it("rejects invalid email when provided", () => {
    expect(() =>
      CreateOrderSchema.parse({
        ...validOrder,
        customer_email: "not-an-email",
      }),
    ).toThrow();
  });

  it("rejects notes longer than 500 chars", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, notes: "x".repeat(501) }),
    ).toThrow();
  });
});
