import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { paginate, readStdin } from "../api-helpers.js";

export function registerJobsCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const jobs = parentCmd.command("jobs").description("Job operations");

  jobs
    .command("list")
    .description("List jobs (paginated)")
    .option("--page-size <n>", "Items per page")
    .option("--start-index <n>", "Starting index")
    .option("--start-date <date>", "Start date (YYYY-MM-DD)")
    .option("--end-date <date>", "End date (YYYY-MM-DD)")
    .option("--date-filter-type <type>", "Date field to filter on")
    .option("--milestones <milestones>", "Filter by milestones")
    .option("--sort-by <field>", "Sort by: CreatedDate, MilestoneDate, ModifiedDate")
    .option("--sort-order <order>", "Ascending or Descending")
    .option("--includes <fields>", "Include: contact, initialAppointment")
    .option("--limit <n>", "Max total results")
    .action(async (opts) => {
      const params: Record<string, string> = {};
      if (opts.startDate) params.startDate = opts.startDate;
      if (opts.endDate) params.endDate = opts.endDate;
      if (opts.dateFilterType) params.dateFilterType = opts.dateFilterType;
      if (opts.milestones) params.milestones = opts.milestones;
      if (opts.sortBy) params.sortBy = opts.sortBy;
      if (opts.sortOrder) params.sortOrder = opts.sortOrder;
      if (opts.includes) params.includes = opts.includes;
      const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
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
    .description("Search jobs (pipe JSON search criteria to stdin)")
    .action(async () => {
      const body = await readStdin();
      const result = await getClient().post("/jobs/search", body);
      console.log(JSON.stringify(result));
    });

  // Sub-resource GET commands
  const subResources = [
    { name: "contacts", path: "contacts", desc: "List job contacts" },
    { name: "estimates", path: "estimates", desc: "List job estimates" },
    { name: "financials", path: "financials", desc: "Get job financials" },
    { name: "invoices", path: "invoices", desc: "List job invoices" },
    { name: "milestones", path: "milestones", desc: "List job milestones" },
    { name: "current-milestone", path: "current-milestone", desc: "Get current milestone" },
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
}
