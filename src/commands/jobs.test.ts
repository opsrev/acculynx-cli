import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerJobsCommands } from "./jobs.js";
import type { ApiClient } from "../api-client.js";

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
  };
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  program.exitOverride();
  program.option("--api-key <key>");
  registerJobsCommands(program, () => mockClient);
  return { mockClient, logSpy, program };
}

describe("jobs commands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("jobs list calls GET /jobs with pagination params", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync(["node", "test", "jobs", "list"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({
      pageSize: "25",
      pageStartIndex: "0",
    }));
  });

  it("jobs list passes filter options", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "list",
      "--start-date", "2026-01-01",
      "--end-date", "2026-12-31",
      "--sort-by", "ModifiedDate",
    ]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      sortBy: "ModifiedDate",
    }));
  });

  it("jobs get calls GET /jobs/{jobId}", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ id: "abc-123", name: "Test Job" });

    await program.parseAsync(["node", "test", "jobs", "get", "abc-123"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs/abc-123");
  });

  it("jobs contacts calls GET /jobs/{jobId}/contacts", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([{ id: 1, name: "John" }]);

    await program.parseAsync(["node", "test", "jobs", "contacts", "abc-123"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs/abc-123/contacts");
  });

  it("jobs milestones calls GET /jobs/{jobId}/milestones", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "jobs", "milestones", "abc-123"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs/abc-123/milestones");
  });
});
