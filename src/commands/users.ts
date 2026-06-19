import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { usersList } from "../ops/users.js";

export function registerUsersCommands(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  const users = parentCmd.command("users").description("User operations");

  users
    .command("list")
    .description("List users (paginated)")
    .option("--limit <n>", "Max total results (default: 25)")
    .option("--all", "Fetch all results (no limit)")
    .option("--search <text>", "Filter users by name or email (client-side)")
    .action(async (opts) => {
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await usersList(getClient(), { limit, search: opts.search });
      console.log(JSON.stringify(result));
    });
}
