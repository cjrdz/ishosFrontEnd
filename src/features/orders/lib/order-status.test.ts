import { describe, expect, it } from "vitest";
import { isOrderEditable } from "./order-status";

describe("isOrderEditable", () => {
  it("keeps counter orders editable while accepted", () => {
    expect(
      isOrderEditable({ status: "recibida", created_by_user_id: "staff-1" }),
    ).toBe(true);
  });

  it("locks accepted online orders", () => {
    expect(
      isOrderEditable({ status: "recibida", created_by_user_id: null }),
    ).toBe(false);
  });

  it("allows orders in review and locks finished ones", () => {
    expect(isOrderEditable({ status: "pendiente_revision" })).toBe(true);
    expect(
      isOrderEditable({ status: "entregada", created_by_user_id: "staff-1" }),
    ).toBe(false);
  });
});
