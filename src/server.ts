import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, handleToolCall } from "./tools/index.js";

export async function startServer(transportType: "stdio" | "http" = "stdio") {
  const server = new Server(
    {
      name: "ga-to-grok",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  });

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GA-to-Grok MCP server running on STDIO");
  } else {
    // HTTP / SSE mode for Grok Custom Connector
    // Note: Full Streamable HTTP implementation will be completed in next iteration
    const port = parseInt(process.env.PORT || "3000", 10);
    console.error(`GA-to-Grok MCP server starting in HTTP mode on port ${port}`);
    console.error("Full Streamable HTTP / SSE transport implementation coming soon.");
    console.error("For now, use a reverse proxy or ngrok + local STDIO bridge if needed.");
  }
}
