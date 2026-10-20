import type { EnrichedJob } from "./scan.js";
import type { ScanReport } from "./scan-digest.js";

export const AGING_TIME_ZONE = "America/New_York";
export const MAX_AGING_JOBS = 5000;
// Leave headroom below OpenClaw's 200,000-character retained process output.
export const MAX_AGING_OUTPUT_CHARS = 180000;
export const AGING_BUCKETS = ["0–30", "31–60", "61–90", "91+"] as const;
type Bucket = typeof AGING_BUCKETS[number];
type Classification = "included" | "excluded" | "unknown";

const clean = (v: unknown, max = 200): string => typeof v === "string"
  ? v.replace(/[\u0000-\u001f\u007f|]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const normalized = (v: string): string => v.trim().replace(/\s+/g, " ").toLowerCase();

export function calendarDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return null;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

/** Preserve date-only provider values; convert explicit instants to Leo's calendar. */
function milestoneDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (calendarDay(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      || !calendarDay(value.slice(0, 10))) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: AGING_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function agingClassification(job: Record<string, unknown>, exclusions: string[]): Classification {
  const types = job.tradeTypes;
  if (!Array.isArray(types)) return exclusions.length ? "unknown" : "included";
  const names = types.map(t => t && typeof t === "object" ? (t as Record<string, unknown>).name : undefined);
  if (names.some(n => typeof n === "string" && exclusions.some(e => normalized(e) === normalized(n)))) return "excluded";
  return exclusions.length && names.some(n => typeof n !== "string" || !n.trim()) ? "unknown" : "included";
}

export interface AgingRow {
  id: string; name: string; address: string; milestoneDate: string | null;
  ageDays: number | null; bucket: Bucket | null; classification: Classification;
  approvedCents: number | null; worksheetCents: number | null; issues: string[];
}
export interface AgingReport {
  schema: "acculynx-prospect-aging/v1"; asOf: string; timeZone: string; exclusions: string[];
  status: "complete" | "partial"; scanned: number; serverCount: number | null;
  issues: string[]; counts: null | { excluded: number; eligible: number; unknownClassification: number;
    unknownAge: number; buckets: Record<Bucket, number> }; rows: AgingRow[];
}

function amount(value: unknown, issues: string[]): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    issues.push("invalid_financial_value"); return null;
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) {
    issues.push("invalid_financial_value"); return null;
  }
  return cents;
}

function row(entry: EnrichedJob, asOf: string, exclusions: string[]): AgingRow {
  const job = entry.job, issues: string[] = [];
  const classification = agingClassification(job, exclusions);
  const address = job.locationAddress && typeof job.locationAddress === "object"
    ? job.locationAddress as Record<string, unknown> : {};
  const contacts = Array.isArray(job.contacts) ? job.contacts as Array<Record<string, unknown>> : [];
  const primary = contacts.find(c => c && c.isPrimary === true)?.contact as Record<string, unknown> | undefined;
  const name = primary ? [clean(primary.firstName), clean(primary.lastName)].filter(Boolean).join(" ") : clean(job.jobName);
  const result: AgingRow = { id: String(job.id), name: name || "—",
    address: [clean(address.street1), clean(address.city)].filter(Boolean).join(", ") || "—",
    milestoneDate: null, ageDays: null, bucket: null, classification,
    approvedCents: null, worksheetCents: null, issues };
  if (classification === "excluded") return result;
  if (classification === "unknown") { issues.push("unknown_trade_classification"); return result; }
  if (normalized(String(job.currentMilestone ?? "")) !== "prospect") issues.push("unexpected_milestone");
  const day = milestoneDay(job.milestoneDate);
  if (!day) issues.push("missing_or_invalid_milestone_date");
  else if (day > asOf) issues.push("future_milestone_date");
  else if (!issues.length) {
    result.milestoneDate = day;
    result.ageDays = Math.round((Date.parse(asOf + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) / 86400000);
    const age = result.ageDays;
    result.bucket = age <= 30 ? "0–30" : age <= 60 ? "31–60" : age <= 90 ? "61–90" : "91+";
  }
  if (entry.errors.some(e => e.source === "financials") || !entry.financials) issues.push("financials_unavailable");
  else {
    result.approvedCents = amount(entry.financials.approvedJobValue, issues);
    result.worksheetCents = amount(entry.financials.worksheetTotal, issues);
    if (result.approvedCents === null && result.worksheetCents === null) issues.push("financial_values_unavailable");
  }
  result.issues = [...new Set(issues)];
  return result;
}

/** Calculate before the ordinary digest shortens IDs/dates and rounds currency. */
export function prospectAging(report: ScanReport, asOf: string, exclusions: string[]): AgingReport {
  if (!calendarDay(asOf)) throw new Error("--as-of must be a real YYYY-MM-DD date");
  if (exclusions.length > 10 || exclusions.some(e => !e.trim() || e.length > 100 || /[\r\n\u0000]/.test(e)))
    throw new Error("Use at most ten nonempty trade-type exclusions of at most 100 characters");
  const result: AgingReport = { schema: "acculynx-prospect-aging/v1", asOf, timeZone: AGING_TIME_ZONE,
    exclusions, status: "partial", scanned: report.scanned, serverCount: report.serverCount ?? null,
    issues: [], counts: null, rows: [] };
  const ids = new Set<string>();
  for (const { job } of report.jobs) {
    if (typeof job.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(job.id) || ids.has(job.id))
      result.issues.push("duplicate_or_missing_job_id");
    else ids.add(job.id);
  }
  if (!report.complete || report.pageError || !Number.isSafeInteger(report.serverCount)
      || report.serverCount !== report.scanned || report.scanned !== report.jobs.length)
    result.issues.push("incomplete_inventory");
  if (report.jobs.length > MAX_AGING_JOBS) result.issues.push("report_job_limit");
  if (result.issues.length) { result.issues = [...new Set(result.issues)]; return result; }
  result.rows = report.jobs.map(e => row(e, asOf, exclusions));
  const counts = { excluded: 0, eligible: 0, unknownClassification: 0, unknownAge: 0,
    buckets: Object.fromEntries(AGING_BUCKETS.map(b => [b, 0])) as Record<Bucket, number> };
  for (const r of result.rows) {
    if (r.classification === "excluded") counts.excluded++;
    else if (r.classification === "unknown") counts.unknownClassification++;
    else { counts.eligible++; if (r.bucket) counts.buckets[r.bucket]++; else counts.unknownAge++; }
  }
  result.counts = counts;
  result.status = result.rows.some(r => r.issues.length) ? "partial" : "complete";
  if (formatProspectAging(result).length > MAX_AGING_OUTPUT_CHARS) {
    result.status = "partial";
    result.issues.push("report_output_limit");
    result.rows = [];
  }
  return result;
}

export function formatProspectAging(report: AgingReport): string {
  const lines = [`PROSPECT AGING ${report.status.toUpperCase()} · age as of ${report.asOf} (${report.timeZone})`,
    "Current Prospect inventory; this is not a historical inventory snapshot.",
    `jobs ${report.scanned}/${report.serverCount ?? "?"} (server count ${report.serverCount ?? "?"})`,
    `Excluded trade types (exact names): ${report.exclusions.map(e => clean(e)).join(", ") || "none"}`];
  const c = report.counts;
  if (!c) return [...lines, `Query unavailable or incomplete: ${report.issues.join(", ")}. No aging totals or rows are asserted.`].join("\n");
  lines.push(`Eligible ${c.eligible} · excluded ${c.excluded} · unknown classification ${c.unknownClassification}`,
    ...AGING_BUCKETS.map(b => `${b} days: ${c.buckets[b]}`), `Unknown age: ${c.unknownAge}`,
    "Approved recorded values and worksheet estimates are separate; neither is collected cash.");
  if (report.issues.includes("report_output_limit")) return [...lines,
    "Detailed rows exceed the retained process-output limit; no detailed list is asserted. Escalate to the operator without repeating the scan or using inline helpers."].join("\n");
  const money = (c: number | null) => c === null ? "unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
  for (const group of [...AGING_BUCKETS, "Unknown"] as const) {
    const rows = report.rows.filter(r => r.classification !== "excluded" && (group === "Unknown" ? !r.bucket : r.bucket === group));
    if (!rows.length) continue;
    lines.push(`\n${group} (${rows.length})`);
    for (const r of rows) lines.push(`${r.id} | ${r.name} | ${r.address} | Prospect date ${r.milestoneDate ?? "unknown"} | age ${r.ageDays ?? "unknown"} | approved ${money(r.approvedCents)} | estimate ${money(r.worksheetCents)}${r.issues.length ? " | " + r.issues.join(", ") : ""}`);
  }
  lines.push(`Rows shown ${report.rows.filter(r => r.classification !== "excluded").length}; excluded rows are omitted.`);
  return lines.join("\n");
}
