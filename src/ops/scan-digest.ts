import type { Enricher, EnrichedJob, ScanFilters } from "./scan.js";

export interface ScanReport {
  filters: ScanFilters;
  enrich: Enricher[];
  jobs: EnrichedJob[];
  serverCount?: number;
  complete: boolean;
  pageError?: string;
}

/** "$" + rounded, comma-grouped value; missing numbers render as "-". */
function money(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "-";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** MM-DD (UTC) of an ISO date string; "-" when missing or unparseable. */
function mmdd(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/** First primary contact's "firstName lastName", else the job's jobName. */
function customerName(job: Record<string, unknown>): string {
  const contacts = (job.contacts as Array<Record<string, unknown>> | undefined) ?? [];
  const primary = contacts.find((c) => c.isPrimary === true);
  if (primary) {
    const contact = (primary.contact as Record<string, unknown> | undefined) ?? {};
    const full = `${String(contact.firstName ?? "").trim()} ${String(contact.lastName ?? "").trim()}`.trim();
    if (full) return full;
  }
  return String(job.jobName ?? "");
}

function headerLine1(report: ScanReport): string {
  const prefix = report.complete ? "SCAN" : "SCAN PARTIAL";
  const f = report.filters;
  const parts: string[] = [];
  if (f.milestones) parts.push(`milestones=${f.milestones}`);
  if (f.startDate) parts.push(`since=${f.startDate}`);
  if (f.endDate) parts.push(`until=${f.endDate}`);
  if (f.dateFilterType) parts.push(`dateField=${f.dateFilterType}`);
  if (f.assignment) parts.push(`assignment=${f.assignment}`);
  if (f.tradeType && f.tradeType.length > 0) parts.push(`trade=${f.tradeType.join(",")}`);
  if (report.enrich.length > 0) parts.push(`enrich=${report.enrich.join(",")}`);
  return parts.length > 0 ? `${prefix} ${parts.join(" ")}` : prefix;
}

function headerLine2(report: ScanReport): string {
  const fetched = report.jobs.length;
  const totalLabel = report.serverCount !== undefined ? String(report.serverCount) : "?";
  let line = `jobs ${fetched}/${totalLabel}`;
  if (report.serverCount !== undefined) line += ` (server count ${report.serverCount})`;
  if (report.enrich.length > 0) {
    const enrichedCount = report.jobs.filter((j) => j.errors.length === 0).length;
    const errorCount = report.jobs.reduce((sum, j) => sum + j.errors.length, 0);
    line += ` · enriched ${enrichedCount} · errors ${errorCount}`;
  }
  if (!report.complete) {
    const note = report.pageError ?? `fetched ${fetched} of ${totalLabel}`;
    line += ` · PARTIAL: ${note}`;
  }
  return line;
}

function jobLine(entry: EnrichedJob, enrich: Enricher[]): string {
  const job = entry.job;
  const id8 = String(job.id ?? "").slice(0, 8);
  const name = customerName(job);
  const addr = (job.locationAddress as Record<string, unknown> | undefined) ?? {};
  const street = String(addr.street1 ?? "-");
  const city = String(addr.city ?? "-");
  const milestone = String(job.currentMilestone ?? "-");
  const date = mmdd(job.milestoneDate as string | undefined);

  let line = `${id8} | ${name} — ${street}, ${city} | ${milestone} ${date}`;

  const erroredSources = new Set(entry.errors.map((e) => e.source));

  for (const source of ["reps", "financials", "dates"] as Enricher[]) {
    if (!enrich.includes(source)) continue;
    if (erroredSources.has(source)) {
      line += ` | ERR:${source}`;
      continue;
    }
    if (source === "reps") {
      const rep = entry.reps?.salesOwner ?? entry.reps?.company ?? "-";
      line += ` | rep ${rep}`;
    } else if (source === "financials") {
      const f = entry.financials;
      line += ` | wk ${money(f?.worksheetTotal)} | appr ${money(f?.approvedJobValue)} | bal ${money(f?.balanceDue)}`;
    } else if (source === "dates") {
      const approved = entry.dates?.find((d) => d.name === "Approved");
      if (approved) line += ` | appr’d ${mmdd(approved.date)}`;
    }
  }

  return line;
}

export function formatScanDigest(report: ScanReport): string {
  const lines: string[] = [headerLine1(report), headerLine2(report)];
  for (const entry of report.jobs) lines.push(jobLine(entry, report.enrich));

  const allErrors = report.jobs.flatMap((j) => j.errors);
  if (allErrors.length > 0) {
    lines.push("errors:");
    for (const e of allErrors) lines.push(`  ${e.jobId.slice(0, 8)} ${e.source}: ${e.message}`);
  }

  return lines.join("\n");
}

export function formatScanJsonl(report: ScanReport): string {
  return report.jobs.map((j) => JSON.stringify(j)).join("\n");
}
