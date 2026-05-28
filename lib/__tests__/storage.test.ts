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

  // Schema guard tests
  it("returns null for corrupted (non-parseable) JSON", async () => {
    localStorage.setItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`, "not-json{{{");
    expect(await new LocalStorageAdapter("test").load()).toBeNull();
  });

  it("returns null when stored value is an array, not an object", async () => {
    localStorage.setItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`, JSON.stringify([]));
    expect(await new LocalStorageAdapter("test").load()).toBeNull();
  });

  it("returns null when required array fields are missing", async () => {
    const partial = { user: { id: "u1", name: "T", email: "t@t.com", createdAt: "2025-01-01T00:00:00Z" } };
    localStorage.setItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`, JSON.stringify(partial));
    expect(await new LocalStorageAdapter("test").load()).toBeNull();
  });

  it("returns null when user field is missing", async () => {
    const noUser = { categories: [], transactions: [], budgets: [], savingsGoals: [], merchantMemory: [] };
    localStorage.setItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`, JSON.stringify(noUser));
    expect(await new LocalStorageAdapter("test").load()).toBeNull();
  });

  // Legacy migration tests
  it("migrates legacy v1.2 data to current key on load", async () => {
    localStorage.setItem("auto-audit:v1.2:test", JSON.stringify(makeState()));
    const loaded = await new LocalStorageAdapter("test").load();
    expect(loaded?.user.id).toBe("u1");
    expect(localStorage.getItem("auto-audit:v1.2:test")).toBeNull();
    expect(localStorage.getItem(`auto-audit:${CURRENT_STORAGE_VERSION}:test`)).not.toBeNull();
  });

  it("migrates legacy v1.3 data to current key on load", async () => {
    localStorage.setItem("auto-audit:v1.3:test", JSON.stringify(makeState()));
    const loaded = await new LocalStorageAdapter("test").load();
    expect(loaded?.user.id).toBe("u1");
    expect(localStorage.getItem("auto-audit:v1.3:test")).toBeNull();
  });

  it("prefers v1.3 over v1.2 when both exist (newest-first migration)", async () => {
    const stateA = makeState();
    const stateB = { ...makeState(), user: { ...makeState().user, id: "u-newer" } };
    localStorage.setItem("auto-audit:v1.2:test", JSON.stringify(stateA));
    localStorage.setItem("auto-audit:v1.3:test", JSON.stringify(stateB));
    const loaded = await new LocalStorageAdapter("test").load();
    expect(loaded?.user.id).toBe("u-newer");
  });
});
