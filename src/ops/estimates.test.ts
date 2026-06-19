import { describe, it, expect, vi, afterEach } from "vitest";
import { estimateSection, estimateItems, estimatesList } from "./estimates.js";
import type { ApiClient } from "../api-client.js";

function mockClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn(),
    postForm: vi.fn(),
  };
}

describe("estimates ops", () => {
  afterEach(() => vi.restoreAllMocks());

  it("estimatesList paginates /estimates", async () => {
    const client = mockClient();
    await estimatesList(client);
    expect(client.get).toHaveBeenCalledWith(
      "/estimates",
      expect.objectContaining({ pageSize: "25", pageStartIndex: "0" })
    );
  });

  it("estimateSection builds the nested section path", async () => {
    const client = mockClient();
    client.get = vi.fn().mockResolvedValue({ id: "s-1" });
    await estimateSection(client, "e-1", "s-1");
    expect(client.get).toHaveBeenCalledWith("/estimates/e-1/sections/s-1");
  });

  it("estimateItems builds the section items path", async () => {
    const client = mockClient();
    client.get = vi.fn().mockResolvedValue([]);
    await estimateItems(client, "e-1", "s-1");
    expect(client.get).toHaveBeenCalledWith("/estimates/e-1/sections/s-1/items");
  });
});
