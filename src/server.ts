import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, handleToolCall } from "./tools/index.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";

function createMcpServer() {
  const server = new Server(
    {
      name: "ga-to-grok",
      version: "0.4.0",
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

  // ─── HTTP + multi-session SSE transport ───────────────────────────────
  const app = express();
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json({ limit: "4mb" }));

  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  // sessionId → transport
  const sessions = new Map<string, SSEServerTransport>();

  // Health / info
  app.get("/", (_req, res) => {
    res.json({
      name: "ga-to-grok",
      version: "0.4.0",
      status: "ok",
      transport: "sse",
      activeSessions: sessions.size,
      tools: tools.map((t) => t.name),
      cache: process.env.REDIS_URL ? "enabled" : "disabled",
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sessions: sessions.size });
  });

  // SSE endpoint — creates a new session
  app.get("/sse", async (req: Request, res: Response) => {
    const sessionId = randomUUID();
    console.error(`[sse] New connection → session ${sessionId} from ${req.ip}`);

    // Important: disable buffering for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Session-Id", sessionId);

    const transport = new SSEServerTransport("/messages", res);

    // Store the session
    sessions.set(sessionId, transport);

    // Cleanup on close
    const cleanup = () => {
      sessions.delete(sessionId);
      console.error(`[sse] Session ${sessionId} closed (active: ${sessions.size})`);
    };

    res.on("close", cleanup);
    res.on("error", cleanup);

    try {
      await server.connect(transport);
      console.error(`[sse] Session ${sessionId} connected (active: ${sessions.size})`);
    } catch (err: any) {
      console.error(`[sse] Failed to connect session ${sessionId}:`, err.message);
      sessions.delete(sessionId);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });

  // Message endpoint — routes to the correct session
  app.post("/messages", async (req: Request, res: Response) => {
    // The client should send the sessionId (query param or header)
    const sessionId =
      (req.query.sessionId as string) ||
      (req.headers["x-session-id"] as string);

    if (!sessionId) {
      // Fallback: try to find any active transport (legacy clients)
      // In practice Grok / MCP clients should send the session id
      const first = sessions.values().next().value;
      if (first) {
        try {
          await first.handlePostMessage(req, res);
          return;
        } catch (err: any) {
          console.error("[messages] Error handling message (fallback):", err.message);
          return res.status(500).json({ error: err.message });
        }
      }
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      return res.status(404).json({ error: `Unknown session: ${sessionId}` });
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (err: any) {
      console.error(`[messages] Error for session ${sessionId}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.error("[server] Shutting down...");
    sessions.clear();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  app.listen(port, host, () => {
    console.error(`GA-to-Grok MCP server running on http://${host}:${port}`);
    console.error(`SSE endpoint      → http://${host}:${port}/sse`);
    console.error(`Messages endpoint → http://${host}:${port}/messages`);
    console.error(`Ready for Grok Custom Connector`);
  });
}
