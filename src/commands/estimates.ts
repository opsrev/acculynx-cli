import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import {
  estimatesList,
  estimateGet,
  estimateSections,
  estimateSection,
  estimateItems,
} from "../ops/estimates.js";

export function registerEstimatesCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const estimates = parentCmd.command("estimates").description("Estimate operations");

  estimates
    .command("list")
    .description("List estimates (paginated)")
    .option("--limit <n>", "Max total results (default: 25)")
    .option("--all", "Fetch all results (no limit)")
    .action(async (opts) => {
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      console.log(JSON.stringify(await estimatesList(getClient(), limit)));
    });

  estimates
    .command("get")
    .argument("<estimateId>", "Estimate ID")
    .description("Get estimate details")
    .action(async (estimateId: string) => {
      console.log(JSON.stringify(await estimateGet(getClient(), estimateId)));
    });

  estimates
    .command("sections")
    .argument("<estimateId>", "Estimate ID")
    .description("List sections for an estimate")
    .action(async (estimateId: string) => {
      console.log(JSON.stringify(await estimateSections(getClient(), estimateId)));
    });

  estimates
    .command("section")
    .argument("<estimateId>", "Estimate ID")
    .argument("<sectionId>", "Section ID")
    .description("Get estimate section details")
    .action(async (estimateId: string, sectionId: string) => {
      console.log(JSON.stringify(await estimateSection(getClient(), estimateId, sectionId)));
    });

  estimates
    .command("items")
    .argument("<estimateId>", "Estimate ID")
    .argument("<sectionId>", "Section ID")
    .description("List items in an estimate section")
    .action(async (estimateId: string, sectionId: string) => {
      console.log(JSON.stringify(await estimateItems(getClient(), estimateId, sectionId)));
    });
}
