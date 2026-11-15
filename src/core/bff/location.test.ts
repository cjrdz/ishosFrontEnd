import { describe, expect, it } from "vitest";
import {
  ADMIN_LOCATION_COOKIE,
  locationHeaders,
  parseLocationSelection,
} from "./location";

const ID = "388fe5ef-d3f4-483a-bb50-d8067b34062a";

function ctx(value?: string) {
  return {
    cookies: {
      get: (name: string) =>
        name === ADMIN_LOCATION_COOKIE && value !== undefined
          ? { value }
          : undefined,
    },
  } as never;
}

describe("location header", () => {
  it("forwards a valid selection", () => {
    expect(locationHeaders(ctx(ID))).toEqual({ "X-Location-Id": ID });
  });

  it("falls back to all for missing or invalid values", () => {
    expect(locationHeaders(ctx())).toEqual({ "X-Location-Id": "all" });
    expect(parseLocationSelection("x; DROP")).toBe("all");
  });
});
