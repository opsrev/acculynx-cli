import { describe, it, expect, vi } from "vitest";
import { scanJobs, enrichJobs } from "./scan.js";
import type { ApiClient } from "../api-client.js";

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id, jobName: `Job ${id}`, currentMilestone: "Approved",
  milestoneDate: "2026-07-14T00:00:00Z", createdDate: "2026-06-01T00:00:00Z",
  locationAddress: { street1: `${id} Main St`, city: "Jupiter" },
  contacts: [{ isPrimary: true, contact: { firstName: "Pat", lastName: "Doe" } }],
  tradeTypes: [], ...extra,
});
const page = (items: unknown[], count: number) => ({ count, pageSize: 25, pageStartIndex: 0, items });

function clientFromPages(pages: Array<unknown | Error>): ApiClient {
  const get = vi.fn();
  for (const p of pages) p instanceof Error ? get.mockRejectedValueOnce(p) : get.mockResolvedValueOnce(p);
  return { get, post: vi.fn(), put: vi.fn(), postForm: vi.fn() } as unknown as ApiClient;
}

describe("scanJobs", () => {
  it("pages until a short page and reports the server count", async () => {
    const first = page(Array.from({ length: 25 }, (_, i) => job(`a${i}`)), 30);
    const second = page(Array.from({ length: 5 }, (_, i) => job(`b${i}`)), 30);
    const client = clientFromPages([first, second]);
    const result = await scanJobs(client, { milestones: "Approved" });
    expect(result.jobs).toHaveLength(30);
    expect(result.serverCount).toBe(30);
    expect(result.complete).toBe(true);
    expect((client.get as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      "/jobs",
      expect.objectContaining({ milestones: "Approved", includes: "contact", pageSize: "25", pageStartIndex: "0" }),
    ]);
  });

  it("a mid-run page failure yields complete=false with what was fetched", async () => {
    const first = page(Array.from({ length: 25 }, (_, i) => job(`a${i}`)), 60);
    const client = clientFromPages([first, new Error("HTTP 500")]);
    const result = await scanJobs(client, {});
    expect(result.jobs).toHaveLength(25);
    expect(result.complete).toBe(false);
    expect(result.pageError).toMatch(/HTTP 500/);
  });

  it("a fetched/server-count mismatch is incomplete", async () => {
    const only = page([job("a1")], 5); // server says 5, page says done after 1
    const result = await scanJobs(clientFromPages([only]), {});
    expect(result.complete).toBe(false);
  });

  it("trade-type filters client-side without breaking completeness", async () => {
    const items = [job("a1", { tradeTypes: [{ name: "Gutters" }] }), job("a2")];
    const result = await scanJobs(clientFromPages([page(items, 2)]), { tradeType: ["gutters"] });
    expect(result.jobs.map((j) => j.id)).toEqual(["a1"]);
    expect(result.complete).toBe(true); // completeness judged pre-filter
  });
});

describe("enrichJobs", () => {
  const jobs = [ { id: "j1" }, { id: "j2" } ] as Record<string, unknown>[];

  function enrichClient(overrides: Record<string, (path: string) => unknown> = {}): ApiClient {
    const get = vi.fn(async (path: string) => {
      for (const [needle, fn] of Object.entries(overrides)) if (path.includes(needle)) return fn(path);
      if (path.includes("/financials")) return { approvedJobValue: 100, balanceDue: 40, worksheetSectionTotals: { worksheetTotal: 90 } };
      if (path.includes("/representatives")) return { items: [{ type: "SalesOwner", user: { id: "u1" } }] };
      if (path.includes("/milestone-history")) return { items: [{ name: "Approved", date: "2026-07-14T00:00:00Z" }] };
      if (path === "/users") return { count: 1, pageSize: 25, pageStartIndex: 0, items: [{ id: "u1", displayName: "Frank Leo" }] };
      throw new Error(`unexpected ${path}`);
    });
    return { get, post: vi.fn(), put: vi.fn(), postForm: vi.fn() } as unknown as ApiClient;
  }

  it("attaches financials, named reps, and dates", async () => {
    const out = await enrichJobs(enrichClient(), jobs, ["financials", "reps", "dates"]);
    expect(out[0].financials).toEqual({ approvedJobValue: 100, balanceDue: 40, worksheetTotal: 90 });
    expect(out[0].reps).toEqual({ salesOwner: "Frank Leo" });
    expect(out[0].dates).toEqual([{ name: "Approved", date: "2026-07-14T00:00:00Z" }]);
    expect(out[0].errors).toEqual([]);
  });

  it("fetches /users exactly once for the whole scan", async () => {
    const client = enrichClient();
    await enrichJobs(client, jobs, ["reps"]);
    const userCalls = (client.get as ReturnType<typeof vi.fn>).mock.calls.filter(([p]) => p === "/users");
    expect(userCalls).toHaveLength(1);
  });

  it("captures a per-job failure without dropping the job or the run", async () => {
    const client = enrichClient({ "j2/financials": () => { throw new Error("boom"); } });
    const out = await enrichJobs(client, jobs, ["financials"]);
    expect(out[1].financials).toBeUndefined();
    expect(out[1].errors).toEqual([{ jobId: "j2", source: "financials", message: "boom" }]);
    expect(out[0].errors).toEqual([]);
  });

  it("respects the concurrency bound", async () => {
    let inFlight = 0, peak = 0;
    const slow = vi.fn(async (path: string) => {
      if (!path.includes("/financials")) return { items: [] };
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { worksheetSectionTotals: {} };
    });
    const client = { get: slow, post: vi.fn(), put: vi.fn(), postForm: vi.fn() } as unknown as ApiClient;
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `j${i}` }));
    await enrichJobs(client, many, ["financials"], 3);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
