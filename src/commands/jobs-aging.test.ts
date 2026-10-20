import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { registerJobsCommands } from "./jobs.js";

function setup(items: Record<string, unknown>[] = [], count = items.length) {
  const client: ApiClient = {
    get: vi.fn(async (path: string) => path === "/jobs" ? { count, pageSize: 25, pageStartIndex: 0, items }
      : path.endsWith("milestone-history") ? { items: [{ name: "Prospect", date: "2026-09-19" }] }
      : path.endsWith("financials") ? { approvedJobValue: 123.45, worksheetSectionTotals: { worksheetTotal: 456.78 } }
      : Promise.reject(new Error("Unexpected read"))),
    post: vi.fn(), put: vi.fn(), postForm: vi.fn(),
  };
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const program = new Command(); program.exitOverride(); registerJobsCommands(program, () => client);
  const run = (extra: string[] = []) => program.parseAsync(["node", "test", "jobs", "scan", ...extra]);
  return { client, log, error, run };
}
const args = ["--report", "prospect-aging", "--as-of", "2026-10-20", "--exclude-trade-type", "Maintenance Program"];
const job = (id: string, tradeTypes: unknown = []) => ({ id, currentMilestone: "Prospect", milestoneDate: "2026-09-19",
  tradeTypes, jobName: "SYNTHETIC", locationAddress: { street1: "TEST ADDRESS", city: "TEST CITY" } });

describe("bounded aging CLI", () => {
  afterEach(() => { process.exitCode = undefined; vi.restoreAllMocks(); });
  it("runs one strict enumeration and only existing GET enrichers for eligible jobs", async () => {
    const { client, log, run } = setup([job("included"), job("excluded", [{ name: "Maintenance Program" }])]);
    await run(args);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({ milestones: "Prospect", pageStartIndex: "0" }));
    expect(client.get).toHaveBeenCalledWith("/jobs/included/financials");
    expect(client.get).not.toHaveBeenCalledWith("/jobs/included/milestone-history");
    expect(client.post).not.toHaveBeenCalled(); expect(client.put).not.toHaveBeenCalled(); expect(client.postForm).not.toHaveBeenCalled();
    const output = String(log.mock.calls[0][0]);
    expect(output).toContain("PROSPECT AGING COMPLETE");
    expect(output).toContain("31–60 days: 1"); expect(output).toContain("approved $123.45 | estimate $456.78");
    expect(output).not.toContain("excluded | "); expect(process.exitCode).toBeUndefined();
  });
  it("does not enrich unknown trade evidence or present it as non-maintenance", async () => {
    const { client, log, run } = setup([job("unknown", null)]);
    await run(args);
    expect(client.get).toHaveBeenCalledTimes(1); expect(process.exitCode).toBe(3);
    expect(String(log.mock.calls[0][0])).toContain("unknown classification 1");
  });
  it("stops before financial reads when inventory is over the report limit or duplicated", async () => {
    for (const [items, count] of [[[job("a")], 5001], [[job("a"), job("a")], 2]] as [Record<string, unknown>[], number][]) {
      const { client, log, run } = setup(items, count);
      await run(args);
      expect(client.get).toHaveBeenCalledTimes(1); expect(process.exitCode).toBe(3);
      expect(String(log.mock.calls.at(-1)![0])).toContain("No aging totals or rows are asserted");
      vi.restoreAllMocks();
    }
  });
  it.each([
    ["--report", "unknown", "--as-of", "2026-10-20"], ["--report", "prospect-aging"],
    [...args, "--out", "/tmp/forbidden"], [...args, "--format", "jsonl"],
    [...args, "--trade-type", "Roofing"], [...args, "--milestones", "Approved"],
    [...args, "--enrich", "payments"], [...args, "--enrich", "dates"], [...args, "--start-date", "2026-01-01"],
    [...args, "--assignment", "assigned"], ["--as-of", "2026-10-20"],
    ["--report", "prospect-aging", "--as-of", "2026-02-30"],
    [...args, "--exclude-trade-type", "\n"],
  ])("rejects incompatible options before provider access: %j", async (...input) => {
    const { client, run } = setup();
    await run(input);
    expect(client.get).not.toHaveBeenCalled(); expect(process.exitCode).toBe(2);
  });
  it("returns a partial report for unavailable financial evidence without leaking provider error text", async () => {
    const { client, log, run } = setup([job("included")]);
    (client.get as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === "/jobs") return { count: 1, pageStartIndex: 0, items: [job("included")] };
      if (path.endsWith("milestone-history")) return { items: [] };
      throw new Error("PRIVATE PROVIDER DETAILS");
    });
    await run(args);
    expect(process.exitCode).toBe(3);
    expect(String(log.mock.calls[0][0])).toContain("financials_unavailable");
    expect(String(log.mock.calls[0][0])).not.toContain("PRIVATE");
  });
});
