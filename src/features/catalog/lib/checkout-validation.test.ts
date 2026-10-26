import { describe, expect, it } from "vitest";
import { isValidPhone, validateCheckoutContact } from "./checkout-validation";

describe("isValidPhone (mirrors backend isValidPhone)", () => {
  it.each(["7123 4567", "+503 7123-4567", "(503) 7123 4567", "1234567"])(
    "accepts %s",
    (phone) => {
      expect(isValidPhone(phone)).toBe(true);
    },
  );
  it.each(["123456", "1234567890123456", "7123.4567", "tel 71234567", "abc"])(
    "rejects %s",
    (phone) => {
      expect(isValidPhone(phone)).toBe(false);
    },
  );
});

describe("validateCheckoutContact", () => {
  const valid = {
    customer_name: "Ana",
    customer_phone: "7123 4567",
    customer_email: "",
  };

  it("accepts a complete contact with optional email empty", () => {
    expect(validateCheckoutContact(valid)).toEqual({});
  });

  it("reports each invalid field", () => {
    const errors = validateCheckoutContact({
      customer_name: "  ",
      customer_phone: "12",
      customer_email: "ana@",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "customer_email",
      "customer_name",
      "customer_phone",
    ]);
  });

  it("agrees with the order schema the BFF enforces (name ≤ 120, strict email)", () => {
    expect(
      validateCheckoutContact({ ...valid, customer_name: "a".repeat(121) })
        .customer_name,
    ).toBeDefined();
    expect(
      validateCheckoutContact({ ...valid, customer_name: "a".repeat(120) }),
    ).toEqual({});
    expect(
      validateCheckoutContact({ ...valid, customer_email: "a@x..com" })
        .customer_email,
    ).toBeDefined();
  });
});
