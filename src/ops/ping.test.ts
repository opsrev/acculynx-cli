import { describe, it, expect, vi } from "vitest";
import { ping } from "./ping.js";
import type { ApiClient } from "../api-client.js";

function mockClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ ok: true }),
    post: vi.fn(),
    postForm: vi.fn(),
  };
}

describe("ping op", () => {
  it("calls GET /diagnostics/ping and returns the response", async () => {
    const client = mockClient();
    const result = await ping(client);
    expect(client.get).toHaveBeenCalledWith("/diagnostics/ping");
    expect(result).toEqual({ ok: true });
  });
});
