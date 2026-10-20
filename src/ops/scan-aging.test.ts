import { describe, it, expect } from "vitest";
import { AGING_BUCKETS, MAX_AGING_OUTPUT_CHARS, agingClassification, calendarDay, formatProspectAging, prospectAging } from "./scan-aging.js";
import type { EnrichedJob } from "./scan.js";
import type { ScanReport } from "./scan-digest.js";

const asOf = "2026-10-20";
function entry(id: string, age = 0, override: Partial<EnrichedJob> = {}): EnrichedJob {
  const date = new Date(Date.parse(asOf + "T00:00:00Z") - age * 86400000).toISOString().slice(0, 10);
  return { job: { id, currentMilestone: "Prospect", milestoneDate: date, tradeTypes: [], jobName: "SYNTHETIC NAME",
    locationAddress: { street1: "SYNTHETIC ADDRESS", city: "TEST CITY" } },
    dates: [{ name: "Prospect", date }], financials: { approvedJobValue: 1234.56, worksheetTotal: 2345.67 }, errors: [], ...override };
}
function report(jobs: EnrichedJob[], override: Partial<ScanReport> = {}): ScanReport {
  return { filters: { milestones: "Prospect" }, enrich: ["dates", "financials"], jobs,
    scanned: jobs.length, serverCount: jobs.length, complete: true, ...override };
}
const build = (jobs: EnrichedJob[], exclusions = ["Maintenance Program"]) => prospectAging(report(jobs), asOf, exclusions);

describe("prospect aging", () => {
  it("partitions every inclusive cutoff without server date-range overlap", () => {
    const r = build([0, 30, 31, 60, 61, 90, 91, 800].map((age, i) => entry(`job-${i}`, age)));
    expect(r.status).toBe("complete");
    expect(r.counts?.buckets).toEqual(Object.fromEntries(AGING_BUCKETS.map(b => [b, 2])));
    expect(r.rows.at(-1)?.milestoneDate).toMatch(/^2024-/);
  });
  it("uses full identity and exact trade names; duplicate addresses/short prefixes remain separate", () => {
    const rows = [entry("samepref-a"), entry("samepref-b"), entry("maintenance"), entry("other")];
    rows[2].job.tradeTypes = [{ name: "Roofing" }, { name: " maintenance PROGRAM " }];
    rows[3].job.tradeTypes = [{ name: "Maintenance Program Repair" }];
    const r = build(rows);
    expect(r.counts).toMatchObject({ excluded: 1, eligible: 3, unknownClassification: 0 });
    expect(r.rows.filter(x => x.classification === "included").map(x => x.id)).toEqual(["samepref-a", "samepref-b", "other"]);
    expect(formatProspectAging(r)).not.toContain("maintenance | ");
  });
  it("does not treat absent or malformed trade evidence as non-maintenance", () => {
    const a = entry("a"), b = entry("b"), c = entry("c");
    delete a.job.tradeTypes; b.job.tradeTypes = [{ id: "missing-name" }];
    c.job.tradeTypes = [{ name: "Maintenance Program" }, null];
    const r = build([a, b, c]);
    expect(r.status).toBe("partial");
    expect(r.counts).toMatchObject({ excluded: 1, eligible: 0, unknownClassification: 2 });
    expect(agingClassification(a.job, [])).toBe("included");
  });
  it.each([undefined, "2026-02-30", "2026-10-21", "2026-10-20T12:00:00", "not a date"])("keeps %s dates unknown", value => {
    const e = entry("a"); e.job.milestoneDate = value;
    const r = build([e]);
    expect(r.status).toBe("partial"); expect(r.counts?.unknownAge).toBe(1);
    expect(r.rows[0].bucket).toBeNull();
  });
  it("compares calendar dates in Eastern time, including DST, while retaining date-only values", () => {
    const a = entry("utc"); a.job.milestoneDate = "2026-10-20T02:00:00Z";
    expect(build([a]).rows[0]).toMatchObject({ milestoneDate: "2026-10-19", ageDays: 1 });
    const b = entry("dst"); b.job.milestoneDate = "2026-03-08T05:00:00Z";
    expect(prospectAging(report([b]), "2026-03-09", []).rows[0].ageDays).toBe(1);
    expect(build([entry("calendar")]).rows[0].ageDays).toBe(0);
  });
  it("keeps unavailable enrichment distinct from zero and renders precise separate financial values", () => {
    const good = entry("good"), missing = entry("missing", 5, { financials: {}, errors: [] });
    const failed = entry("failed", 10, { errors: [{ jobId: "failed", source: "financials", message: "PRIVATE PROVIDER ERROR" }] });
    const badDate = entry("bad-date", 20); badDate.job.milestoneDate = undefined;
    const r = build([good, missing, failed, badDate]);
    const out = formatProspectAging(r);
    expect(out).toContain("approved $1,234.56 | estimate $2,345.67");
    expect(out).toContain("approved unavailable | estimate unavailable");
    expect(out).not.toMatch(/PRIVATE|\$0\.00/);
    expect(r.status).toBe("partial"); expect(r.rows[3].ageDays).toBeNull();
    const zero = build([entry("zero", 0, { financials: { approvedJobValue: 0, worksheetTotal: 0 } })]);
    expect(formatProspectAging(zero)).toContain("approved $0.00 | estimate $0.00");
  });
  it("marks empty financial evidence partial while accepting one available value", () => {
    for (const financials of [{}, { approvedJobValue: null, worksheetTotal: null }]) {
      const r = build([entry("missing", 0, { financials })]);
      expect(r.status).toBe("partial");
      expect(r.rows[0].issues).toContain("financial_values_unavailable");
    }
    const r = build([entry("estimate", 0, { financials: { worksheetTotal: 123.45 } })]);
    expect(r.status).toBe("complete"); expect(r.rows[0].approvedCents).toBeNull();
    expect(r.rows[0].worksheetCents).toBe(12345);
    // Current list milestoneDate needs no redundant history enrichment.
    expect(build([entry("current", 0, { dates: undefined })]).status).toBe("complete");
  });
  it.each([NaN, Infinity, -1, 1.234, Number.MAX_SAFE_INTEGER, "123"])("rejects malformed money %s", value => {
    const e = entry("a"); e.financials!.approvedJobValue = value as number;
    const r = build([e]); expect(r.status).toBe("partial"); expect(r.rows[0].approvedCents).toBeNull();
  });
  it("withholds totals for partial, duplicate, missing-ID and inconsistent inventories", () => {
    for (const input of [report([entry("a")], { complete: false }), report([entry("a")], { serverCount: 2 }),
      report([entry("a"), entry("a")]), report([entry("")]), report([entry("a")], { serverCount: undefined })]) {
      const r = prospectAging(input, asOf, []);
      expect(r.status).toBe("partial"); expect(r.counts).toBeNull(); expect(r.rows).toEqual([]);
      expect(formatProspectAging(r)).toContain("No aging totals or rows are asserted");
    }
  });
  it("reconciles a 434-job synthetic inventory and emits every included row for bounded process-log pages", () => {
    const jobs = Array.from({ length: 434 }, (_, i) => entry(`synthetic-${i}`, i % 120));
    for (const e of jobs.slice(0, 183)) e.job.tradeTypes = [{ name: "Maintenance Program" }];
    const r = build(jobs); const lines = formatProspectAging(r).split("\n");
    const pages = Array.from({ length: Math.ceil(lines.length / 40) }, (_, i) => lines.slice(i * 40, (i + 1) * 40));
    expect(pages.flat()).toEqual(lines);
    expect(r.status).toBe("complete"); expect(r.counts).toMatchObject({ excluded: 183, eligible: 251 });
    expect(formatProspectAging(r).length).toBeLessThan(MAX_AGING_OUTPUT_CHARS);
    expect(lines.filter(l => /^synthetic-\d+ \|/.test(l))).toHaveLength(251);
    expect(Object.values(r.counts!.buckets).reduce((a, b) => a + b, 0)).toBe(251);
  });
  it("fails closed before a detailed report can exceed retained process output", () => {
    const jobs = Array.from({ length: 5000 }, (_, i) => entry(`synthetic-${i}`));
    const r = build(jobs); const output = formatProspectAging(r);
    expect(r.status).toBe("partial"); expect(r.issues).toContain("report_output_limit");
    expect(r.counts?.eligible).toBe(5000); expect(r.rows).toEqual([]);
    expect(output).toContain("no detailed list is asserted");
    expect(output.length).toBeLessThan(MAX_AGING_OUTPUT_CHARS);
    expect(output).not.toMatch(/^synthetic-/m);
  });
  it("handles empty inventory, rejects invalid options and keeps provider strings on a single data line", () => {
    expect(build([]).status).toBe("complete");
    expect(calendarDay("2026-02-29")).toBeNull();
    expect(() => prospectAging(report([]), "bad", [])).toThrow(/as-of/);
    expect(() => build([], ["\n"])).toThrow(/exclusions/);
    const e = entry("a"); e.job.jobName = "SYNTHETIC\nINJECTION|DATA";
    expect(formatProspectAging(build([e]))).toContain("SYNTHETIC INJECTION DATA");
  });
});
