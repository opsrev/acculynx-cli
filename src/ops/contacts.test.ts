import { describe, it, expect, vi, afterEach } from "vitest";
import { contactsSearch, contactPhoneAdd } from "./contacts.js";
import type { ApiClient } from "../api-client.js";

function mockClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ count: 0, pageSize: 25, pageStartIndex: 0, items: [] }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
    postForm: vi.fn(),
  };
}

describe("contacts ops", () => {
  afterEach(() => vi.restoreAllMocks());

  it("contactsSearch builds the nested sort body with defaults", async () => {
    const client = mockClient();
    await contactsSearch(client, { query: "smith", startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(client.post).toHaveBeenCalledWith("/contacts/search", {
      searchTerm: "smith",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      sort: { sortColumn: "lastName", sortDirection: "Ascending" },
    });
  });

  it("contactsSearch honors explicit sort options", async () => {
    const client = mockClient();
    await contactsSearch(client, {
      query: "smith", startDate: "2026-01-01", endDate: "2026-12-31",
      sortBy: "firstName", sortOrder: "Descending",
    });
    expect(client.post).toHaveBeenCalledWith("/contacts/search", expect.objectContaining({
      sort: { sortColumn: "firstName", sortDirection: "Descending" },
    }));
  });

  it("contactPhoneAdd coerces smsOptOut to a boolean", async () => {
    const client = mockClient();
    await contactPhoneAdd(client, "c-1", { type: "Mobile", number: "5551234" });
    expect(client.post).toHaveBeenCalledWith("/contacts/c-1/phone-numbers", {
      type: "Mobile", number: "5551234", smsOptOut: false,
    });
  });
});
