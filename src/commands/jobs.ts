import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { paginate, readStdin } from "../api-helpers.js";

const DISALLOWED_EXTENSIONS = new Set([
  ".exe", ".com", ".dll", ".msi", ".bat", ".cmd", ".sh", ".pl", ".vbs", ".py", ".php",
]);

export function registerJobsCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const jobs = parentCmd.command("jobs").description("Job operations");

  jobs
    .command("list")
    .description("List jobs (paginated)")
    .option("--start-date <date>", "Start date (YYYY-MM-DD)")
    .option("--end-date <date>", "End date (YYYY-MM-DD)")
    .option("--date-filter-type <type>", "Date field to filter on")
    .option("--milestones <milestones>", "Filter by milestones")
    .option("--sort-by <field>", "Sort by: CreatedDate, MilestoneDate, ModifiedDate")
    .option("--sort-order <order>", "Ascending or Descending")
    .option("--includes <fields>", "Include: contact, initialAppointment")
    .option("--assignment <type>", "Filter by assignment: assigned, unassigned")
    .option("--limit <n>", "Max total results (default: 25)")
    .option("--all", "Fetch all results (no limit)")
    .action(async (opts) => {
      const params: Record<string, string> = {};
      if (opts.startDate) params.startDate = opts.startDate;
      if (opts.endDate) params.endDate = opts.endDate;
      if (opts.dateFilterType) params.dateFilterType = opts.dateFilterType;
      if (opts.milestones) params.milestones = opts.milestones;
      if (opts.sortBy) params.sortBy = opts.sortBy;
      if (opts.sortOrder) params.sortOrder = opts.sortOrder;
      if (opts.includes) params.includes = opts.includes;
      if (opts.assignment) params.assignment = opts.assignment;
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await paginate(getClient(), "/jobs", params, limit);
      console.log(JSON.stringify(result));
    });

  jobs
    .command("get")
    .argument("<jobId>", "Job ID")
    .description("Get job details")
    .action(async (jobId: string) => {
      const result = await getClient().get(`/jobs/${jobId}`);
      console.log(JSON.stringify(result));
    });

  jobs
    .command("create")
    .description("Create a job (pipe JSON body to stdin)")
    .action(async () => {
      const body = await readStdin();
      const result = await getClient().post("/jobs", body);
      console.log(JSON.stringify(result));
    });

  jobs
    .command("search")
    .description("Search jobs")
    .requiredOption("--query <text>", "Search term (required)")
    .action(async (opts) => {
      const result = await getClient().post("/jobs/search", {
        SearchTerm: opts.query,
      });
      console.log(JSON.stringify(result));
    });

  // Sub-resource GET commands
  const subResources = [
    { name: "contacts", path: "contacts", desc: "List job contacts" },
    { name: "estimates", path: "estimates", desc: "List job estimates" },
    { name: "financials", path: "financials", desc: "Get job financials" },
    { name: "invoices", path: "invoices", desc: "List job invoices" },
    { name: "milestones", path: "milestone-history", desc: "List job milestone history" },
    { name: "payments", path: "payments", desc: "List job payments" },
    { name: "history", path: "history", desc: "Get job history" },
  ];

  for (const sub of subResources) {
    jobs
      .command(sub.name)
      .argument("<jobId>", "Job ID")
      .description(sub.desc)
      .action(async (jobId: string) => {
        const result = await getClient().get(`/jobs/${jobId}/${sub.path}`);
        console.log(JSON.stringify(result));
      });
  }

  jobs
    .command("document-folders")
    .description("List document folders for the company")
    .option("--page-size <n>", "Number of items per page")
    .option("--record-start-index <n>", "Index of first element to return", "0")
    .option("--sort-order <order>", "Ascending or Descending", "Ascending")
    .action(async (opts) => {
      const params: Record<string, string> = {
        recordStartIndex: opts.recordStartIndex,
        sortOrder: opts.sortOrder,
      };
      if (opts.pageSize) params.pageSize = opts.pageSize;
      const result = await getClient().get(
        "/company-settings/job-file-settings/document-folders",
        params
      );
      console.log(JSON.stringify(result));
    });

  jobs
    .command("add-expense")
    .argument("<jobId>", "Job ID")
    .description("Record an additional expense on a job (pipe JSON body to stdin)")
    .action(async (jobId: string) => {
      const body = await readStdin();
      const result = await getClient().post(
        `/jobs/${jobId}/payments/expense`,
        body
      );
      console.log(JSON.stringify(result));
    });

  jobs
    .command("upload-document")
    .argument("<jobId>", "Job ID")
    .argument("<filePath>", "Path to the file to upload")
    .requiredOption("--folder-id <id>", "Document folder ID (required)")
    .option("--description <text>", "Brief description of the file")
    .option("--external-id <id>", "External reference identifier")
    .option("--external-source <source>", "External reference source")
    .description("Upload a document to a job")
    .action(async (jobId: string, filePath: string, opts) => {
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

      const result = await getClient().postForm(
        `/jobs/${jobId}/documents`,
        form
      );
      console.log(JSON.stringify(result));
    });
}
