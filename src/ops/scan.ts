import type { ApiClient } from "../api-client.js";
import { jobFinancials, jobMilestones, jobReps } from "./jobs.js";
import { paginate } from "../api-helpers.js";

const PAGE_SIZE = 25;

export interface ScanFilters {
  startDate?: string;
  endDate?: string;
  dateFilterType?: string;
  milestones?: string;
  assignment?: string;
  tradeType?: string[];
}

export interface ScanError { jobId: string; source: string; message: string }

export interface ScanResult {
  jobs: Record<string, unknown>[];
  serverCount?: number;
  complete: boolean;
  pageError?: string;
}

interface Page { count?: number; items?: unknown[] }

/**
 * Enumerate every job matching the filters, keeping the server's total so the
 * digest can prove coverage. paginate() in api-helpers throws that count away,
 * which is exactly the number a scan exists to report — hence the local pager.
 */
export async function scanJobs(client: ApiClient, filters: ScanFilters): Promise<ScanResult> {
  const params: Record<string, string> = { includes: "contact", sortBy: "CreatedDate" };
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.dateFilterType) params.dateFilterType = filters.dateFilterType;
  if (filters.milestones) params.milestones = filters.milestones;
  if (filters.assignment) params.assignment = filters.assignment;

  const fetched: Record<string, unknown>[] = [];
  let serverCount: number | undefined;
  let pageError: string | undefined;
  let pageStartIndex = 0;

  while (true) {
    let data: Page;
    try {
      data = (await client.get("/jobs", {
        ...params, pageSize: String(PAGE_SIZE), pageStartIndex: String(pageStartIndex),
      })) as Page;
    } catch (error) {
      pageError = error instanceof Error ? error.message : String(error);
      break;
    }
    if (serverCount === undefined && typeof data.count === "number") serverCount = data.count;
    const items = (data.items ?? []) as Record<string, unknown>[];
    fetched.push(...items);
    if (items.length < PAGE_SIZE) break;
    pageStartIndex += PAGE_SIZE;
  }

  const complete = pageError === undefined && (serverCount === undefined || fetched.length === serverCount);

  const wanted = (filters.tradeType ?? []).map((t) => t.toLowerCase());
  const jobs = wanted.length === 0 ? fetched : fetched.filter((j) => {
    const haystack = JSON.stringify(j.tradeTypes ?? []).toLowerCase();
    return wanted.some((t) => haystack.includes(t));
  });

  return { jobs, serverCount, complete, ...(pageError ? { pageError } : {}) };
}

export type Enricher = "financials" | "reps" | "dates";
export const ENRICHERS: readonly Enricher[] = ["financials", "reps", "dates"];

export interface EnrichedJob {
  job: Record<string, unknown>;
  financials?: { approvedJobValue?: number; balanceDue?: number; worksheetTotal?: number };
  reps?: { company?: string; salesOwner?: string };
  dates?: Array<{ name: string; date: string }>;
  errors: ScanError[];
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

export async function enrichJobs(
  client: ApiClient,
  jobs: Record<string, unknown>[],
  enrich: Enricher[],
  concurrency = 5
): Promise<EnrichedJob[]> {
  // One /users fetch names every rep in the scan; reps responses carry only ids.
  let userNames = new Map<string, string>();
  if (enrich.includes("reps")) {
    try {
      const users = (await paginate(client, "/users", {}, Infinity)) as Array<Record<string, unknown>>;
      userNames = new Map(users.map((u) => [String(u.id), String(u.displayName ?? "")]));
    } catch {
      // Names degrade to short ids; per-job reps calls still run.
    }
  }
  const nameOf = (id: unknown): string => userNames.get(String(id)) || String(id ?? "").slice(0, 8);

  const out: EnrichedJob[] = jobs.map((job) => ({ job, errors: [] }));
  let next = 0;

  async function enrichOne(entry: EnrichedJob): Promise<void> {
    const jobId = String(entry.job.id ?? "");
    for (const source of enrich) {
      try {
        if (source === "financials") {
          const f = asRecord(await jobFinancials(client, jobId));
          const totals = asRecord(f.worksheetSectionTotals);
          entry.financials = {
            approvedJobValue: f.approvedJobValue as number | undefined,
            balanceDue: f.balanceDue as number | undefined,
            worksheetTotal: totals.worksheetTotal as number | undefined,
          };
        } else if (source === "reps") {
          const r = asRecord(await jobReps(client, jobId));
          const reps: { company?: string; salesOwner?: string } = {};
          for (const item of (r.items as Array<Record<string, unknown>> | undefined) ?? []) {
            const userId = asRecord(item.user).id;
            if (item.type === "SalesOwner") reps.salesOwner = nameOf(userId);
            else if (item.type === "CompanyRepresentative") reps.company = nameOf(userId);
          }
          entry.reps = reps;
        } else if (source === "dates") {
          const m = asRecord(await jobMilestones(client, jobId));
          entry.dates = ((m.items as Array<Record<string, unknown>> | undefined) ?? []).map((i) => ({
            name: String(i.name ?? ""), date: String(i.date ?? ""),
          }));
        }
      } catch (error) {
        entry.errors.push({ jobId, source, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  async function worker(): Promise<void> {
    while (next < out.length) await enrichOne(out[next++]);
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return out;
}
