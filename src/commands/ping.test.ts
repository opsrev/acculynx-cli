import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { registerPingCommand } from "./ping.js";
import type { ApiClient } from "../api-client.js";

describe("ping command", () => {
  it("calls GET /diagnostics/ping and logs result", async () => {
    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ status: "ok" }),
      post: vi.fn(),
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = new Command();
    program.exitOverride();
    registerPingCommand(program, () => mockClient);

    await program.parseAsync(["node", "test", "ping"]);

    expect(mockClient.get).toHaveBeenCalledWith("/diagnostics/ping");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ status: "ok" }));

    logSpy.mockRestore();
  });
});
