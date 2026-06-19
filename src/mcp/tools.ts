import { getConfig } from "../config.js";
import { createApiClient, type ApiClient } from "../api-client.js";
import { ping } from "../ops/ping.js";
import {
  jobsList, jobGet, jobCreate, jobSearch,
  jobContacts, jobEstimates, jobFinancials, jobInvoices,
  jobMilestones, jobPayments, jobHistory, jobReps,
  jobRepsAssign, documentFolders, jobAddExpense, jobUploadDocument,
} from "../ops/jobs.js";
import {
  contactsList, contactGet, contactCreate, contactsSearch,
  contactEmails, contactPhones, contactPhoneAdd,
} from "../ops/contacts.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

// ---- shared schema property constants ----
export const LIMIT = { type: "number", description: "Max total results (default 25). Omit and set all=true to fetch everything." };
export const ALL = { type: "boolean", description: "Fetch all results (ignores limit)." };
export const DATE = { type: "string", description: "Date in YYYY-MM-DD format.", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
export const BODY = { type: "object", description: "The full JSON request body for this resource.", additionalProperties: true };

const SORT_ORDER = { type: "string", enum: ["Ascending", "Descending"], description: "Sort direction." };

// ---- result + coercion helpers ----
export function ok(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}
export function fail(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: true };
}

export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};
export const boolOf = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

// resolve the CLI-equivalent { all, limit } semantics into a single limit value
export const resolveLimit = (args: Record<string, unknown>): number | undefined =>
  boolOf(args.all) ? Infinity : num(args.limit);

// re-exported for tool/dispatch modules built in later tasks
export { SORT_ORDER };

function defaultClient(): ApiClient {
  return createApiClient(getConfig({}));
}

export function buildTools(): McpTool[] {
  return [
    { name: "acculynx_ping", description: "Health check — verify the API key and connectivity.", inputSchema: { type: "object", properties: {}, required: [] } },

    { name: "acculynx_jobs_list", description: "List jobs (paginated). All filters optional.", inputSchema: { type: "object", properties: {
      startDate: DATE, endDate: DATE,
      dateFilterType: { type: "string", description: "Date field to filter on." },
      milestones: { type: "string", description: "Filter by milestones." },
      sortBy: { type: "string", enum: ["CreatedDate", "MilestoneDate", "ModifiedDate"], description: "Sort field (default CreatedDate)." },
      sortOrder: SORT_ORDER,
      includes: { type: "string", enum: ["contact", "initialAppointment"], description: "Related data to include." },
      assignment: { type: "string", enum: ["assigned", "unassigned"], description: "Filter by assignment status." },
      limit: LIMIT, all: ALL,
    }, required: [] } },

    { name: "acculynx_jobs_get", description: "Get one job by id.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_create", description: "Create a job from a JSON body.", inputSchema: { type: "object", properties: { body: BODY }, required: ["body"] } },
    { name: "acculynx_jobs_search", description: "Search jobs by a free-text term.", inputSchema: { type: "object", properties: { query: { type: "string", description: "Search term." } }, required: ["query"] } },
    { name: "acculynx_jobs_contacts", description: "List a job's contacts.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_estimates", description: "List a job's estimates.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_financials", description: "Get a job's financials.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_invoices", description: "List a job's invoices.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_milestones", description: "List a job's milestone history.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_payments", description: "List a job's payments.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_history", description: "Get a job's history.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },
    { name: "acculynx_jobs_reps", description: "List a job's representatives.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." } }, required: ["jobId"] } },

    { name: "acculynx_jobs_reps_assign", description: "Assign a representative to a job.", inputSchema: { type: "object", properties: {
      jobId: { type: "string", description: "Job id." },
      userId: { type: "string", description: "User id to assign." },
      type: { type: "string", enum: ["company", "sales-owner", "ar-owner"], description: "Rep type (default company)." },
    }, required: ["jobId", "userId"] } },

    { name: "acculynx_jobs_document_folders", description: "List the company's document folders.", inputSchema: { type: "object", properties: {
      pageSize: { type: "number", description: "Items per page." },
      recordStartIndex: { type: "number", description: "0-based start index (default 0)." },
      sortOrder: SORT_ORDER,
    }, required: [] } },

    { name: "acculynx_jobs_add_expense", description: "Record an additional expense on a job from a JSON body.", inputSchema: { type: "object", properties: { jobId: { type: "string", description: "Job id." }, body: BODY }, required: ["jobId", "body"] } },

    { name: "acculynx_jobs_upload_document", description: "Upload a local file to a job. Blocked extensions: .exe .com .dll .msi .bat .cmd .sh .pl .vbs .py .php.", inputSchema: { type: "object", properties: {
      jobId: { type: "string", description: "Job id." },
      filePath: { type: "string", description: "Absolute path to a local file the server can read." },
      folderId: { type: "string", description: "Destination document folder id (from acculynx_jobs_document_folders)." },
      description: { type: "string", description: "Brief file description." },
      externalId: { type: "string", description: "External reference id." },
      externalSource: { type: "string", description: "External reference source." },
    }, required: ["jobId", "filePath", "folderId"] } },
    { name: "acculynx_contacts_list", description: "List contacts (paginated).", inputSchema: { type: "object", properties: { limit: LIMIT, all: ALL }, required: [] } },
    { name: "acculynx_contacts_get", description: "Get one contact by id.", inputSchema: { type: "object", properties: { contactId: { type: "string", description: "Contact id." } }, required: ["contactId"] } },
    { name: "acculynx_contacts_create", description: "Create a contact from a JSON body.", inputSchema: { type: "object", properties: { body: BODY }, required: ["body"] } },
    { name: "acculynx_contacts_search", description: "Search contacts within a date range.", inputSchema: { type: "object", properties: {
      query: { type: "string", description: "Search term." },
      startDate: DATE, endDate: DATE,
      sortBy: { type: "string", enum: ["CreatedDate", "firstName", "lastName"], description: "Sort field (default lastName)." },
      sortOrder: SORT_ORDER,
    }, required: ["query", "startDate", "endDate"] } },
    { name: "acculynx_contacts_emails", description: "List a contact's email addresses.", inputSchema: { type: "object", properties: { contactId: { type: "string", description: "Contact id." } }, required: ["contactId"] } },
    { name: "acculynx_contacts_phones", description: "List a contact's phone numbers.", inputSchema: { type: "object", properties: { contactId: { type: "string", description: "Contact id." } }, required: ["contactId"] } },
    { name: "acculynx_contacts_phone_add", description: "Add a phone number to a contact. Omit smsOptOut to opt in to SMS.", inputSchema: { type: "object", properties: {
      contactId: { type: "string", description: "Contact id." },
      type: { type: "string", enum: ["Mobile", "Home", "Work"], description: "Phone type." },
      number: { type: "string", description: "Phone number." },
      smsOptOut: { type: "boolean", description: "Opt this number OUT of SMS (default false = opted in)." },
    }, required: ["contactId", "type", "number"] } },
    // populated by Task 4
  ];
}

export async function handleToolCall(
  call: { name: string; args: Record<string, unknown> | undefined },
  makeClient: () => ApiClient = defaultClient
): Promise<ToolResult> {
  const args = call.args ?? {};
  try {
    const client = makeClient();
    switch (call.name) {
      case "acculynx_ping":
        return ok(await ping(client));
      case "acculynx_jobs_list":
        return ok(await jobsList(client, {
          startDate: str(args.startDate), endDate: str(args.endDate),
          dateFilterType: str(args.dateFilterType), milestones: str(args.milestones),
          sortBy: str(args.sortBy), sortOrder: str(args.sortOrder),
          includes: str(args.includes), assignment: str(args.assignment),
          limit: resolveLimit(args),
        }));
      case "acculynx_jobs_get":
        return ok(await jobGet(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_create":
        return ok(await jobCreate(client, args.body));
      case "acculynx_jobs_search":
        return ok(await jobSearch(client, str(args.query) ?? ""));
      case "acculynx_jobs_contacts":
        return ok(await jobContacts(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_estimates":
        return ok(await jobEstimates(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_financials":
        return ok(await jobFinancials(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_invoices":
        return ok(await jobInvoices(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_milestones":
        return ok(await jobMilestones(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_payments":
        return ok(await jobPayments(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_history":
        return ok(await jobHistory(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_reps":
        return ok(await jobReps(client, str(args.jobId) ?? ""));
      case "acculynx_jobs_reps_assign":
        return ok(await jobRepsAssign(client, str(args.jobId) ?? "", { userId: str(args.userId) ?? "", type: str(args.type) }));
      case "acculynx_jobs_document_folders":
        return ok(await documentFolders(client, {
          pageSize: args.pageSize !== undefined ? String(num(args.pageSize)) : undefined,
          recordStartIndex: args.recordStartIndex !== undefined ? String(num(args.recordStartIndex)) : undefined,
          sortOrder: str(args.sortOrder),
        }));
      case "acculynx_jobs_add_expense":
        return ok(await jobAddExpense(client, str(args.jobId) ?? "", args.body));
      case "acculynx_jobs_upload_document":
        return ok(await jobUploadDocument(client, str(args.jobId) ?? "", str(args.filePath) ?? "", {
          folderId: str(args.folderId) ?? "", description: str(args.description),
          externalId: str(args.externalId), externalSource: str(args.externalSource),
        }));
      case "acculynx_contacts_list":
        return ok(await contactsList(client, resolveLimit(args)));
      case "acculynx_contacts_get":
        return ok(await contactGet(client, str(args.contactId) ?? ""));
      case "acculynx_contacts_create":
        return ok(await contactCreate(client, args.body));
      case "acculynx_contacts_search":
        return ok(await contactsSearch(client, {
          query: str(args.query) ?? "", startDate: str(args.startDate) ?? "", endDate: str(args.endDate) ?? "",
          sortBy: str(args.sortBy), sortOrder: str(args.sortOrder),
        }));
      case "acculynx_contacts_emails":
        return ok(await contactEmails(client, str(args.contactId) ?? ""));
      case "acculynx_contacts_phones":
        return ok(await contactPhones(client, str(args.contactId) ?? ""));
      case "acculynx_contacts_phone_add":
        return ok(await contactPhoneAdd(client, str(args.contactId) ?? "", {
          type: str(args.type) ?? "", number: str(args.number) ?? "", smsOptOut: boolOf(args.smsOptOut),
        }));
      // cases added by Task 4
      default:
        return fail({ error: "unknown_tool", message: `Unknown tool: ${call.name}` });
    }
  } catch (e) {
    return fail({ error: "acculynx_error", message: e instanceof Error ? e.message : String(e) });
  }
}
