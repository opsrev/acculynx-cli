#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { getConfig, type AccuLynxConfig } from "./config.js";
import { buildTools, handleToolCall, type McpTool, type ToolResult } from "./mcp/tools.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function log(msg: string): void {
  process.stderr.write(`[acculynx-mcp] ${msg}\n`);
}

/**
 * Fail fast at boot if the API key is missing/unresolvable (getConfig throws).
 * Exported with injectable deps so it can be unit-tested without booting the server.
 */
export async function bootSelfCheck(
  getCfg: () => AccuLynxConfig = () => getConfig({}),
  logFn: (msg: string) => void = log,
  exit: (code: number) => never = process.exit as (code: number) => never
): Promise<void> {
  try {
    getCfg();
  } catch (e) {
    logFn(`fatal: ${e instanceof Error ? e.message : String(e)}`);
    exit(1);
  }
}

async function main(): Promise<void> {
  await bootSelfCheck();

  // Merge private secret-sauce tools if the extension package is installed (Plan C wires the other side).
  let extendedTools: McpTool[] = [];
  let handleExtended: ((c: { name: string; args: Record<string, unknown> | undefined }) => Promise<ToolResult>) | null = null;
  try {
    const resolved = require.resolve("@opsrev/acculynx-cli-unofficial");
    const mod = await import(resolved);
    if (typeof mod.extendedTools === "function" && typeof mod.handleExtendedToolCall === "function") {
      extendedTools = mod.extendedTools();
      handleExtended = mod.handleExtendedToolCall;
    }
  } catch {
    // not installed — public tools only
  }

  const publicNames = new Set(buildTools().map((t) => t.name));
  const server = new Server({ name: "acculynx", version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...buildTools(), ...extendedTools] }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const call = { name: req.params.name, args: req.params.arguments as Record<string, unknown> | undefined };
    if (publicNames.has(call.name) || !handleExtended) {
      return (await handleToolCall(call)) as never;
    }
    return (await handleExtended(call)) as never;
  });

  await server.connect(new StdioServerTransport());
  log("connected (stdio)");
}

// Only auto-run when invoked as the bin, not when imported by tests.
if (process.env.VITEST === undefined) {
  main().catch((e) => {
    log(`fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    process.exit(1);
  });
}
