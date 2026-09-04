import { describe, it, expect } from "vitest";
import { marketingEvidence } from "./scan-marketing.js";
import type { ScanReport } from "./scan-digest.js";

function fixture(): ScanReport {
  return { filters: { dateFilterType: "ModifiedDate", startDate: "2026-07-01", endDate: "2026-09-04" }, enrich: ["dates", "financials"], scanned: 1, serverCount: 1, complete: true, jobs: [{
    job: { id: "full-canonical-job-id", createdDate: "2025-11-01T12:00:00Z", modifiedDate: "2026-09-02T16:30:00-04:00", currentMilestone: "Closed", workType: { name: "Repair" }, tradeTypes: [{ name: "Roofing" }], contacts: [{ id: "private-contact-id", contact: { firstName: "PRIVATE_NAME", email: "private@example.com" } }], locationAddress: { street1: "PRIVATE_ADDRESS" }, jobName: "PRIVATE_JOB_NAME" },
    financials: { approvedJobValue: 1234.56, balanceDue: 987, worksheetTotal: 2000 },
    dates: [{ name: "Approved", date: "2026-07-31T23:30:00-04:00" }, { name: "Approved", date: "2026-08-02" }], errors: [],
  }] };
}
describe("marketing evidence", () => {
  it("preserves full IDs, exact cents and all original approval representations", () => {
    const evidence = marketingEvidence(fixture(), "2026-09-04T06:00:00Z");
    expect(evidence.jobs[0]).toMatchObject({ id: "full-canonical-job-id", currentApprovedValueCents: 123456, createdDate: "2025-11-01T12:00:00Z", currentMilestone: "Closed", workType: "Repair", issues: [], milestones: [{ name: "Approved", sourceDate: "2026-07-31T23:30:00-04:00" }, { name: "Approved", sourceDate: "2026-08-02" }] });
    expect(evidence.coverage).toMatchObject({ queryComplete: true, enrichmentComplete: true });
    expect(evidence.isApprovalCohort).toBe(false);
    expect(evidence.isFullLeadInventory).toBe(false);
  });
  it("omits customer details, other financials and provider error text", () => {
    const report = fixture(); report.pageError = "SECRET_PAGE_BODY"; report.complete = false;
    report.jobs[0].errors.push({ jobId: "full-canonical-job-id", source: "dates", message: "SECRET_ERROR_BODY" });
    const evidence = marketingEvidence(report), text = JSON.stringify(evidence);
    for (const secret of ["PRIVATE_NAME", "private@example.com", "private-contact-id", "PRIVATE_ADDRESS", "PRIVATE_JOB_NAME", "SECRET_PAGE_BODY", "SECRET_ERROR_BODY", "balanceDue", "worksheetTotal"]) expect(text).not.toContain(secret);
    expect(evidence.coverage).toMatchObject({ queryComplete: false, enrichmentComplete: false, pageReadFailed: true });
    expect(evidence.jobs[0].milestones).toBeNull();
  });
  it.each([undefined, NaN, -1, 1.005, Number.MAX_SAFE_INTEGER])("does not turn invalid money %s into zero", value => {
    const report = fixture(); report.jobs[0].financials!.approvedJobValue = value;
    const evidence = marketingEvidence(report);
    expect(evidence.jobs[0].currentApprovedValueCents).toBeNull();
    expect(evidence.coverage.enrichmentComplete).toBe(false);
  });
  it("preserves an explicitly read zero", () => {
    const report = fixture(); report.jobs[0].financials!.approvedJobValue = 0;
    expect(marketingEvidence(report).jobs[0].currentApprovedValueCents).toBe(0);
  });
  it.each(["2026-02-30", "2026-08-01T24:00:00Z", "2026-08-01T12:00:00", "invalid"])("flags invalid or timezone-ambiguous source date %s", sourceDate => {
    const report = fixture(); report.jobs[0].dates![0].date = sourceDate;
    const evidence = marketingEvidence(report);
    expect(evidence.jobs[0].milestones![0].sourceDate).toBeNull();
    expect(evidence.coverage.enrichmentComplete).toBe(false);
  });
  it("does not claim coverage for missing totals, duplicates or missing enrichment", () => {
    const report = fixture(); delete report.serverCount;
    expect(marketingEvidence(report).coverage.queryComplete).toBe(false);
    report.serverCount = 2; report.scanned = 2; report.jobs.push(report.jobs[0]);
    expect(marketingEvidence(report).coverage.queryComplete).toBe(false);
    report.enrich = [];
    expect(marketingEvidence(report).coverage.enrichmentComplete).toBe(false);
  });
  it("retains an empty requested history without inventing approval", () => {
    const report = fixture(); report.jobs[0].dates = [];
    expect(marketingEvidence(report).jobs[0].milestones).toEqual([]);
  });
});
