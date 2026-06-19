declare module "@opsrev/acculynx-cli-unofficial" {
  import type { Command } from "commander";
  export function registerExtendedCommands(program: Command): void;
  export function extendedTools(): Array<{
    name: string;
    description: string;
    inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
  }>;
  export function handleExtendedToolCall(
    call: { name: string; args: Record<string, unknown> | undefined }
  ): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;
}
