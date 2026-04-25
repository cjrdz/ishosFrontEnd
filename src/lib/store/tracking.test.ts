import { describe, expect, it } from "vitest";
import {
  TRACKING_STATUS_FLOW,
  TRACKING_STATUS_ICONS_ACTIVE,
  TRACKING_STATUS_ICONS_STATIC,
  TRACKING_STATUS_LABELS,
} from "./tracking";

describe("tracking status metadata", () => {
  it("keeps the visible flow order stable", () => {
    expect(TRACKING_STATUS_FLOW).toEqual([
      "pendiente_revision",
      "recibida",
      "en_proceso",
      "lista",
      "entregada",
    ]);
  });

  it("contains labels and icons for every public status", () => {
    const statuses = [
      "pendiente_revision",
      "recibida",
      "en_proceso",
      "lista",
      "entregada",
      "cancelada",
    ] as const;

    for (const status of statuses) {
      expect(TRACKING_STATUS_LABELS[status]).toBeTruthy();
      expect(TRACKING_STATUS_ICONS_ACTIVE[status]).toBeTruthy();
      expect(TRACKING_STATUS_ICONS_STATIC[status]).toBeTruthy();
    }
  });
});
