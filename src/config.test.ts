import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfig } from "./config.js";

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config with base URL and API key from env var", () => {
    const config = getConfig({});
    expect(config.baseUrl).toBe("https://api.acculynx.com/api/v2");
    expect(config.apiKey).toBe("test-key");
  });

  it("flag overrides env var for API key", () => {
    const config = getConfig({ apiKey: "flag-key" });
    expect(config.apiKey).toBe("flag-key");
  });

  it("throws if API key is missing", () => {
    delete process.env.ACCULYNX_API_KEY;
    expect(() => getConfig({})).toThrow("ACCULYNX_API_KEY");
  });

  it("base URL is always the production URL", () => {
    const config = getConfig({});
    expect(config.baseUrl).toBe("https://api.acculynx.com/api/v2");
  });
});
