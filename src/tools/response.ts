import { formatError } from "../utils/error.js";

export function success(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Build an MCP error result from any thrown value, enriched via formatError. */
export function fail(err: unknown) {
  return {
    content: [{ type: "text" as const, text: `Error: ${formatError(err)}` }],
    isError: true,
  };
}
