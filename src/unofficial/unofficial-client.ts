import type { UnofficialSession } from "./session.js";

export interface UnofficialClient {
  get(path: string): Promise<unknown>;
  getBuffer(url: string): Promise<Buffer>;
}

export function createUnofficialClient(
  session: UnofficialSession
): UnofficialClient {
  const base = "https://my.acculynx.com";

  async function doGet(path: string): Promise<unknown> {
    const url = `${base}${path}`;
    const resp = await fetch(url, {
      headers: {
        Cookie: session.jar.headerFor(url),
        Accept: "application/json",
      },
    });
    if (resp.status === 401 || resp.status === 302) {
      throw new Error(
        "Session expired — run `acculynx unofficial login` to re-authenticate"
      );
    }
    if (!resp.ok) {
      throw new Error(
        `Unofficial API error (${resp.status}): ${await resp.text()}`
      );
    }
    return resp.json();
  }

  async function doGetBuffer(url: string): Promise<Buffer> {
    const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
    const resp = await fetch(fullUrl, {
      headers: { Cookie: session.jar.headerFor(fullUrl) },
    });
    if (!resp.ok) {
      throw new Error(`Download failed (${resp.status}): ${fullUrl}`);
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  return { get: doGet, getBuffer: doGetBuffer };
}
