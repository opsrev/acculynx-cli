import { describe, it, expect } from "vitest";
import { formatScanDigest, formatScanJsonl, type ScanReport } from "./scan-digest.js";

const enriched = (id: string, over: Record<string, unknown> = {}) => ({
  job: {
    id: `${id}-aaaa-bbbb`, jobName: "Fallback Name", currentMilestone: "Approved",
    milestoneDate: "2026-07-14T00:00:00Z",
    locationAddress: { street1: "8277 Grand Messina Cir", city: "Jupiter" },
    contacts: [{ isPrimary: true, contact: { firstName: "Lisa", lastName: "Carelli" } }],
  },
  financials: { approvedJobValue: 0, balanceDue: 12300, worksheetTotal: 38500 },
  reps: { salesOwner: "Frank Leo" },
  errors: [],
  ...over,
});

const report = (over: Partial<ScanReport> = {}): ScanReport => ({
  filters: { milestones: "Approved", startDate: "2026-06-01" },
  enrich: ["financials", "reps"],
  jobs: [enriched("377b4f89")],
  scanned: 1, serverCount: 1, complete: true, ...over,
});

describe("formatScanDigest", () => {
  it("renders the documented header and job line", () => {
    const text = formatScanDigest(report());
    const [h1, h2, line] = text.split("\n");
    expect(h1).toBe("SCAN milestones=Approved since=2026-06-01 enrich=financials,reps");
    expect(h2).toBe("jobs 1/1 (server count 1) · enriched 1 · errors 0");
    expect(line).toBe("377b4f89 | Lisa Carelli — 8277 Grand Messina Cir, Jupiter | Approved 07-14 | rep Frank Leo | wk $38,500 | appr $0 | bal $12,300");
  });

  it("marks partial scans and lists per-job errors", () => {
    const bad = enriched("9a1b2c3d", { financials: undefined, errors: [{ jobId: "9a1b2c3d", source: "financials", message: "HTTP 500" }] });
    const text = formatScanDigest(report({ jobs: [enriched("377b4f89"), bad], serverCount: 5, complete: false, pageError: "HTTP 500 on page 2" }));
    expect(text.split("\n")[0]).toMatch(/^SCAN PARTIAL /);
    expect(text).toContain("PARTIAL: HTTP 500 on page 2");
    expect(text).toContain("ERR:financials");
    expect(text).toContain("errors:\n  9a1b2c3d financials: HTTP 500");
  });

  it("keeps lines lean without enrichment", () => {
    const only = enriched("377b4f89", { financials: undefined, reps: undefined });
    const text = formatScanDigest(report({ enrich: [], jobs: [only] }));
    expect(text.split("\n")[2]).toBe("377b4f89 | Lisa Carelli — 8277 Grand Messina Cir, Jupiter | Approved 07-14");
    expect(text.split("\n")[1]).toBe("jobs 1/1 (server count 1)");
  });

  it("reports the pre-filter scan count and what the trade filter matched", () => {
    const text = formatScanDigest(report({
      filters: { milestones: "Approved", tradeType: ["gutters"] },
      enrich: [], jobs: [enriched("377b4f89")], scanned: 2, serverCount: 2, complete: true,
    }));
    expect(text.split("\n")[1]).toBe("jobs 2/2 (server count 2) · trade matched 1");
  });

  it("renders both reps when the company rep differs from the sales owner", () => {
    const both = enriched("377b4f89", { reps: { salesOwner: "Frank Leo", company: "Ana Ruiz" } });
    const text = formatScanDigest(report({ enrich: ["reps"], jobs: [both] }));
    expect(text.split("\n")[2]).toContain("| rep Frank Leo (co Ana Ruiz)");
  });

  it("shows a missing sales owner as '-' beside the company rep", () => {
    const coOnly = enriched("377b4f89", { reps: { company: "Ana Ruiz" } });
    const text = formatScanDigest(report({ enrich: ["reps"], jobs: [coOnly] }));
    expect(text.split("\n")[2]).toContain("| rep - (co Ana Ruiz)");
  });

  it("does not repeat the company rep when it equals the sales owner", () => {
    const same = enriched("377b4f89", { reps: { salesOwner: "Frank Leo", company: "Frank Leo" } });
    const line = formatScanDigest(report({ enrich: ["reps"], jobs: [same] })).split("\n")[2];
    expect(line).toContain("| rep Frank Leo");
    expect(line).not.toContain("(co ");
  });

  it("keeps the dates field present when a job has no Approved milestone", () => {
    const withDate = enriched("377b4f89", { dates: [{ name: "Approved", date: "2026-07-14T00:00:00Z" }] });
    const without = enriched("9a1b2c3d", { dates: [{ name: "Lead", date: "2026-06-01T00:00:00Z" }] });
    const [a, b] = formatScanDigest(report({ enrich: ["dates"], jobs: [withDate, without] })).split("\n").slice(2);
    expect(a).toContain("| appr’d 07-14");
    expect(b).toContain("| appr’d -");
    expect(b.split("|")).toHaveLength(a.split("|").length);
  });

  it("falls back to the job name when contacts is not an array", () => {
    const odd = enriched("377b4f89", {
      job: {
        id: "377b4f89-aaaa-bbbb", jobName: "Fallback Name", currentMilestone: "Approved",
        milestoneDate: "2026-07-14T00:00:00Z", locationAddress: {}, contacts: null,
      },
    });
    const text = formatScanDigest(report({ enrich: [], jobs: [odd] }));
    expect(text.split("\n")[2]).toBe("377b4f89 | Fallback Name — -, - | Approved 07-14");
  });

  it("falls back to '-' for empty-string rep and address fields, not just missing ones", () => {
    const blank = enriched("377b4f89", {
      job: {
        id: "377b4f89-aaaa-bbbb", jobName: "Fallback Name", currentMilestone: "Approved",
        milestoneDate: "2026-07-14T00:00:00Z",
        locationAddress: { street1: "", city: "" },
        contacts: [{ isPrimary: true, contact: { firstName: "Lisa", lastName: "Carelli" } }],
      },
      reps: { salesOwner: "", company: "" },
    });
    const text = formatScanDigest(report({ jobs: [blank] }));
    expect(text.split("\n")[2]).toBe(
      "377b4f89 | Lisa Carelli — -, - | Approved 07-14 | rep - | wk $38,500 | appr $0 | bal $12,300"
    );
  });
});

describe("formatScanJsonl", () => {
  it("emits one parseable object per job", () => {
    const lines = formatScanJsonl(report()).split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).reps.salesOwner).toBe("Frank Leo");
  });
});
