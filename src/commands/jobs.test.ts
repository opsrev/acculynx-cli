import { describe, it, expect, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerJobsCommands } from "./jobs.js";
import type { ApiClient } from "../api-client.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn().mockReturnValue(Buffer.from("file-content")) };
});

function setup() {
  const mockClient: ApiClient = {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
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

  it("jobs upload-document rejects disallowed file extensions", async () => {
    const { program } = setup();

    await expect(
      program.parseAsync([
        "node", "test", "jobs", "upload-document", "job-123", "/tmp/malware.exe",
        "--folder-id", "folder-abc",
      ])
    ).rejects.toThrow("File type .exe is not allowed");
  });
});
