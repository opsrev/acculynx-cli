import { writeFileSync } from "node:fs";
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
  jobSetWorkType,
  jobSetTradeTypes,
  companyWorkTypes,
  companyTradeTypes,
  resolveWorkTypeId,
  resolveTradeTypeIds,
  documentFolders,
  jobAddExpense,
  jobUploadDocument,
} from "../ops/jobs.js";
import { scanJobs, enrichJobs, ENRICHERS, type Enricher, type ScanFilters } from "../ops/scan.js";
import { formatScanDigest, formatScanJsonl } from "../ops/scan-digest.js";

// Commander option collector: accumulate repeated flags into an array.
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

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
    .command("scan")
    .description("Fetch ALL matching jobs and print a digest with a coverage receipt")
    .option("--start-date <date>", "Start date (YYYY-MM-DD)")
    .option("--end-date <date>", "End date (YYYY-MM-DD)")
    .option("--date-filter-type <type>", "Date field to filter on")
    .option("--milestones <milestones>", "Filter by milestones (comma-separated)")
    .option("--assignment <type>", "Filter by assignment: assigned, unassigned")
    .option("--trade-type <name>", "Client-side trade-type filter (repeatable)", collect, [])
    .option("--enrich <list>", "Comma-separated: financials,reps,dates,messages")
    .option("--format <fmt>", "digest or jsonl", "digest")
    .option("--out <path>", "Also write full jsonl to this file")
    .action(async (opts) => {
      const enrich = String(opts.enrich ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) as Enricher[];
      const badEnricher = enrich.find((e) => !ENRICHERS.includes(e));
      if (badEnricher) {
        console.error(`Unknown enricher "${badEnricher}" (valid: ${ENRICHERS.join(", ")})`);
        process.exitCode = 2;
        return;
      }
      if (opts.format !== "digest" && opts.format !== "jsonl") {
        console.error("Unknown --format (valid: digest, jsonl)");
        process.exitCode = 2;
        return;
      }

      const filters: ScanFilters = {
        startDate: opts.startDate,
        endDate: opts.endDate,
        dateFilterType: opts.dateFilterType,
        milestones: opts.milestones,
        assignment: opts.assignment,
        tradeType: opts.tradeType.length ? opts.tradeType : undefined,
      };
      const result = await scanJobs(getClient(), filters);
      const enrichedJobs = await enrichJobs(getClient(), result.jobs, enrich);
      const report = { filters, enrich, jobs: enrichedJobs, scanned: result.scanned, serverCount: result.serverCount, complete: result.complete, ...(result.pageError ? { pageError: result.pageError } : {}) };
      // Print before writing: a bad --out path must never swallow a paid-for scan.
      console.log(opts.format === "jsonl" ? formatScanJsonl(report) : formatScanDigest(report));
      if (!result.complete) process.exitCode = 3;
      if (opts.out) {
        try {
          writeFileSync(opts.out, formatScanJsonl(report) + "\n");
        } catch (error) {
          // Reported, but not as an exit code: a failed file write is not partial coverage.
          console.error(`out: FAILED - ${error instanceof Error ? error.message : String(error)}`);
        }
      }
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
    .command("work-types")
    .description("List the company's active work types (id + name)")
    .action(async () => {
      console.log(JSON.stringify(await companyWorkTypes(getClient())));
    });

  jobs
    .command("trade-types")
    .description("List the company's active trade types (id + name)")
    .action(async () => {
      console.log(JSON.stringify(await companyTradeTypes(getClient())));
    });

  jobs
    .command("set-work-type")
    .argument("<jobId>", "Job ID")
    .description("Set the work type for a job (by name or id)")
    .option("--work-type <name>", "Work type name (resolved against the company's work types)")
    .option("--work-type-id <id>", "Work type ID (integer)")
    .action(async (jobId: string, opts) => {
      const nameGiven = opts.workType !== undefined;
      const idGiven = opts.workTypeId !== undefined;
      if (nameGiven && idGiven) {
        throw new Error("Use either --work-type or --work-type-id, not both");
      }
      if (!nameGiven && !idGiven) {
        throw new Error("Provide --work-type <name> or --work-type-id <id>");
      }
      const client = getClient();
      let workTypeId: number;
      if (idGiven) {
        workTypeId = Number(opts.workTypeId);
        if (!Number.isInteger(workTypeId)) {
          throw new Error("--work-type-id must be an integer");
        }
      } else {
        workTypeId = await resolveWorkTypeId(client, opts.workType);
      }
      const result = await jobSetWorkType(client, jobId, workTypeId);
      console.log(JSON.stringify(result));
    });

  jobs
    .command("set-trade-types")
    .argument("<jobId>", "Job ID")
    .description(
      "Set trade types for a job (by name or id), replacing existing ones. Use --clear to unassign all."
    )
    .option("--trade-type <name>", "Trade type name, resolved against the company's trade types (repeatable)", collect, [])
    .option("--trade-type-id <uuid>", "Trade type ID (repeatable)", collect, [])
    .option("--clear", "Unassign all trade types")
    .action(async (jobId: string, opts) => {
      const names = opts.tradeType as string[];
      const ids = opts.tradeTypeId as string[];
      const sources = [names.length > 0, ids.length > 0, Boolean(opts.clear)].filter(Boolean).length;
      if (opts.clear && (names.length > 0 || ids.length > 0)) {
        throw new Error("Cannot combine --clear with --trade-type or --trade-type-id");
      }
      if (names.length > 0 && ids.length > 0) {
        throw new Error("Use either --trade-type or --trade-type-id, not both");
      }
      if (sources === 0) {
        throw new Error(
          "Provide --trade-type <name>, --trade-type-id <uuid>, or --clear to unassign all trade types"
        );
      }
      const client = getClient();
      const resolved = names.length > 0 ? await resolveTradeTypeIds(client, names) : ids;
      const result = await jobSetTradeTypes(client, jobId, resolved);
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
