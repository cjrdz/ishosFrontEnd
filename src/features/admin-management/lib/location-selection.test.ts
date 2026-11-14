import { describe, expect, it } from "vitest";
import {
  ADMIN_LOCATION_COOKIE,
  ALL_LOCATIONS,
  readSelectedLocation,
} from "./location-selection";

const ID = "388fe5ef-d3f4-483a-bb50-d8067b34062a";

describe("readSelectedLocation", () => {
  it("returns all when the cookie is missing", () => {
    expect(readSelectedLocation("theme=night")).toBe(ALL_LOCATIONS);
  });

  it("returns a valid location id", () => {
    expect(
      readSelectedLocation(
        `theme=night; ${ADMIN_LOCATION_COOKIE}=${ID.toUpperCase()}`,
      ),
    ).toBe(ID);
  });

  it("ignores values that are not a location id", () => {
    expect(readSelectedLocation(`${ADMIN_LOCATION_COOKIE}=../../etc`)).toBe(
      ALL_LOCATIONS,
    );
  });
});
