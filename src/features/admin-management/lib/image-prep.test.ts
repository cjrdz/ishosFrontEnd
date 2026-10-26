import { describe, expect, it } from "vitest";
import { fitWithin, MAX_IMAGE_EDGE } from "./image-prep";

describe("fitWithin", () => {
  it("leaves images that already fit untouched", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest side down to the max edge, keeping aspect", () => {
    expect(fitWithin(4000, 3000)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: 1200,
    });
    expect(fitWithin(3000, 4000)).toEqual({
      width: 1200,
      height: MAX_IMAGE_EDGE,
    });
  });

  it("never returns zero dimensions", () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});
