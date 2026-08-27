type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const current = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;

function log(level: Level, ...args: unknown[]) {
  if (order[level] < order[current]) return;
  // MCP over stdio requires logs on stderr; console.error writes to stderr.
  console.error(`[${level}]`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
};
