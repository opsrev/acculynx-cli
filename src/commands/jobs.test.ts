import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerJobsCommands } from "./jobs.js";
import type { ApiClient } from "../api-client.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn().mockReturnValue(Buffer.from("file-content")) };
});

vi.mock("../api-helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-helpers.js")>();
  return { ...actual, readStdin: vi.fn().mockResolvedValue({ to: "John Doe", amount: 5000 }) };
});

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
    put: vi.fn().mockResolvedValue({ status: 204 }),
    postForm: vi.fn().mockResolvedValue({ id: "doc-1" }),
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

  it("jobs list passes assignment filter", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "list",
      "--assignment", "unassigned",
    ]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({
      assignment: "unassigned",
    }));
  });

  it("jobs list passes assignment=assigned with other filters", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "list",
      "--milestones", "dead",
      "--assignment", "assigned",
    ]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({
      milestones: "dead",
      assignment: "assigned",
    }));
  });

  it("jobs milestones calls GET /jobs/{jobId}/milestone-history", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue([]);

    await program.parseAsync(["node", "test", "jobs", "milestones", "abc-123"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs/abc-123/milestone-history");
  });

  it("jobs document-folders calls GET /company-settings/job-file-settings/document-folders", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ items: [{ id: "folder-1", name: "Photos" }] });

    await program.parseAsync(["node", "test", "jobs", "document-folders"]);

    expect(mockClient.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/document-folders",
      expect.objectContaining({
        recordStartIndex: "0",
        sortOrder: "Ascending",
      })
    );
  });

  it("jobs document-folders passes page-size and sort-order", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ items: [] });

    await program.parseAsync([
      "node", "test", "jobs", "document-folders",
      "--page-size", "10",
      "--sort-order", "Descending",
    ]);

    expect(mockClient.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/document-folders",
      expect.objectContaining({
        pageSize: "10",
        sortOrder: "Descending",
      })
    );
  });

  it("jobs upload-document sends multipart form with file and folder ID", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "upload-document", "job-123", "/tmp/invoice.pdf",
      "--folder-id", "folder-abc",
    ]);

    expect(mockClient.postForm).toHaveBeenCalledWith(
      "/jobs/job-123/documents",
      expect.any(FormData)
    );
    const form = (mockClient.postForm as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect(form.get("documentFolderId")).toBe("folder-abc");
    expect((form.get("file") as File).name).toBe("invoice.pdf");
  });

  it("jobs upload-document includes optional fields when provided", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "upload-document", "job-123", "/tmp/invoice.pdf",
      "--folder-id", "folder-abc",
      "--description", "Monthly invoice",
      "--external-id", "ext-1",
      "--external-source", "billing",
    ]);

    const form = (mockClient.postForm as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect(form.get("description")).toBe("Monthly invoice");
    expect(form.get("externalId")).toBe("ext-1");
    expect(form.get("externalSource")).toBe("billing");
  });

  it("jobs add-expense calls POST /jobs/{jobId}/payments/expense with stdin body", async () => {
    const { mockClient, program } = setup();
    mockClient.post = vi.fn().mockResolvedValue({
      id: "68badf8c-ec30-4531-a357-ff57bf12717b",
      paymentType: "Additional Expense",
      isParent: true,
      parentId: "fd33bba2-cb19-4baa-b87c-47ee9e55d95e",
    });

    await program.parseAsync(["node", "test", "jobs", "add-expense", "job-123"]);

    expect(mockClient.post).toHaveBeenCalledWith(
      "/jobs/job-123/payments/expense",
      { to: "John Doe", amount: 5000 }
    );
  });

  it("jobs upload-document rejects disallowed file extensions", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "upload-document", "job-123", "/tmp/malware.exe",
        "--folder-id", "folder-abc",
      ])
    ).rejects.toThrow("File type .exe is not allowed");
  });

  it("jobs set-work-type puts { workTypeId } as an integer to /jobs/{jobId}/work-type", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "set-work-type", "job-123",
      "--work-type-id", "1",
    ]);

    expect(mockClient.put).toHaveBeenCalledWith("/jobs/job-123/work-type", { workTypeId: 1 });
  });

  it("jobs set-work-type rejects a non-integer work type id", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "set-work-type", "job-123",
        "--work-type-id", "abc",
      ])
    ).rejects.toThrow("--work-type-id must be an integer");
  });

  it("jobs set-trade-types collects repeated --trade-type-id into an items array", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "set-trade-types", "job-123",
      "--trade-type-id", "tt-1",
      "--trade-type-id", "tt-2",
    ]);

    expect(mockClient.put).toHaveBeenCalledWith("/jobs/job-123/trade-types", {
      tradeTypeIds: ["tt-1", "tt-2"],
    });
  });

  it("jobs set-trade-types --clear unassigns all trade types", async () => {
    const { mockClient, program } = setup();

    await program.parseAsync([
      "node", "test", "jobs", "set-trade-types", "job-123", "--clear",
    ]);

    expect(mockClient.put).toHaveBeenCalledWith("/jobs/job-123/trade-types", { tradeTypeIds: [] });
  });

  it("jobs set-trade-types requires ids or --clear", async () => {
    const { mockClient, program } = setup();

    await expect(
      program.parseAsync(["node", "test", "jobs", "set-trade-types", "job-123"])
    ).rejects.toThrow("--trade-type-id");
    expect(mockClient.put).not.toHaveBeenCalled();
  });

  it("jobs set-trade-types rejects combining ids with --clear", async () => {
    const { mockClient, program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "set-trade-types", "job-123",
        "--trade-type-id", "tt-1", "--clear",
      ])
    ).rejects.toThrow("Cannot combine --clear");
    expect(mockClient.put).not.toHaveBeenCalled();
  });

  it("jobs work-types lists the company work types", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({
      count: 1, pageSize: 25, pageStartIndex: 0, items: [{ id: 1, name: "Retail" }],
    });

    await program.parseAsync(["node", "test", "jobs", "work-types"]);

    expect(mockClient.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/work-types",
      expect.anything()
    );
  });

  it("jobs trade-types lists the company trade types", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({
      count: 1, pageSize: 25, pageStartIndex: 0, items: [{ id: "uuid-win", name: "Windows" }],
    });

    await program.parseAsync(["node", "test", "jobs", "trade-types"]);

    expect(mockClient.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/trade-types",
      expect.anything()
    );
  });

  it("jobs set-work-type resolves a --work-type name to its id", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({
      count: 2, pageSize: 25, pageStartIndex: 0,
      items: [{ id: 1, name: "Retail" }, { id: 2, name: "Insurance" }],
    });

    await program.parseAsync([
      "node", "test", "jobs", "set-work-type", "job-123", "--work-type", "insurance",
    ]);

    expect(mockClient.put).toHaveBeenCalledWith("/jobs/job-123/work-type", { workTypeId: 2 });
  });

  it("jobs set-work-type rejects providing both --work-type and --work-type-id", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "set-work-type", "job-123",
        "--work-type", "insurance", "--work-type-id", "2",
      ])
    ).rejects.toThrow(/not both/);
  });

  it("jobs set-work-type requires a work type source", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync(["node", "test", "jobs", "set-work-type", "job-123"])
    ).rejects.toThrow(/Provide --work-type/);
  });

  it("jobs set-trade-types resolves --trade-type names to ids", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({
      count: 2, pageSize: 25, pageStartIndex: 0,
      items: [{ id: "uuid-win", name: "Windows" }, { id: "uuid-roof", name: "Roofing" }],
    });

    await program.parseAsync([
      "node", "test", "jobs", "set-trade-types", "job-123",
      "--trade-type", "windows", "--trade-type", "roofing",
    ]);

    expect(mockClient.put).toHaveBeenCalledWith("/jobs/job-123/trade-types", {
      tradeTypeIds: ["uuid-win", "uuid-roof"],
    });
  });

  it("jobs set-trade-types rejects mixing --trade-type and --trade-type-id", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "set-trade-types", "job-123",
        "--trade-type", "windows", "--trade-type-id", "tt-1",
      ])
    ).rejects.toThrow(/not both/);
  });

  it("jobs reps calls GET /jobs/{jobId}/representatives", async () => {
    const { mockClient, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({
      count: 1, pageSize: 10, pageStartIndex: 0,
      items: [{ id: "rep-1", type: "CompanyRepresentative", user: { id: "u-1" } }],
    });

    await program.parseAsync(["node", "test", "jobs", "reps", "job-123"]);

    expect(mockClient.get).toHaveBeenCalledWith("/jobs/job-123/representatives");
  });

  it("jobs reps-assign posts to /jobs/{jobId}/representatives/company by default", async () => {
    const { mockClient, program } = setup();
    mockClient.post = vi.fn().mockResolvedValue({ status: 200 });

    await program.parseAsync([
      "node", "test", "jobs", "reps-assign", "job-123",
      "--user-id", "u-1",
    ]);

    expect(mockClient.post).toHaveBeenCalledWith(
      "/jobs/job-123/representatives/company",
      { id: "u-1" }
    );
  });

  it("jobs reps-assign uses --type to target a specific rep type", async () => {
    const { mockClient, program } = setup();
    mockClient.post = vi.fn().mockResolvedValue({ status: 200 });

    await program.parseAsync([
      "node", "test", "jobs", "reps-assign", "job-123",
      "--user-id", "u-1",
      "--type", "sales-owner",
    ]);

    expect(mockClient.post).toHaveBeenCalledWith(
      "/jobs/job-123/representatives/sales-owner",
      { id: "u-1" }
    );
  });

  it("jobs reps-assign outputs the response", async () => {
    const { mockClient, program } = setup();
    mockClient.post = vi.fn().mockResolvedValue({ status: 200 });
    const logSpy = vi.spyOn(console, "log");

    await program.parseAsync([
      "node", "test", "jobs", "reps-assign", "job-123",
      "--user-id", "u-1",
    ]);

    const output = JSON.parse(logSpy.mock.calls[0][0]);
    expect(output).toEqual({ status: 200 });
  });

  describe("jobs scan", () => {
    it("scans, enriches nothing by default, prints a digest, exits 0", async () => {
      const { mockClient, logSpy, program } = setup();
      mockClient.get = vi.fn().mockResolvedValue({ count: 1, pageSize: 25, pageStartIndex: 0, items: [
        { id: "abc12345-x", jobName: "J", currentMilestone: "Approved", milestoneDate: "2026-07-14T00:00:00Z",
          locationAddress: { street1: "1 Way", city: "Jupiter" }, contacts: [], tradeTypes: [] },
      ] });
      await program.parseAsync(["node", "test", "jobs", "scan", "--milestones", "Approved"]);
      const printed = (logSpy.mock.calls.at(-1) ?? [""])[0] as string;
      expect(printed).toMatch(/^SCAN milestones=Approved/);
      expect(printed).toContain("jobs 1/1");
      expect(process.exitCode ?? 0).toBe(0);
    });

    it("rejects an unknown enricher with exit code 2", async () => {
      const { program } = setup();
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await program.parseAsync(["node", "test", "jobs", "scan", "--enrich", "photos"]);
      expect(errSpy.mock.calls[0][0]).toMatch(/Unknown enricher "photos"/);
      expect(process.exitCode).toBe(2);
      process.exitCode = 0;
    });

    it("prints the digest before the --out write, and a bad path does not eat the scan", async () => {
      const { mockClient, logSpy, program } = setup();
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockClient.get = vi.fn().mockResolvedValue({ count: 1, pageSize: 25, pageStartIndex: 0, items: [
        { id: "abc12345-x", jobName: "J", currentMilestone: "Approved", milestoneDate: "2026-07-14T00:00:00Z",
          locationAddress: { street1: "1 Way", city: "Jupiter" }, contacts: [], tradeTypes: [] },
      ] });
      process.exitCode = 0;
      await program.parseAsync(["node", "test", "jobs", "scan", "--out", "/no/such/dir/scan.jsonl"]);
      const printed = (logSpy.mock.calls.at(-1) ?? [""])[0] as string;
      expect(printed).toMatch(/^SCAN/);
      expect(printed).toContain("jobs 1/1");
      expect(errSpy.mock.calls.at(-1)?.[0]).toMatch(/^out: FAILED - /);
      expect(process.exitCode ?? 0).toBe(0); // a file-write failure is not partial coverage
    });

    it("forwards every filter flag to the jobs API", async () => {
      const { mockClient, program } = setup();
      process.exitCode = 0;
      await program.parseAsync([
        "node", "test", "jobs", "scan",
        "--start-date", "2026-01-01",
        "--end-date", "2026-12-31",
        "--date-filter-type", "MilestoneDate",
        "--milestones", "Approved,Completed",
        "--assignment", "assigned",
      ]);
      expect(mockClient.get).toHaveBeenCalledWith("/jobs", expect.objectContaining({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        dateFilterType: "MilestoneDate",
        milestones: "Approved,Completed",
        assignment: "assigned",
      }));
      expect(process.exitCode ?? 0).toBe(0);
    });

    it("sets exit code 3 on partial coverage", async () => {
      const { mockClient, program } = setup();
      mockClient.get = vi.fn()
        .mockResolvedValueOnce({ count: 60, pageSize: 25, pageStartIndex: 0, items: Array.from({ length: 25 }, (_, i) => ({ id: `j${i}`, contacts: [], locationAddress: {}, tradeTypes: [] })) })
        .mockRejectedValueOnce(new Error("HTTP 500"));
      await program.parseAsync(["node", "test", "jobs", "scan"]);
      expect(process.exitCode).toBe(3);
      process.exitCode = 0;
    });
  });
});

  it("jobs scan accepts the messages enricher", async () => {
    const { mockClient, logSpy, program } = setup();
    mockClient.get = vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] });
    await program.parseAsync(["node", "test", "jobs", "scan", "--enrich", "messages"]);
    const printed = (logSpy.mock.calls.at(-1) ?? [""])[0] as string;
    expect(printed).toContain("enrich=messages");
    expect(process.exitCode ?? 0).toBe(0);
  });
