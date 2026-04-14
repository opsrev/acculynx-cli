import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "./api-client.js";

describe("createApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("makes authenticated GET requests with Bearer token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    const result = await client.get("/ping");

    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.acculynx.com/api/v2/ping",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          Accept: "application/json",
        }),
      })
    );
  });

  it("appends query params to GET URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    await client.get("/jobs", { pageSize: "50", pageStartIndex: "0" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.acculynx.com/api/v2/jobs?pageSize=50&pageStartIndex=0"
    );
  });

  it("makes POST requests with JSON body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: 1 })),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    const result = await client.post("/jobs", { name: "New Job" });

    expect(result).toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.acculynx.com/api/v2/jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({ name: "New Job" }),
      })
    );
  });

  it("throws on non-ok response with details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("job not found"),
      })
    );

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    await expect(client.get("/jobs/999")).rejects.toThrow("404");
  });

  it("retries on 429 with exponential backoff", async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers(),
        text: () => Promise.resolve("rate limited"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    const promise = client.get("/ping");
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("makes POST form requests without Content-Type header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: "doc-1" })),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    const form = new FormData();
    form.append("file", new File(["data"], "test.pdf"));
    form.append("documentFolderId", "folder-1");

    const result = await client.postForm("/jobs/j1/documents", form);

    expect(result).toEqual({ id: "doc-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.acculynx.com/api/v2/jobs/j1/documents",
      expect.objectContaining({
        method: "POST",
        body: form,
      })
    );
    // Content-Type must NOT be set so fetch auto-sets multipart boundary
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty("Content-Type");
    expect(callHeaders).toHaveProperty("Authorization", "Bearer test-key");
  });

  it("throws after max retries on 429", async () => {
    vi.useFakeTimers();
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers(),
      text: () => Promise.resolve("rate limited"),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const client = createApiClient({
      baseUrl: "https://api.acculynx.com/api/v2",
      apiKey: "test-key",
    });

    const promise = client.get("/ping").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15000);
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("429");
    vi.useRealTimers();
  });
});
