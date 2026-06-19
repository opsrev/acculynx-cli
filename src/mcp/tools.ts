import { getConfig } from "../config.js";
import { createApiClient, type ApiClient } from "../api-client.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

// ---- shared schema property constants ----
export const LIMIT = { type: "number", description: "Max total results (default 25). Omit and set all=true to fetch everything." };
export const ALL = { type: "boolean", description: "Fetch all results (ignores limit)." };
export const DATE = { type: "string", description: "Date in YYYY-MM-DD format.", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
export const BODY = { type: "object", description: "The full JSON request body for this resource.", additionalProperties: true };

const SORT_ORDER = { type: "string", enum: ["Ascending", "Descending"], description: "Sort direction." };

// ---- result + coercion helpers ----
export function ok(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}
export function fail(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: true };
}

export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
export const boolOf = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

// resolve the CLI-equivalent { all, limit } semantics into a single limit value
export const resolveLimit = (args: Record<string, unknown>): number | undefined =>
  boolOf(args.all) ? Infinity : num(args.limit);

// re-exported for tool/dispatch modules built in later tasks
export { SORT_ORDER };

function defaultClient(): ApiClient {
  return createApiClient(getConfig({}));
}

export function buildTools(): McpTool[] {
  return [
    // populated by Tasks 2-4
  ];
}

export async function handleToolCall(
  call: { name: string; args: Record<string, unknown> | undefined },
  makeClient: () => ApiClient = defaultClient
): Promise<ToolResult> {
  const args = call.args ?? {};
  try {
    const client = makeClient();
    switch (call.name) {
      // cases added by Tasks 2-4
      default:
        return fail({ error: "unknown_tool", message: `Unknown tool: ${call.name}` });
    }
  } catch (e) {
    return fail({ error: "acculynx_error", message: e instanceof Error ? e.message : String(e) });
  }
}
