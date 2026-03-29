import type { Command } from "commander";
import type { UnofficialClient } from "../unofficial-client.js";

interface WorkflowStatus {
  StatusId: string;
  Name: string;
  IsCurrent: boolean;
  Done: boolean;
}

interface WorkflowMilestone {
  MilestoneId: number;
  Name: string;
  IsCurrent: boolean;
  Done: boolean;
  Statuses: WorkflowStatus[];
}

interface WorkflowResponse {
  JobId: string;
  Milestones: WorkflowMilestone[];
}

export function registerMilestonesCommands(
  parentCmd: Command,
  getClient: () => UnofficialClient
): void {
  const milestones = parentCmd
    .command("milestones")
    .description("Job milestone/status operations");

  milestones
    .command("list")
    .argument("<jobId>", "Job ID (GUID)")
    .description("List all milestones and statuses for a job's workflow")
    .action(async (jobId: string) => {
      const data = (await getClient().get(
        `/api/v3/job-workflows/${jobId}`
      )) as WorkflowResponse;

      const result = data.Milestones.map((m) => ({
        milestoneId: m.MilestoneId,
        name: m.Name,
        isCurrent: m.IsCurrent,
        done: m.Done,
        statuses: m.Statuses.map((s) => ({
          statusId: s.StatusId,
          name: s.Name.trim(),
          isCurrent: s.IsCurrent,
          done: s.Done,
        })),
      }));

      console.log(JSON.stringify(result));
    });

  milestones
    .command("set")
    .argument("<jobId>", "Job ID (GUID)")
    .argument("<statusName>", "Destination milestone/status name (case-insensitive)")
    .option("--message <message>", "Optional comment when advancing", "")
    .description("Set a job's milestone/status by name")
    .action(async (jobId: string, statusName: string, opts) => {
      const data = (await getClient().get(
        `/api/v3/job-workflows/${jobId}`
      )) as WorkflowResponse;

      const needle = statusName.toLowerCase().trim();
      let matchedMilestoneId: number | null = null;
      let matchedStatus: WorkflowStatus | null = null;

      for (const m of data.Milestones) {
        // Check if the name matches a milestone name directly
        if (m.Name.toLowerCase().trim() === needle) {
          // Use the first status in this milestone
          matchedMilestoneId = m.MilestoneId;
          matchedStatus = m.Statuses[0] ?? null;
          break;
        }
        // Check statuses within the milestone
        for (const s of m.Statuses) {
          if (s.Name.toLowerCase().trim() === needle) {
            matchedMilestoneId = m.MilestoneId;
            matchedStatus = s;
            break;
          }
        }
        if (matchedStatus) break;
      }

      if (!matchedMilestoneId || !matchedStatus) {
        const available = data.Milestones.flatMap((m) =>
          m.Statuses.map((s) => s.Name.trim())
        );
        console.error(
          JSON.stringify({
            error: `Status "${statusName}" not found`,
            available,
          })
        );
        process.exitCode = 1;
        return;
      }

      await getClient().post(
        `/api/v3/job-workflows/${jobId}/set-state`,
        {
          MilestoneId: matchedMilestoneId,
          StatusId: matchedStatus.StatusId,
          Message: opts.message,
        }
      );

      console.log(
        JSON.stringify({
          jobId,
          milestoneId: matchedMilestoneId,
          statusId: matchedStatus.StatusId,
          statusName: matchedStatus.Name.trim(),
          message: opts.message || null,
        })
      );
    });
}
