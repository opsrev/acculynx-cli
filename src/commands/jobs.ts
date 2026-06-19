import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { readStdin } from "../api-helpers.js";
import {
  jobsList,
  jobGet,
  jobCreate,
  jobSearch,
  jobContacts,
  jobEstimates,
  jobFinancials,
  jobInvoices,
  jobMilestones,
  jobPayments,
  jobHistory,
  jobReps,
  jobRepsAssign,
  documentFolders,
  jobAddExpense,
  jobUploadDocument,
} from "../ops/jobs.js";

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
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await jobsList(getClient(), {
        startDate: opts.startDate,
        endDate: opts.endDate,
        dateFilterType: opts.dateFilterType,
        milestones: opts.milestones,
        sortBy: opts.sortBy,
        sortOrder: opts.sortOrder,
        includes: opts.includes,
        assignment: opts.assignment,
        limit,
      });
      console.log(JSON.stringify(result));
    });

  jobs
    .command("get")
    .argument("<jobId>", "Job ID")
    .description("Get job details")
    .action(async (jobId: string) => {
      console.log(JSON.stringify(await jobGet(getClient(), jobId)));
    });

  jobs
    .command("create")
    .description("Create a job (pipe JSON body to stdin)")
    .action(async () => {
      const body = await readStdin();
      console.log(JSON.stringify(await jobCreate(getClient(), body)));
    });

  jobs
    .command("search")
    .description("Search jobs")
    .requiredOption("--query <text>", "Search term (required)")
    .action(async (opts) => {
      console.log(JSON.stringify(await jobSearch(getClient(), opts.query)));
    });

  const subResources: Array<{ name: string; fn: (c: ApiClient, id: string) => Promise<unknown>; desc: string }> = [
    { name: "contacts", fn: jobContacts, desc: "List job contacts" },
    { name: "estimates", fn: jobEstimates, desc: "List job estimates" },
    { name: "financials", fn: jobFinancials, desc: "Get job financials" },
    { name: "invoices", fn: jobInvoices, desc: "List job invoices" },
    { name: "milestones", fn: jobMilestones, desc: "List job milestone history" },
    { name: "payments", fn: jobPayments, desc: "List job payments" },
    { name: "history", fn: jobHistory, desc: "Get job history" },
  ];

  for (const sub of subResources) {
    jobs
      .command(sub.name)
      .argument("<jobId>", "Job ID")
      .description(sub.desc)
      .action(async (jobId: string) => {
        console.log(JSON.stringify(await sub.fn(getClient(), jobId)));
      });
  }

  jobs
    .command("reps")
    .argument("<jobId>", "Job ID")
    .description("List all representatives for a job")
    .action(async (jobId: string) => {
      console.log(JSON.stringify(await jobReps(getClient(), jobId)));
    });

  jobs
    .command("reps-assign")
    .argument("<jobId>", "Job ID")
    .description("Assign a representative to a job")
    .requiredOption("--user-id <id>", "User ID to assign")
    .option("--type <type>", "Rep type: company, sales-owner, ar-owner", "company")
    .action(async (jobId: string, opts) => {
      const result = await jobRepsAssign(getClient(), jobId, { userId: opts.userId, type: opts.type });
      console.log(JSON.stringify(result));
    });

  jobs
    .command("document-folders")
    .description("List document folders for the company")
    .option("--page-size <n>", "Number of items per page")
    .option("--record-start-index <n>", "Index of first element to return", "0")
    .option("--sort-order <order>", "Ascending or Descending", "Ascending")
    .action(async (opts) => {
      const result = await documentFolders(getClient(), {
        pageSize: opts.pageSize,
        recordStartIndex: opts.recordStartIndex,
        sortOrder: opts.sortOrder,
      });
      console.log(JSON.stringify(result));
    });

  jobs
    .command("add-expense")
    .argument("<jobId>", "Job ID")
    .description("Record an additional expense on a job (pipe JSON body to stdin)")
    .action(async (jobId: string) => {
      const body = await readStdin();
      console.log(JSON.stringify(await jobAddExpense(getClient(), jobId, body)));
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
      const result = await jobUploadDocument(getClient(), jobId, filePath, {
        folderId: opts.folderId,
        description: opts.description,
        externalId: opts.externalId,
        externalSource: opts.externalSource,
      });
      console.log(JSON.stringify(result));
    });
}
