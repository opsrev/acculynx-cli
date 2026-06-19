import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

export function contactsList(client: ApiClient, limit?: number): Promise<unknown[]> {
  return paginate(client, "/contacts", {}, limit);
}

export function contactGet(client: ApiClient, contactId: string): Promise<unknown> {
  return client.get(`/contacts/${contactId}`);
}

export function contactCreate(client: ApiClient, body: unknown): Promise<unknown> {
  return client.post("/contacts", body);
}

export interface ContactsSearchOpts {
  query: string;
  startDate: string;
  endDate: string;
  sortBy?: string;
  sortOrder?: string;
}

export function contactsSearch(client: ApiClient, opts: ContactsSearchOpts): Promise<unknown> {
  return client.post("/contacts/search", {
    searchTerm: opts.query,
    startDate: opts.startDate,
    endDate: opts.endDate,
    sort: {
      sortColumn: opts.sortBy ?? "lastName",
      sortDirection: opts.sortOrder ?? "Ascending",
    },
  });
}

export const contactEmails = (client: ApiClient, contactId: string): Promise<unknown> =>
  client.get(`/contacts/${contactId}/email-addresses`);

export const contactPhones = (client: ApiClient, contactId: string): Promise<unknown> =>
  client.get(`/contacts/${contactId}/phone-numbers`);

export interface PhoneAddOpts {
  type: string;
  number: string;
  smsOptOut?: boolean;
}

export function contactPhoneAdd(
  client: ApiClient,
  contactId: string,
  opts: PhoneAddOpts
): Promise<unknown> {
  return client.post(`/contacts/${contactId}/phone-numbers`, {
    type: opts.type,
    number: opts.number,
    smsOptOut: Boolean(opts.smsOptOut),
  });
}
