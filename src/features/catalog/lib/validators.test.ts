import { describe, it, expect } from "vitest";
import { CreatePublicOrderSchema } from "./validators";

describe("CreatePublicOrderSchema", () => {
  const validOrder = {
    customer_name: "Jane Doe",
    customer_phone: "50312345678",
    payment_method: "efectivo",
    order_type: "en_local",
    items: [
      { product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", quantity: 1 },
    ],
  };

  it("accepts a minimal valid order", () => {
    expect(() => CreatePublicOrderSchema.parse(validOrder)).not.toThrow();
  });

  it("rejects empty customer_name", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({ ...validOrder, customer_name: "" }),
    ).toThrow();
  });

  it("rejects customer_name longer than 120 chars", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({
        ...validOrder,
        customer_name: "x".repeat(121),
      }),
    ).toThrow();
  });

  it("rejects phone shorter than 7 chars", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({ ...validOrder, customer_phone: "123" }),
    ).toThrow();
  });

  it("rejects invalid email when provided", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({
        ...validOrder,
        customer_email: "not-an-email",
      }),
    ).toThrow();
  });

  it("rejects empty items array", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({ ...validOrder, items: [] }),
    ).toThrow();
  });

  it("rejects notes longer than 500 chars", () => {
    expect(() =>
      CreatePublicOrderSchema.parse({ ...validOrder, notes: "x".repeat(501) }),
    ).toThrow();
  });
});
