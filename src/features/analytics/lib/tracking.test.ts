import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecentTrackingOrders,
  getRecentTrackingOrders,
  getRememberTrackingPreference,
  saveRecentTrackingOrder,
  saveRememberTrackingPreference,
  TRACKING_STATUS_FLOW,
  TRACKING_STATUS_ICONS_ACTIVE,
  TRACKING_STATUS_ICONS_STATIC,
  TRACKING_STATUS_LABELS,
} from "./tracking";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  });
  vi.useRealTimers();
});

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

describe("recent tracking persistence", () => {
  it("saves, deduplicates, and keeps latest entries first", () => {
    saveRecentTrackingOrder({
      orderNumber: "ORD-1",
      token: "token-1",
      status: "recibida",
      totalAmount: 8.5,
      updatedAt: "2026-04-27T10:00:00.000Z",
    });

    saveRecentTrackingOrder({
      orderNumber: "ORD-2",
      token: "token-2",
      status: "entregada",
      totalAmount: 12,
      updatedAt: "2026-04-27T11:00:00.000Z",
    });

    saveRecentTrackingOrder({
      orderNumber: "ORD-1",
      token: "token-1",
      status: "entregada",
      totalAmount: 9,
      updatedAt: "2026-04-27T12:00:00.000Z",
    });

    const recent = getRecentTrackingOrders();
    expect(recent).toHaveLength(2);
    expect(recent[0]?.orderNumber).toBe("ORD-1");
    expect(recent[0]?.status).toBe("entregada");
    expect(recent[1]?.orderNumber).toBe("ORD-2");
  });

  it("removes expired entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    saveRecentTrackingOrder({
      orderNumber: "ORD-OLD",
      token: "token-old",
      status: "entregada",
      totalAmount: 10,
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));

    saveRecentTrackingOrder({
      orderNumber: "ORD-NEW",
      token: "token-new",
      status: "recibida",
      totalAmount: 15,
      updatedAt: "2026-05-05T00:00:00.000Z",
    });

    const recent = getRecentTrackingOrders();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.orderNumber).toBe("ORD-NEW");
  });

  it("clears saved history", () => {
    saveRecentTrackingOrder({
      orderNumber: "ORD-1",
      token: "token-1",
      status: "recibida",
      totalAmount: 8,
      updatedAt: "2026-04-27T10:00:00.000Z",
    });

    clearRecentTrackingOrders();
    expect(getRecentTrackingOrders()).toEqual([]);
  });
});

describe("remember tracking preference", () => {
  it("defaults to true and persists false", () => {
    expect(getRememberTrackingPreference()).toBe(true);
    saveRememberTrackingPreference(false);
    expect(getRememberTrackingPreference()).toBe(false);
  });
});
