import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { paginate, readStdin } from "./api-helpers.js";
import type { ApiClient } from "./api-client.js";

describe("paginate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches a single page when items < pageSize", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ count: 2, pageSize: 25, pageStartIndex: 0, items }),
      post: vi.fn(),
    };

    const result = await paginate(mockClient, "/jobs", {});
    expect(result).toEqual(items);
    expect(mockClient.get).toHaveBeenCalledOnce();
    expect(mockClient.get).toHaveBeenCalledWith("/jobs", {
      pageSize: "25",
      pageStartIndex: "0",
    });
  });

  it("fetches multiple pages until a partial page is returned", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const page2 = [{ id: 25 }, { id: 26 }];
    const mockClient: ApiClient = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ count: 27, pageSize: 25, pageStartIndex: 0, items: page1 })
        .mockResolvedValueOnce({ count: 27, pageSize: 25, pageStartIndex: 25, items: page2 }),
      post: vi.fn(),
    };

    const result = await paginate(mockClient, "/jobs", {}, Infinity);
    expect(result).toHaveLength(27);
    expect(mockClient.get).toHaveBeenCalledTimes(2);
    expect(mockClient.get).toHaveBeenNthCalledWith(2, "/jobs", {
      pageSize: "25",
      pageStartIndex: "25",
    });
  });

  it("respects limit param", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ count: 50, pageSize: 25, pageStartIndex: 0, items: page1 }),
      post: vi.fn(),
    };

    const result = await paginate(mockClient, "/jobs", {}, 10);
    expect(result).toHaveLength(10);
  });

  it("passes extra params through to client.get", async () => {
    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
      post: vi.fn(),
    };

    await paginate(mockClient, "/jobs", { startDate: "2026-01-01" });
    expect(mockClient.get).toHaveBeenCalledWith("/jobs", {
      startDate: "2026-01-01",
      pageSize: "25",
      pageStartIndex: "0",
    });
  });
});

describe("readStdin", () => {
  it("parses valid JSON from stdin", async () => {
    const mockStdin = Readable.from([Buffer.from('{"name": "Test Job"}')]);
    const result = await readStdin(mockStdin);
    expect(result).toEqual({ name: "Test Job" });
  });

  it("throws on empty stdin", async () => {
    const mockStdin = Readable.from([]);
    await expect(readStdin(mockStdin)).rejects.toThrow(
      "No input provided on stdin"
    );
  });

  it("throws on invalid JSON", async () => {
    const mockStdin = Readable.from([Buffer.from("not json")]);
    await expect(readStdin(mockStdin)).rejects.toThrow(
      "Invalid JSON on stdin"
    );
  });
});
