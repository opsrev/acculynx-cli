import type { ApiClient } from "../api-client.js";
import { paginate } from "../api-helpers.js";

export function estimatesList(client: ApiClient, limit?: number): Promise<unknown[]> {
  return paginate(client, "/estimates", {}, limit);
}

export const estimateGet = (client: ApiClient, estimateId: string): Promise<unknown> =>
  client.get(`/estimates/${estimateId}`);

export const estimateSections = (client: ApiClient, estimateId: string): Promise<unknown> =>
  client.get(`/estimates/${estimateId}/sections`);

export const estimateSection = (
  client: ApiClient,
  estimateId: string,
  sectionId: string
): Promise<unknown> => client.get(`/estimates/${estimateId}/sections/${sectionId}`);

export const estimateItems = (
  client: ApiClient,
  estimateId: string,
  sectionId: string
): Promise<unknown> => client.get(`/estimates/${estimateId}/sections/${sectionId}/items`);
