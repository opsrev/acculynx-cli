import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

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
      if (opts.search) {
        const all = await paginate(getClient(), "/users", {}, Infinity);
        const term = opts.search.toLowerCase();
        const filtered = (all as Record<string, string>[]).filter((u) => {
          const fields = [u.displayName, u.firstName, u.lastName, u.email];
          return fields.some((f) => f && f.toLowerCase().includes(term));
        });
        console.log(JSON.stringify(filtered));
        return;
      }
      const limit = opts.all ? Infinity : opts.limit ? parseInt(opts.limit, 10) : undefined;
      const result = await paginate(getClient(), "/users", {}, limit);
      console.log(JSON.stringify(result));
    });
}
