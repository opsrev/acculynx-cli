import type { ApiClient } from "../api-client.js";

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
