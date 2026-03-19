import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

export function registerEstimatesCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const estimates = parentCmd.command("estimates").description("Estimate operations");

  estimates
    .command("list")
    .description("List estimates (paginated)")
    .option("--limit <n>", "Max total results")
    .action(async (opts) => {
      const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await paginate(getClient(), "/estimates", {}, limit);
      console.log(JSON.stringify(result));
    });

  estimates
    .command("get")
    .argument("<estimateId>", "Estimate ID")
    .description("Get estimate details")
    .action(async (estimateId: string) => {
      const result = await getClient().get(`/estimates/${estimateId}`);
      console.log(JSON.stringify(result));
    });

  estimates
    .command("sections")
    .argument("<estimateId>", "Estimate ID")
    .description("List sections for an estimate")
    .action(async (estimateId: string) => {
      const result = await getClient().get(`/estimates/${estimateId}/sections`);
      console.log(JSON.stringify(result));
    });

  estimates
    .command("section")
    .argument("<estimateId>", "Estimate ID")
    .argument("<sectionId>", "Section ID")
    .description("Get estimate section details")
    .action(async (estimateId: string, sectionId: string) => {
      const result = await getClient().get(`/estimates/${estimateId}/sections/${sectionId}`);
      console.log(JSON.stringify(result));
    });

  estimates
    .command("items")
    .argument("<estimateId>", "Estimate ID")
    .argument("<sectionId>", "Section ID")
    .description("List items in an estimate section")
    .action(async (estimateId: string, sectionId: string) => {
      const result = await getClient().get(`/estimates/${estimateId}/sections/${sectionId}/items`);
      console.log(JSON.stringify(result));
    });
}
