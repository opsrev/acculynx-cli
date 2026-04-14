#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { getConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
import { createApiClient } from "./api-client.js";
import type { ApiClient } from "./api-client.js";
import { registerPingCommand } from "./commands/ping.js";
import { registerJobsCommands } from "./commands/jobs.js";
import { registerContactsCommands } from "./commands/contacts.js";
import { registerEstimatesCommands } from "./commands/estimates.js";
import { registerUsersCommands } from "./commands/users.js";

const program = new Command();

program
  .name("acculynx")
  .description("AccuLynx CRM CLI for AI agents")
  .version(version)
  .exitOverride()
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => {
      const trimmed = str.trim();
      if (trimmed === "(outputHelp)") {
        return;
      } else if (trimmed.startsWith("Usage:") || trimmed.startsWith("error:")) {
        process.stderr.write(str);
      } else {
        process.stderr.write(JSON.stringify({ error: trimmed }) + "\n");
      }
    },
  })
  .option("--api-key <key>", "AccuLynx API key (env: ACCULYNX_API_KEY)");

let _client: ApiClient | null = null;

function getConfigFromProgram() {
  const opts = program.opts();
  return getConfig({ apiKey: opts.apiKey });
}

function getClient(): ApiClient {
  if (!_client) {
    _client = createApiClient(getConfigFromProgram());
  }
  return _client;
}

registerPingCommand(program, getClient);
registerJobsCommands(program, getClient);
registerContactsCommands(program, getClient);
registerEstimatesCommands(program, getClient);
registerUsersCommands(program, getClient);
// Load extended commands if available
// Use CJS resolution (via createRequire) to find sibling global packages,
// since ESM import() cannot resolve them on its own.
try {
  const resolved = require.resolve("@opsrev/acculynx-cli-unofficial");
  const mod = await import(resolved);
  mod.registerExtendedCommands(program);
} catch {
  // Not installed
}

program.parseAsync().catch((err: Error) => {
  if (err.message === "(outputHelp)" || err.message === "(version)") {
    return;
  }
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
