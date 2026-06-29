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
    put: vi.fn(async (path: string, body: unknown) => {
      calls.push({ m: "put", path, arg: body });
      return { status: 204 };
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

  it("acculynx_jobs_set_work_type puts a numeric { id }", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_set_work_type", args: { jobId: "j-1", workTypeId: 1 } }, () => client);
    expect(calls[0]).toMatchObject({ m: "put", path: "/jobs/j-1/work-type", arg: { id: 1 } });
  });

  it("acculynx_jobs_set_trade_types wraps ids into an items collection", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_set_trade_types", args: { jobId: "j-1", tradeTypeIds: ["tt-1", "tt-2"] } }, () => client);
    expect(calls[0]).toMatchObject({ m: "put", path: "/jobs/j-1/trade-types", arg: { items: [{ id: "tt-1" }, { id: "tt-2" }] } });
  });

  it("acculynx_jobs_set_trade_types sends an empty items array to unassign all", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_set_trade_types", args: { jobId: "j-1", tradeTypeIds: [] } }, () => client);
    expect(calls[0]).toMatchObject({ m: "put", path: "/jobs/j-1/trade-types", arg: { items: [] } });
  });

  it("acculynx_jobs_work_types dispatches to GET the work-types endpoint", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_work_types", args: {} }, () => client);
    expect(calls[0]).toMatchObject({ m: "get", path: "/company-settings/job-file-settings/work-types" });
  });

  it("acculynx_jobs_trade_types dispatches to GET the trade-types endpoint", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_jobs_trade_types", args: {} }, () => client);
    expect(calls[0]).toMatchObject({ m: "get", path: "/company-settings/job-file-settings/trade-types" });
  });

  it("acculynx_jobs_set_work_type resolves a workType name to its id", async () => {
    const { client, calls } = fakeClient();
    client.get = vi.fn(async (path: string) => {
      calls.push({ m: "get", path });
      return { count: 2, pageSize: 25, pageStartIndex: 0, items: [{ id: 1, name: "Retail" }, { id: 2, name: "Insurance" }] };
    });
    await handleToolCall({ name: "acculynx_jobs_set_work_type", args: { jobId: "j-1", workType: "insurance" } }, () => client);
    expect(calls.find((c) => c.m === "put")).toMatchObject({ m: "put", path: "/jobs/j-1/work-type", arg: { id: 2 } });
  });

  it("acculynx_jobs_set_trade_types resolves tradeTypes names to ids", async () => {
    const { client, calls } = fakeClient();
    client.get = vi.fn(async (path: string) => {
      calls.push({ m: "get", path });
      return { count: 2, pageSize: 25, pageStartIndex: 0, items: [{ tradeId: "uuid-win", name: "Windows" }, { tradeId: "uuid-roof", name: "Roofing" }] };
    });
    await handleToolCall({ name: "acculynx_jobs_set_trade_types", args: { jobId: "j-1", tradeTypes: ["windows", "roofing"] } }, () => client);
    expect(calls.find((c) => c.m === "put")).toMatchObject({ m: "put", path: "/jobs/j-1/trade-types", arg: { items: [{ id: "uuid-win" }, { id: "uuid-roof" }] } });
  });

  it("acculynx_jobs_set_work_type errors when neither workType nor workTypeId is given", async () => {
    const { client } = fakeClient();
    const res = await handleToolCall({ name: "acculynx_jobs_set_work_type", args: { jobId: "j-1" } }, () => client);
    expect(res.isError).toBe(true);
  });

  it("acculynx_jobs_list advertises the sortBy enum", () => {
    const tool = buildTools().find((t) => t.name === "acculynx_jobs_list")!;
    const sortBy = (tool.inputSchema.properties as Record<string, { enum?: string[] }>).sortBy;
    expect(sortBy.enum).toEqual(["CreatedDate", "MilestoneDate", "ModifiedDate"]);
  });
});

describe("contacts dispatch", () => {
  it("acculynx_contacts_search posts the nested sort body with defaults", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_contacts_search", args: { query: "smith", startDate: "2026-01-01", endDate: "2026-12-31" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "post", path: "/contacts/search", arg: {
      searchTerm: "smith", startDate: "2026-01-01", endDate: "2026-12-31",
      sort: { sortColumn: "lastName", sortDirection: "Ascending" },
    } });
  });

  it("acculynx_contacts_phone_add coerces smsOptOut", async () => {
    const { client, calls } = fakeClient();
    await handleToolCall({ name: "acculynx_contacts_phone_add", args: { contactId: "c-1", type: "Mobile", number: "5551234" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "post", path: "/contacts/c-1/phone-numbers", arg: { type: "Mobile", number: "5551234", smsOptOut: false } });
  });

  it("acculynx_contacts_phone_add advertises the type enum", () => {
    const tool = buildTools().find((t) => t.name === "acculynx_contacts_phone_add")!;
    const typeProp = (tool.inputSchema.properties as Record<string, { enum?: string[] }>).type;
    expect(typeProp.enum).toEqual(["Mobile", "Home", "Work"]);
  });
});

describe("estimates + users dispatch", () => {
  it("acculynx_estimates_items builds the nested path", async () => {
    const { client, calls } = fakeClient();
    client.get = vi.fn(async (path: string) => { calls.push({ m: "get", path }); return []; });
    await handleToolCall({ name: "acculynx_estimates_items", args: { estimateId: "e-1", sectionId: "s-1" } }, () => client);
    expect(calls[0]).toMatchObject({ m: "get", path: "/estimates/e-1/sections/s-1/items" });
  });

  it("acculynx_users_list passes the search term through", async () => {
    const { client, calls } = fakeClient();
    client.get = vi.fn(async (path: string, params?: Record<string, string>) => {
      calls.push({ m: "get", path, arg: params });
      return { count: 0, pageSize: 25, pageStartIndex: 0, items: [] };
    });
    const res = await handleToolCall({ name: "acculynx_users_list", args: { search: "jane" } }, () => client);
    expect(res.isError).toBeUndefined();
    expect(calls[0]).toMatchObject({ m: "get", path: "/users" });
  });

  it("the full public surface advertises 34 tools", () => {
    expect(buildTools()).toHaveLength(34);
  });
});
