import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LocalStorageAdapter, CURRENT_STORAGE_VERSION } from "../storage";
import type { AppState } from "@/types";

function makeState(): AppState {
  return {
    user: { id: "u1", name: "Test", email: "t@test.com", createdAt: "2025-01-01T00:00:00Z" },
    categories: [],
    transactions: [],
    budgets: [],
    savingsGoals: [],
    merchantMemory: [],
  };
}

describe("LocalStorageAdapter", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("saves and loads state at the current version key", async () => {
    const adapter = new LocalStorageAdapter("test");
    await adapter.save(makeState());
    const loaded = await adapter.load();
    expect(loaded?.user.id).toBe("u1");
    expect(localStorage.getItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`)).not.toBeNull();
  });

  it("returns null when nothing is saved", async () => {
    const adapter = new LocalStorageAdapter("test");
    expect(await adapter.load()).toBeNull();
  });

  it("migrates legacy v1.1 data to current key on load", async () => {
    const state = makeState();
    localStorage.setItem("auto-audit:v1.1:test", JSON.stringify(state));
    const adapter = new LocalStorageAdapter("test");
    const loaded = await adapter.load();
    expect(loaded?.user.id).toBe("u1");
    expect(localStorage.getItem("auto-audit:v1.1:test")).toBeNull();
    expect(localStorage.getItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`)).not.toBeNull();
  });

  it("throws a descriptive error when localStorage quota is exceeded", async () => {
    const adapter = new LocalStorageAdapter("test");
    const quotaError = new DOMException("QuotaExceededError", "QuotaExceededError");
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw quotaError;
    });
    await expect(adapter.save(makeState())).rejects.toThrow("Storage full");
  });

  it("reset removes current key and all legacy keys", async () => {
    const adapter = new LocalStorageAdapter("test");
    await adapter.save(makeState());
    localStorage.setItem("auto-audit:v1.1:test", "old");
    await adapter.reset();
    expect(await adapter.load()).toBeNull();
    expect(localStorage.getItem("auto-audit:v1.1:test")).toBeNull();
  });
});
