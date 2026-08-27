import { describe, it, expect, afterEach } from "vitest";
import { resolvePropertyId, assertWriteEnabled } from "../src/auth/service-account.js";
import { cacheKey } from "../src/cache/redis.js";

describe("resolvePropertyId", () => {
  afterEach(() => {
    delete process.env.GA4_PROPERTY_ID;
  });

  it("strips the properties/ prefix", () => {
    expect(resolvePropertyId("properties/123456789")).toBe("123456789");
  });

  it("returns a plain id unchanged", () => {
    expect(resolvePropertyId("123456789")).toBe("123456789");
  });

  it("falls back to the GA4_PROPERTY_ID env var", () => {
    process.env.GA4_PROPERTY_ID = "987654321";
    expect(resolvePropertyId()).toBe("987654321");
  });

  it("throws when no id is available", () => {
    expect(() => resolvePropertyId()).toThrow(/GA4_PROPERTY_ID/);
  });
});

describe("assertWriteEnabled", () => {
  afterEach(() => {
    delete process.env.GA4_WRITE_ENABLED;
    delete process.env.GTM_WRITE_ENABLED;
  });

  it("throws when GTM_WRITE_ENABLED is not explicitly true", () => {
    expect(() => assertWriteEnabled()).toThrow(/GTM_WRITE_ENABLED/);
  });

  it("throws when GA4_WRITE_ENABLED is not explicitly true", () => {
    process.env.GTM_WRITE_ENABLED = "true";
    expect(() => assertWriteEnabled()).toThrow(/GA4_WRITE_ENABLED/);
  });

  it("passes only when both flags are explicitly true", () => {
    process.env.GTM_WRITE_ENABLED = "true";
    process.env.GA4_WRITE_ENABLED = "true";
    expect(() => assertWriteEnabled()).not.toThrow();
  });
});

describe("cacheKey", () => {
  it("is deterministic and independent of key order", () => {
    const a = cacheKey("report", { b: 1, a: 2 });
    const b = cacheKey("report", { a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^ga4:report:/);
  });

  it("sorts array values for stable keys", () => {
    const a = cacheKey("x", { list: [3, 1, 2] });
    const b = cacheKey("x", { list: [1, 2, 3] });
    expect(a).toBe(b);
  });

  it("ignores undefined and null values", () => {
    const a = cacheKey("x", { a: 1, b: undefined, c: null as any });
    const b = cacheKey("x", { a: 1 });
    expect(a).toBe(b);
  });
});
