declare module "@opsrev/acculynx-cli-unofficial" {
  import type { Command } from "commander";
  export function registerUnofficialCommands(program: Command): void;
}
