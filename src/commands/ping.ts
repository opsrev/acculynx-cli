import type { Command } from "commander";
import type { ApiClient } from "../api-client.js";
import { ping } from "../ops/ping.js";

export function registerPingCommand(
  parentCmd: Command,
  getClient: () => ApiClient
): void {
  parentCmd
    .command("ping")
    .description("Health check — verify API key and connectivity")
    .action(async () => {
      const result = await ping(getClient());
      console.log(JSON.stringify(result));
    });
}
