import { describe, it, expect, vi } from "vitest";
import { buildTools, handleToolCall } from "./tools.js";
import type { ApiClient } from "../api-client.js";

// Shared fake client for all dispatch tests. Records calls; reused by Tasks 2-4.
function fakeClient(): { client: ApiClient; calls: Array<{ m: string; path: string; arg?: unknown }> } {
  const calls: Array<{ m: string; path: string; arg?: unknown }> = [];
  const client: ApiClient = {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      calls.push({ m: "get", path, arg: params });
      return { count: 0, pageSize: 25, pageStartIndex: 0, items: [] };
    }),
    post: vi.fn(async (path: string, body: unknown) => {
      calls.push({ m: "post", path, arg: body });
      return { status: 200 };
    }),
    postForm: vi.fn(async (path: string) => {
      calls.push({ m: "postForm", path });
      return { id: "doc-1" };
    }),
  };
  return { client, calls };
}

describe("mcp tools skeleton", () => {
  it("buildTools returns an array", () => {
    expect(Array.isArray(buildTools())).toBe(true);
  });

  it("handleToolCall returns a structured error for an unknown tool", async () => {
    // Inject a client so the unknown-tool path doesn't construct the real one
    // (getConfig would throw without ACCULYNX_API_KEY set in the test env).
    const { client } = fakeClient();
    const res = await handleToolCall({ name: "acculynx_not_a_tool", args: {} }, () => client);
    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.error).toBe("unknown_tool");
  });
});

describe("jobs + ping dispatch", () => {
  it("acculynx_ping dispatches to GET /diagnostics/ping", async () => {
    const { client, calls } = fakeClient();
    const res = await handleToolCall({ name: "acculynx_ping", args: {} }, () => client);
    expect(res.isError).toBeUndefined();
    expect(calls[0]).toMatchObject({ m: "get", path: "/diagnostics/ping" });
  });

  it("acculynx_jobs_get dispatches with jobId", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_get", args: { jobId: "j-1" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "get", path: "/jobs/j-1" });
  });

  it("acculynx_jobs_search posts the SearchTerm body", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_search", args: { query: "barn" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "post", path: "/jobs/search", arg: { SearchTerm: "barn" } });
  });

  it("acculynx_jobs_reps_assign defaults type to company", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_reps_assign", args: { jobId: "j-1", userId: "u-1" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "post", path: "/jobs/j-1/representatives/company", arg: { id: "u-1" } });
  });

  it("acculynx_jobs_list advertises the sortBy enum", () => {
    const tool = buildTools().find((t) => t.name === "acculynx_jobs_list")!;
    const sortBy = (tool.inputSchema.properties as Record<string, { enum?: string[] }>).sortBy;
    expect(sortBy.enum).toEqual(["CreatedDate", "MilestoneDate", "ModifiedDate"]);
  });
});
