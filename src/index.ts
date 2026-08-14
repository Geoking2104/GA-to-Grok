#!/usr/bin/env node

import { config } from "dotenv";
config();

import { startServer } from "./server.js";

const transport = process.argv.includes("--transport")
  ? process.argv[process.argv.indexOf("--transport") + 1]
  : process.env.TRANSPORT || "stdio";

startServer(transport as "stdio" | "http").catch((err) => {
  console.error("Failed to start GA-to-Grok MCP server:", err);
  process.exit(1);
});
