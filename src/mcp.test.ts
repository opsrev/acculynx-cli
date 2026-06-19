import { describe, it, expect, vi } from "vitest";
import { bootSelfCheck } from "./mcp.js";

describe("bootSelfCheck", () => {
  it("exits(1) when the API key is missing", async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    await bootSelfCheck(
      () => { throw new Error("Missing required credential: ACCULYNX_API_KEY"); },
      (m) => logs.push(m),
      exit as unknown as (code: number) => never
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(logs.join("\n")).toContain("ACCULYNX_API_KEY");
  });

  it("does not exit when the key resolves", async () => {
    const exit = vi.fn();
    await bootSelfCheck(
      () => ({ baseUrl: "https://api.acculynx.com/api/v2", apiKey: "k" }),
      () => {},
      exit as unknown as (code: number) => never
    );
    expect(exit).not.toHaveBeenCalled();
  });
});
