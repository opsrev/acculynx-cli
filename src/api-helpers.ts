import type { ApiClient } from "./api-client.js";

const DEFAULT_PAGE_SIZE = 25;

interface PaginatedResponse {
  count: number;
  pageSize: number;
  pageStartIndex: number;
  items: unknown[];
}

export async function paginate(
  client: ApiClient,
  path: string,
  params: Record<string, string>,
  limit?: number
): Promise<unknown[]> {
  const results: unknown[] = [];
  let pageStartIndex = 0;

  while (true) {
    const pageParams = {
      ...params,
      pageSize: String(DEFAULT_PAGE_SIZE),
      pageStartIndex: String(pageStartIndex),
    };

    const data = (await client.get(path, pageParams)) as PaginatedResponse;
    results.push(...data.items);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    if (data.items.length < DEFAULT_PAGE_SIZE) {
      break;
    }

    pageStartIndex += DEFAULT_PAGE_SIZE;
  }

  return results;
}

export async function readStdin(
  stream: AsyncIterable<Buffer | string> = process.stdin
): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    throw new Error(
      "No input provided on stdin. Pipe JSON body, e.g.: echo '{...}' | acculynx jobs create"
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON on stdin");
  }
}
