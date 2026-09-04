import type { ScanReport } from "./scan-digest.js";

/** Private operator evidence, not an attribution result or a public report. */
export function marketingEvidence(report: ScanReport, capturedAt = new Date().toISOString()) {
  const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const ids = new Set<string>();
  let uniqueIds = true;
  const jobs = report.jobs.map(entry => {
    const issues: string[] = [];
    const id = typeof entry.job.id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(entry.job.id) ? entry.job.id : null;
    if (!id) issues.push("invalid_job_id");
    else if (ids.has(id)) { uniqueIds = false; issues.push("duplicate_job_id"); }
    else ids.add(id);
    const date = (value: unknown, field: string) => {
      // Preserve the source representation; deciding calendar-date versus
      // timestamp semantics belongs to the reviewed normalization step.
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) === value.slice(0, 10)) return value;
      issues.push("invalid_" + field); return null;
    };
    const label = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
    const failed = new Set(entry.errors.map(e => e.source));
    for (const source of ["financials", "dates"]) if (failed.has(source)) issues.push(source + "_read_failed");
    let approvedValueCents: number | null = null;
    const value = entry.financials?.approvedJobValue;
    if (!failed.has("financials") && typeof value === "number" && Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) <= 0.000001) approvedValueCents = Math.round(value * 100);
    else issues.push("approved_value_unavailable");
    let milestones: Array<{ name: string | null; sourceDate: string | null }> | null = null;
    if (!failed.has("dates") && Array.isArray(entry.dates)) {
      milestones = entry.dates.map(d => {
        const name = label(d.name); if (!name) issues.push("invalid_milestone_name");
        return { name, sourceDate: date(d.date, "milestone_date") };
      });
    } else issues.push("milestone_history_unavailable");
    return {
      id, createdDate: date(entry.job.createdDate, "created_date"),
      modifiedDate: date(entry.job.modifiedDate, "modified_date"),
      currentMilestone: label(entry.job.currentMilestone),
      workType: label(record(entry.job.workType).name),
      tradeTypes: Array.isArray(entry.job.tradeTypes) ? entry.job.tradeTypes.map(t => label(record(t).name)).filter((v): v is string => v !== null) : [],
      milestones, currentApprovedValueCents: approvedValueCents,
      issues: [...new Set(issues)],
    };
  });
  const queryComplete = report.complete && Number.isSafeInteger(report.serverCount) && report.serverCount! >= 0 && report.scanned === report.serverCount && uniqueIds && jobs.every(j => j.id !== null);
  const enrichmentComplete = report.enrich.includes("dates") && report.enrich.includes("financials") && jobs.every(j => j.issues.length === 0);
  return {
    schemaVersion: "acculynx-marketing-evidence/v1",
    capturedAt, filters: report.filters,
    coverage: { scanned: report.scanned, serverCount: report.serverCount ?? null, emitted: jobs.length, queryComplete, enrichmentComplete, pageReadFailed: Boolean(report.pageError) },
    // Query coverage is never a claim about historical approval or acquisition.
    isApprovalCohort: false, isFullLeadInventory: false,
    jobs,
  };
}
