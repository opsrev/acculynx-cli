import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerEstimatesCommands } from "./estimates.js";
import type { ApiClient } from "../api-client.js";

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn(),
  };
  vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  program.exitOverride();
  registerEstimatesCommands(program, () => mockClient);
  return { mockClient, program };
}

describe("estimates commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("estimates list calls paginate on /estimates", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync(["node", "test", "estimates", "list"]);

    expect(mockClient.get).toHaveBeenCalledWith("/estimates", expect.objectContaining({
      pageSize: "25",
      pageStartIndex: "0",
    }));
  });

  it("estimates get calls GET /estimates/{estimateId}", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ id: "e-1" });

    await program.parseAsync(["node", "test", "estimates", "get", "e-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/estimates/e-1");
  });

  it("estimates sections calls GET /estimates/{estimateId}/sections", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "estimates", "sections", "e-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/estimates/e-1/sections");
  });

  it("estimates section calls GET /estimates/{estimateId}/sections/{sectionId}", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ id: "s-1" });

    await program.parseAsync(["node", "test", "estimates", "section", "e-1", "s-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/estimates/e-1/sections/s-1");
  });

  it("estimates items calls GET /estimates/{estimateId}/sections/{sectionId}/items", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "estimates", "items", "e-1", "s-1"]);

    expect(mockClient.get).toHaveBeenCalledWith("/estimates/e-1/sections/s-1/items");
  });
});
