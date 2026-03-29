import type { Command } from "commander";
import type { UnofficialClient } from "../unofficial-client.js";

interface WorkflowStatus {
  StatusId: string;
  Name: string;
}

interface WorkflowMilestone {
  MilestoneId: number;
  Name: string;
  Statuses: WorkflowStatus[];
}

interface WorkflowResponse {
  Id: string;
  Name: string;
  Milestones: WorkflowMilestone[];
}

interface JobListResult {
  Id: string;
  Name: string;
  FullAddress: string;
  CityState: string;
  CurrentMilestone: string;
  CurrentStatus: string;
  CurrentStatusId: string;
  SalesPerson: string;
  CreatedDate: string;
  LastTouched: string;
  WorkTypes: string[];
  Trades: string[];
}

interface JobListResponse {
  TotalRecords: number;
  CurrentPage: number;
  TotalPages: number;
  results: JobListResult[];
}

async function resolveStatusId(
  client: UnofficialClient,
  statusName: string
): Promise<{ statusId: string; milestoneName: string } | null> {
  const workflow = (await client.get(
    "/api/v3/workflows"
  )) as WorkflowResponse;

  const needle = statusName.toLowerCase().trim();
  for (const m of workflow.Milestones) {
    for (const s of m.Statuses) {
      if (s.Name.toLowerCase().trim() === needle) {
        return { statusId: s.StatusId, milestoneName: m.Name };
      }
    }
  }
  return null;
}

async function getAvailableStatuses(
  client: UnofficialClient
): Promise<string[]> {
  const workflow = (await client.get(
    "/api/v3/workflows"
  )) as WorkflowResponse;

  return workflow.Milestones.flatMap((m) =>
    m.Statuses.map((s) => s.Name.trim())
  );
}

export function registerUnofficialJobsCommands(
  parentCmd: Command,
  getClient: () => UnofficialClient
): void {
  const jobs = parentCmd
    .command("jobs")
    .description("Unofficial job search with workflow status filtering");

  jobs
    .command("list")
    .description("List jobs, optionally filtered by workflow status or milestone")
    .option("--status <name>", "Filter by workflow status name (case-insensitive)")
    .option("--milestone <name>", "Filter by milestone name (e.g. Prospect, Approved)")
    .option("--query <text>", "Search term")
    .option("--sort <field>", "Sort: milestoneStart|desc, lastTouched|desc, createdDate|desc", "milestoneStart|desc")
    .option("--page <n>", "Page number", "1")
    .action(async (opts) => {
      const client = getClient();
      const params = new URLSearchParams();

      if (opts.status) {
        const resolved = await resolveStatusId(client, opts.status);
        if (!resolved) {
          const available = await getAvailableStatuses(client);
          console.error(
            JSON.stringify({
              error: `Status "${opts.status}" not found`,
              available,
            })
          );
          process.exitCode = 1;
          return;
        }
        params.append("filters", `currentStatusId=${resolved.statusId}`);
      }

      if (opts.milestone) {
        params.append("filters", `currentMilestoneList=${opts.milestone}`);
      }

      params.set("sort", opts.sort);
      params.set("page", opts.page);
      params.set("type", "2");
      params.set("loadAll", "false");
      if (opts.query) params.set("query", opts.query);

      const data = (await client.get(
        `/api/joblist?${params.toString()}`
      )) as JobListResponse;

      const result = {
        totalRecords: data.TotalRecords,
        currentPage: data.CurrentPage,
        totalPages: data.TotalPages,
        jobs: data.results.map((j) => ({
          id: j.Id,
          name: j.Name,
          address: j.FullAddress,
          cityState: j.CityState,
          milestone: j.CurrentMilestone,
          status: j.CurrentStatus,
          salesPerson: j.SalesPerson,
          createdDate: j.CreatedDate,
          lastTouched: j.LastTouched,
          workTypes: j.WorkTypes,
          trades: j.Trades,
        })),
      };

      console.log(JSON.stringify(result));
    });
}
