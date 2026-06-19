import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

export const DISALLOWED_EXTENSIONS = new Set([
  ".exe", ".com", ".dll", ".msi", ".bat", ".cmd", ".sh", ".pl", ".vbs", ".py", ".php",
]);

export interface JobsListOpts {
  startDate?: string;
  endDate?: string;
  dateFilterType?: string;
  milestones?: string;
  sortBy?: string;
  sortOrder?: string;
  includes?: string;
  assignment?: string;
  limit?: number;
}

export function jobsList(client: ApiClient, opts: JobsListOpts = {}): Promise<unknown[]> {
  const params: Record<string, string> = {};
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;
  if (opts.dateFilterType) params.dateFilterType = opts.dateFilterType;
  if (opts.milestones) params.milestones = opts.milestones;
  params.sortBy = opts.sortBy ?? "CreatedDate";
  if (opts.sortOrder) params.sortOrder = opts.sortOrder;
  if (opts.includes) params.includes = opts.includes;
  if (opts.assignment) params.assignment = opts.assignment;
  return paginate(client, "/jobs", params, opts.limit);
}

export function jobGet(client: ApiClient, jobId: string): Promise<unknown> {
  return client.get(`/jobs/${jobId}`);
}

export function jobCreate(client: ApiClient, body: unknown): Promise<unknown> {
  return client.post("/jobs", body);
}

export function jobSearch(client: ApiClient, query: string): Promise<unknown> {
  return client.post("/jobs/search", { SearchTerm: query });
}

export const jobContacts = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/contacts`);
export const jobEstimates = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/estimates`);
export const jobFinancials = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/financials`);
export const jobInvoices = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/invoices`);
export const jobMilestones = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/milestone-history`);
export const jobPayments = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/payments`);
export const jobHistory = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/history`);
export const jobReps = (client: ApiClient, jobId: string): Promise<unknown> =>
  client.get(`/jobs/${jobId}/representatives`);

export function jobRepsAssign(
  client: ApiClient,
  jobId: string,
  opts: { userId: string; type?: string }
): Promise<unknown> {
  const type = opts.type ?? "company";
  return client.post(`/jobs/${jobId}/representatives/${type}`, { id: opts.userId });
}

export interface DocumentFoldersOpts {
  pageSize?: string;
  recordStartIndex?: string;
  sortOrder?: string;
}

export function documentFolders(
  client: ApiClient,
  opts: DocumentFoldersOpts = {}
): Promise<unknown> {
  const params: Record<string, string> = {
    recordStartIndex: opts.recordStartIndex ?? "0",
    sortOrder: opts.sortOrder ?? "Ascending",
  };
  if (opts.pageSize) params.pageSize = opts.pageSize;
  return client.get("/company-settings/job-file-settings/document-folders", params);
}

export function jobAddExpense(
  client: ApiClient,
  jobId: string,
  body: unknown
): Promise<unknown> {
  return client.post(`/jobs/${jobId}/payments/expense`, body);
}

export interface UploadDocumentOpts {
  folderId: string;
  description?: string;
  externalId?: string;
  externalSource?: string;
}

export function jobUploadDocument(
  client: ApiClient,
  jobId: string,
  filePath: string,
  opts: UploadDocumentOpts
): Promise<unknown> {
  const ext = extname(filePath).toLowerCase();
  if (DISALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ${ext} is not allowed`);
  }
  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);
  const file = new File([fileBuffer], fileName);

  const form = new FormData();
  form.append("file", file);
  form.append("documentFolderId", opts.folderId);
  if (opts.description) form.append("description", opts.description);
  if (opts.externalId) form.append("externalId", opts.externalId);
  if (opts.externalSource) form.append("externalSource", opts.externalSource);

  return client.postForm(`/jobs/${jobId}/documents`, form);
}
