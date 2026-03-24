/** Minimal cookie jar: stores name=value pairs per domain, sends them back. */
export class CookieJar {
  private cookies = new Map<string, Map<string, string>>();

  /** Extract and store cookies from a response's Set-Cookie headers. */
  capture(url: string, response: Response): void {
    const domain = new URL(url).hostname;
    const jar = this.cookies.get(domain) ?? new Map<string, string>();
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      jar.set(pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1).trim());
    }
    this.cookies.set(domain, jar);
  }

  /** Get a specific cookie value by name for a given URL. */
  getCookie(url: string, name: string): string | undefined {
    const domain = new URL(url).hostname;
    for (const [d, jar] of this.cookies) {
      if (domain === d || domain.endsWith("." + d)) {
        if (jar.has(name)) return jar.get(name);
      }
    }
    return undefined;
  }

  /** Build a Cookie header string for a given URL. */
  headerFor(url: string): string {
    const domain = new URL(url).hostname;
    const parts: string[] = [];
    for (const [d, jar] of this.cookies) {
      if (domain === d || domain.endsWith("." + d)) {
        for (const [k, v] of jar) parts.push(`${k}=${v}`);
      }
    }
    return parts.join("; ");
  }

  /** Serialize for disk caching. */
  toJSON(): Record<string, Record<string, string>> {
    const out: Record<string, Record<string, string>> = {};
    for (const [d, jar] of this.cookies) {
      out[d] = Object.fromEntries(jar);
    }
    return out;
  }

  /** Restore from disk cache. */
  static fromJSON(data: Record<string, Record<string, string>>): CookieJar {
    const jar = new CookieJar();
    for (const [d, pairs] of Object.entries(data)) {
      jar.cookies.set(d, new Map(Object.entries(pairs)));
    }
    return jar;
  }
}
