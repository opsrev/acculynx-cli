import { describe, it, expect, vi, afterEach } from "vitest";
import {
  jobsList,
  jobRepsAssign,
  jobSetWorkType,
  jobSetTradeTypes,
  companyWorkTypes,
  companyTradeTypes,
  resolveWorkTypeId,
  resolveTradeTypeIds,
  documentFolders,
  jobUploadDocument,
} from "./jobs.js";
import type { ApiClient } from "../api-client.js";

const WORK_TYPES = [
  { id: 1, name: "Retail", systemDefault: true },
  { id: 2, name: "Insurance", systemDefault: true },
  { id: 3, name: "Insurance Supplement", systemDefault: false },
];
// The live API returns trade types keyed by `id` (the pasted OpenAPI doc's
// `tradeId` was wrong), so the fixtures mirror reality.
const TRADE_TYPES = [
  { id: "uuid-win", name: "Windows" },
  { id: "uuid-roof", name: "Roofing" },
  { id: "uuid-sid", name: "Siding" },
];

// A client whose paginated GET serves a fixed item list (single page).
function listClient(items: unknown[]): ApiClient {
  const client = mockClient();
  client.get = vi.fn().mockResolvedValue({
    count: items.length, pageSize: 25, pageStartIndex: 0, items,
  });
  return client;
}

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn().mockReturnValue(Buffer.from("file-content")) };
});

function mockClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ status: 200 }),
    put: vi.fn().mockResolvedValue({ status: 204 }),
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

  it("jobSetWorkType puts { workTypeId } to /jobs/{jobId}/work-type", async () => {
    const client = mockClient();
    await jobSetWorkType(client, "job-123", 1);
    expect(client.put).toHaveBeenCalledWith("/jobs/job-123/work-type", { workTypeId: 1 });
  });

  it("jobSetTradeTypes puts a flat tradeTypeIds array", async () => {
    const client = mockClient();
    await jobSetTradeTypes(client, "job-123", ["tt-1", "tt-2"]);
    expect(client.put).toHaveBeenCalledWith("/jobs/job-123/trade-types", {
      tradeTypeIds: ["tt-1", "tt-2"],
    });
  });

  it("jobSetTradeTypes sends an empty tradeTypeIds array to unassign all", async () => {
    const client = mockClient();
    await jobSetTradeTypes(client, "job-123", []);
    expect(client.put).toHaveBeenCalledWith("/jobs/job-123/trade-types", { tradeTypeIds: [] });
  });

  it("companyWorkTypes fetches all items from the work-types endpoint", async () => {
    const client = listClient(WORK_TYPES);
    const result = await companyWorkTypes(client);
    expect(client.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/work-types",
      expect.objectContaining({ pageStartIndex: "0" })
    );
    expect(result).toEqual(WORK_TYPES);
  });

  it("companyTradeTypes fetches all items from the trade-types endpoint", async () => {
    const client = listClient(TRADE_TYPES);
    const result = await companyTradeTypes(client);
    expect(client.get).toHaveBeenCalledWith(
      "/company-settings/job-file-settings/trade-types",
      expect.objectContaining({ pageStartIndex: "0" })
    );
    expect(result).toEqual(TRADE_TYPES);
  });

  it("resolveWorkTypeId matches a name case-insensitively", async () => {
    const client = listClient(WORK_TYPES);
    expect(await resolveWorkTypeId(client, "insurance")).toBe(2);
  });

  it("resolveWorkTypeId matches a unique substring", async () => {
    const client = listClient(WORK_TYPES);
    expect(await resolveWorkTypeId(client, "supplement")).toBe(3);
  });

  it("resolveWorkTypeId passes a numeric id straight through", async () => {
    const client = listClient(WORK_TYPES);
    expect(await resolveWorkTypeId(client, "1")).toBe(1);
  });

  it("resolveWorkTypeId throws and lists options when nothing matches", async () => {
    const client = listClient(WORK_TYPES);
    await expect(resolveWorkTypeId(client, "plumbing")).rejects.toThrow(
      /No work type matches "plumbing".*Retail.*Insurance/s
    );
  });

  it("resolveWorkTypeId throws on an ambiguous substring", async () => {
    const client = listClient(WORK_TYPES);
    await expect(resolveWorkTypeId(client, "ins")).rejects.toThrow(
      /multiple work types: Insurance, Insurance Supplement/
    );
  });

  it("resolveTradeTypeIds resolves several names with a single fetch", async () => {
    const client = listClient(TRADE_TYPES);
    const ids = await resolveTradeTypeIds(client, ["windows", "Roofing"]);
    expect(ids).toEqual(["uuid-win", "uuid-roof"]);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("resolveTradeTypeIds passes a uuid straight through", async () => {
    const client = listClient(TRADE_TYPES);
    expect(await resolveTradeTypeIds(client, ["uuid-sid"])).toEqual(["uuid-sid"]);
  });

  it("resolveTradeTypeIds throws and lists options when a value does not match", async () => {
    const client = listClient(TRADE_TYPES);
    await expect(resolveTradeTypeIds(client, ["windows", "gutters"])).rejects.toThrow(
      /No trade type matches "gutters".*Windows.*Roofing.*Siding/s
    );
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
