import { describe, it, expect, vi, afterEach } from "vitest";
import {
  jobsList,
  jobRepsAssign,
  documentFolders,
  jobUploadDocument,
} from "./jobs.js";
import type { ApiClient } from "../api-client.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn().mockReturnValue(Buffer.from("file-content")) };
});

function mockClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ status: 200 }),
    postForm: vi.fn().mockResolvedValue({ id: "doc-1" }),
  };
}

describe("jobs ops", () => {
  afterEach(() => vi.restoreAllMocks());

  it("jobsList defaults sortBy to CreatedDate and paginates /jobs", async () => {
    const client = mockClient();
    await jobsList(client, {});
    expect(client.get).toHaveBeenCalledWith(
      "/jobs",
      expect.objectContaining({ sortBy: "CreatedDate", pageSize: "25", pageStartIndex: "0" })
    );
  });

  it("jobsList forwards filters and overrides sortBy", async () => {
    const client = mockClient();
    await jobsList(client, { startDate: "2026-01-01", assignment: "unassigned", sortBy: "ModifiedDate" });
    expect(client.get).toHaveBeenCalledWith(
      "/jobs",
      expect.objectContaining({ startDate: "2026-01-01", assignment: "unassigned", sortBy: "ModifiedDate" })
    );
  });

  it("jobRepsAssign defaults type to company and posts { id }", async () => {
    const client = mockClient();
    await jobRepsAssign(client, "job-123", { userId: "u-1" });
    expect(client.post).toHaveBeenCalledWith("/jobs/job-123/representatives/company", { id: "u-1" });
  });

  it("jobRepsAssign targets the given rep type", async () => {
    const client = mockClient();
    await jobRepsAssign(client, "job-123", { userId: "u-1", type: "sales-owner" });
    expect(client.post).toHaveBeenCalledWith("/jobs/job-123/representatives/sales-owner", { id: "u-1" });
  });

  it("documentFolders applies recordStartIndex/sortOrder defaults", async () => {
    const client = mockClient();
    await documentFolders(client, {});
    expect(client.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/document-folders",
      expect.objectContaining({ recordStartIndex: "0", sortOrder: "Ascending" })
    );
  });

  it("jobUploadDocument throws on disallowed extensions", () => {
    const client = mockClient();
    // jobUploadDocument is a non-async function: the blocklist check throws
    // synchronously (before any await), so assert with a sync throw, not .rejects.
    expect(() =>
      jobUploadDocument(client, "job-123", "/tmp/malware.exe", { folderId: "f-1" })
    ).toThrow("File type .exe is not allowed");
  });

  it("jobUploadDocument posts multipart form with file + folder id", async () => {
    const client = mockClient();
    await jobUploadDocument(client, "job-123", "/tmp/invoice.pdf", { folderId: "folder-abc" });
    expect(client.postForm).toHaveBeenCalledWith("/jobs/job-123/documents", expect.any(FormData));
    const form = (client.postForm as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect(form.get("documentFolderId")).toBe("folder-abc");
    expect((form.get("file") as File).name).toBe("invoice.pdf");
  });
});
