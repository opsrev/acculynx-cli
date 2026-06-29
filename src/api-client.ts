import type { AccuLynxConfig } from "./config.js";
import { sanitizeDeep, toAscii } from "./sanitize.js";

export interface ApiClient {
  get(path: string, params?: Record<string, string>): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
  put(path: string, body: unknown): Promise<unknown>;
  postForm(path: string, body: FormData): Promise<unknown>;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rebuild a FormData with every text field and filename run through toAscii,
// while preserving each file's binary content untouched.
function sanitizeForm(form: FormData): FormData {
  const out = new FormData();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      out.append(key, toAscii(value));
    } else {
      out.append(key, value, toAscii(value.name) || "file");
    }
  }
  return out;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  const response = await fetch(url, init);

  if (response.status === 429 && retries > 0) {
    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : INITIAL_DELAY_MS * Math.pow(2, MAX_RETRIES - retries);
    await sleep(delay);
    return fetchWithRetry(url, init, retries - 1);
  }

  return response;
}

export function createApiClient(config: AccuLynxConfig): ApiClient {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  };

  async function doGet(
    path: string,
    params?: Record<string, string>
  ): Promise<unknown> {
    let url = `${config.baseUrl}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    const response = await fetchWithRetry(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `API error (${response.status} ${response.statusText}): ${text}`
      );
    }

    return response.json();
  }

  async function doPost(path: string, body: unknown): Promise<unknown> {
    const url = `${config.baseUrl}${path}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(sanitizeDeep(body)),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `API error (${response.status} ${response.statusText}): ${text}`
      );
    }

    const text = await response.text();
    return text ? JSON.parse(text) : { status: response.status };
  }

  async function doPut(path: string, body: unknown): Promise<unknown> {
    const url = `${config.baseUrl}${path}`;
    const response = await fetchWithRetry(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(sanitizeDeep(body)),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `API error (${response.status} ${response.statusText}): ${text}`
      );
    }

    const text = await response.text();
    return text ? JSON.parse(text) : { status: response.status };
  }

  async function doPostForm(
    path: string,
    body: FormData
  ): Promise<unknown> {
    const url = `${config.baseUrl}${path}`;
    const { "Content-Type": _, ...formHeaders } = headers;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: formHeaders,
      body: sanitizeForm(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `API error (${response.status} ${response.statusText}): ${text}`
      );
    }

    const text = await response.text();
    return text ? JSON.parse(text) : { status: response.status };
  }

  return {
    get: doGet,
    post: doPost,
    put: doPut,
    postForm: doPostForm,
  };
}
