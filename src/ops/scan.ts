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
  /** Jobs after the client-side trade filter — what the digest lists. */
  jobs: Record<string, unknown>[];
  /** Jobs fetched from the server before any client-side filter — the coverage number. */
  scanned: number;
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
export async function scanJobs(client: ApiClient, filters: ScanFilters, options: { strict?: boolean } = {}): Promise<ScanResult> {
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
  const seen = new Set<string>();

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
    if (options.strict) {
      const page = data as Page & { pageStartIndex?: unknown };
      if (page === null || typeof page !== "object") { pageError = "invalid_page"; break; }
      if (!Number.isSafeInteger(page.count) || page.count! < 0 || !Array.isArray(page.items) || page.items.length > PAGE_SIZE || page.pageStartIndex !== pageStartIndex) { pageError = "invalid_page"; break; }
      if (serverCount !== undefined && serverCount !== page.count) { pageError = "changing_inventory"; break; }
      let invalidId = false;
      for (const item of page.items) {
        const id = item !== null && typeof item === "object" ? (item as Record<string, unknown>).id : undefined;
        if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id) || seen.has(id)) { invalidId = true; break; }
        seen.add(id);
      }
      if (invalidId) { pageError = "duplicate_or_missing_job_id"; break; }
      if (fetched.length + page.items.length > page.count!) { pageError = "count_mismatch"; break; }
      if (pageStartIndex >= 50000) { pageError = "page_limit"; break; }
    }
    if (serverCount === undefined && typeof data.count === "number") serverCount = data.count;
    // A malformed page is an empty page: never spread a non-array into the results.
    const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
    fetched.push(...items);
    if (items.length < PAGE_SIZE) break;
    pageStartIndex += PAGE_SIZE;
  }

  const complete = pageError === undefined && (serverCount === undefined || fetched.length === serverCount);

  // Match the trade-type *names* only. Matching the serialized objects made
  // "--trade-type name" match every job through the `name` key itself.
  const wanted = (filters.tradeType ?? []).map((t) => t.toLowerCase());
  const jobs = wanted.length === 0 ? fetched : fetched.filter((j) => {
    const types = j.tradeTypes;
    if (!Array.isArray(types)) return false;
    return types.some((t) => {
      const name = t !== null && typeof t === "object" ? (t as Record<string, unknown>).name : undefined;
      if (typeof name !== "string") return false;
      const lower = name.toLowerCase();
      return wanted.some((w) => lower.includes(w));
    });
  });

  return { jobs, scanned: fetched.length, serverCount, complete, ...(pageError ? { pageError } : {}) };
}

export type Enricher = "financials" | "reps" | "dates" | "messages";
export const ENRICHERS: readonly Enricher[] = ["financials", "reps", "dates", "messages"];

export interface EnrichedJob {
  job: Record<string, unknown>;
  financials?: { approvedJobValue?: number; balanceDue?: number; worksheetTotal?: number };
  reps?: { company?: string; salesOwner?: string };
  dates?: Array<{ name: string; date: string }>;
  messages?: Array<{ date: string; by: string; text: string }>;
  errors: ScanError[];
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

// --- messages enricher plumbing ---------------------------------------------
// Job messages only exist on the unofficial (cookie-session) surface. The lib
// is an optional sibling install, resolved the same way src/index.ts loads
// extended commands; when it is missing or the session is dead, each job gets
// a per-job "messages" ScanError and the scan itself still completes.

export interface MessagesToolResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}
export type MessagesTool = (call: {
  name: string;
  args: Record<string, unknown>;
}) => Promise<MessagesToolResult>;
export interface EnrichDeps {
  loadMessagesTool?: () => Promise<MessagesTool>;
}

async function defaultLoadMessagesTool(): Promise<MessagesTool> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("@opsrev/acculynx-cli-unofficial");
  const mod = (await import(resolved)) as { handleExtendedToolCall: MessagesTool };
  return mod.handleExtendedToolCall;
}

export async function enrichJobs(
  client: ApiClient,
  jobs: Record<string, unknown>[],
  enrich: Enricher[],
  concurrency = 5,
  deps: EnrichDeps = {}
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

  // Lazy, memoized: the unofficial lib loads once per scan, and a failed load
  // stays failed (each job records the error; no retry storm).
  let messagesToolPromise: Promise<MessagesTool> | null = null;
  const getMessagesTool = (): Promise<MessagesTool> =>
    (messagesToolPromise ??= (deps.loadMessagesTool ?? defaultLoadMessagesTool)());

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
          if (!Array.isArray(m.items) || m.items.some(i => i === null || typeof i !== "object")) throw new Error("invalid_milestone_history");
          entry.dates = (m.items as Array<Record<string, unknown>>).map((i) => ({
            name: String(i.name ?? ""), date: String(i.date ?? ""),
          }));
        } else if (source === "messages") {
          const tool = await getMessagesTool();
          const res = await tool({ name: "acculynx_jobs_messages", args: { jobId } });
          const text = String(res.content?.[0]?.text ?? "");
          if (res.isError) throw new Error(text.slice(0, 200) || "messages tool error");
          const data = asRecord(JSON.parse(text || "{}"));
          entry.messages = ((data.messages as Array<Record<string, unknown>> | undefined) ?? [])
            .slice(0, 3)
            .map((msg) => ({
              date: String(msg.createdDate ?? ""),
              by: String(msg.createdBy ?? ""),
              text: String(msg.message ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
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
