import { describe, it, expect } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools, handleToolCall } from "../src/tools/index.js";
import { formatReportResponse } from "../src/google/data-api.js";
import { fail } from "../src/tools/response.js";
import { formatError } from "../src/utils/error.js";

describe("tool registry", () => {
  it("every tool exposes a zod schema that converts to JSON schema", () => {
    expect(tools.length).toBeGreaterThan(20);
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(t.schema).toBeDefined();
      expect(() => zodToJsonSchema(t.schema)).not.toThrow();
    }
  });

  it("enforces required fields (list_gtm_containers needs accountId)", () => {
    const t = tools.find((x) => x.name === "list_gtm_containers")!;
    expect(t.schema.safeParse({}).success).toBe(false);
    expect(t.schema.safeParse({ accountId: "123" }).success).toBe(true);
  });

  it("rejects unknown keys to catch argument typos", () => {
    const t = tools.find((x) => x.name === "list_gtm_containers")!;
    expect(
      t.schema.safeParse({ accountId: "123", acccountId: "x" }).success
    ).toBe(false);
  });

  it("handleToolCall validates before invoking the handler", async () => {
    const res = (await handleToolCall("list_gtm_containers", {})) as any;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Invalid arguments");
  });

  it("handleToolCall reports unknown tools", async () => {
    const res = (await handleToolCall("does_not_exist", {})) as any;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Unknown tool");
  });
});

describe("formatReportResponse", () => {
  it("flattens dimension/metric values into row objects", () => {
    const out = formatReportResponse({
      dimensionHeaders: [{ name: "pagePath" }],
      metricHeaders: [{ name: "screenPageViews" }],
      rows: [
        { dimensionValues: [{ value: "/home" }], metricValues: [{ value: "42" }] },
      ],
      rowCount: 1,
      metadata: { currencyCode: "USD" },
    });
    expect(out.rows).toEqual([{ pagePath: "/home", screenPageViews: "42" }]);
    expect(out.rowCount).toBe(1);
    expect(out.metadata.currencyCode).toBe("USD");
  });
});

describe("error enrichment", () => {
  it("surfaces Google status and reason", () => {
    const msg = formatError({
      status: 403,
      message: "Forbidden",
      errors: [{ reason: "permissionDenied" }],
    });
    expect(msg).toContain("403");
    expect(msg).toContain("permissionDenied");
  });

  it("fail() wraps an error object with status", () => {
    const res = fail({ status: 429, message: "Rate limited" }) as any;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("429");
  });

  it("fail() handles plain strings", () => {
    const res = fail("boom") as any;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("boom");
  });
});
