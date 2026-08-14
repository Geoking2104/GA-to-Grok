import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, handleToolCall } from "./tools/index.js";
import express from "express";
import cors from "cors";

function createMcpServer() {
  const server = new Server(
    {
      name: "ga-to-grok",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  });

  return server;
}

export async function startServer(transportType: "stdio" | "http" = "stdio") {
  const server = createMcpServer();

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GA-to-Grok MCP server running on STDIO");
    return;
  }

  // ─── HTTP + SSE transport (for Grok Custom Connector) ───────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  // Health check
  app.get("/", (_req, res) => {
    res.json({
      name: "ga-to-grok",
      version: "0.2.0",
      status: "ok",
      transport: "sse",
      tools: tools.map((t) => t.name),
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // SSE endpoint for MCP
  app.get("/sse", async (req, res) => {
    console.error(`New SSE connection from ${req.ip}`);

    const transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);

    // Keep connection alive
    req.on("close", () => {
      console.error("SSE connection closed");
    });
  });

  // Message endpoint used by SSE transport
  app.post("/messages", async (req, res) => {
    // The SSEServerTransport handles the message routing internally
    // This endpoint is required by the protocol
    res.status(202).send("Accepted");
  });

  app.listen(port, host, () => {
    console.error(`GA-to-Grok MCP server running on http://${host}:${port}`);
    console.error(`SSE endpoint: http://${host}:${port}/sse`);
    console.error(`Ready for Grok Custom Connector`);
  });
}
