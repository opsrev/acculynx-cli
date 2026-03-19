export interface AccuLynxConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ConfigOptions {
  apiKey?: string;
}

const BASE_URL = "https://api.acculynx.com/api/v2";

export function getConfig(options: ConfigOptions): AccuLynxConfig {
  const apiKey = options.apiKey ?? process.env.ACCULYNX_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing required credential: ACCULYNX_API_KEY (set env var or pass --api-key)"
    );
  }

  return {
    baseUrl: BASE_URL,
    apiKey,
  };
}
