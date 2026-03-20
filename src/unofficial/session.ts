import { CookieJar } from "./cookie-jar.js";

export interface UnofficialSession {
  jar: CookieJar;
  companyId: string;
  email: string;
}

export interface Company {
  id: string;
  name: string;
}

/** Follow redirects manually, collecting cookies at every hop. */
async function fetchFollowingCookies(
  jar: CookieJar,
  url: string,
  init?: RequestInit
): Promise<Response> {
  let currentUrl = url;
  let response!: Response;

  for (let i = 0; i < 10; i++) {
    response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
      headers: {
        ...Object.fromEntries(
          Object.entries((init?.headers as Record<string, string>) ?? {})
        ),
        Cookie: jar.headerFor(currentUrl),
      },
    });
    jar.capture(currentUrl, response);

    const location = response.headers.get("Location");
    if (!location || response.status < 300 || response.status >= 400) {
      return response;
    }
    currentUrl = new URL(location, currentUrl).href;
    init = { redirect: "manual" };
  }
  throw new Error("Too many redirects");
}

/** Authenticate and return the jar + location selector HTML (before company selection). */
async function authenticate(
  email: string,
  password: string
): Promise<{ jar: CookieJar; locationHtml: string }> {
  const jar = new CookieJar();

  // 1. GET /signin/ — scrape form action + hidden fields
  const signinResp = await fetchFollowingCookies(
    jar,
    "https://my.acculynx.com/signin/"
  );
  const html = await signinResp.text();

  const actionMatch = html.match(/<form[^>]*action="([^"]*)"/);
  if (!actionMatch) throw new Error("Could not find login form action");
  const formAction = actionMatch[1].replace(/&amp;/g, "&");

  const thumbprint =
    html.match(/name="DeviceThumbprint"[^>]*value="([^"]*)"/)?.[1] ?? "";
  const deviceName =
    html.match(/name="DeviceName"[^>]*value="([^"]*)"/)?.[1] ??
    "Node.js CLI";

  // 2. POST credentials → identity server → callback → location selector
  const body = new URLSearchParams({
    Email: email,
    Password: password,
    DeviceThumbprint: thumbprint,
    DeviceName: deviceName,
  });

  const loginResp = await fetchFollowingCookies(jar, formAction, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  // After login, we may land on LocationSelector or be redirected to dashboard
  // Fetch the location selector page to get available companies
  const locationResp = await fetchFollowingCookies(
    jar,
    "https://my.acculynx.com/signin/LocationSelector"
  );
  const locationHtml = await locationResp.text();

  return { jar, locationHtml };
}

/** Authenticate and list available companies from the location selector. */
export async function listCompanies(
  email: string,
  password: string
): Promise<Company[]> {
  const { locationHtml } = await authenticate(email, password);

  // SwitchCompany links look like:
  //   <a href="/signin/SwitchCompany?CompanyID=f104ba56-...">Leo Roofing & Construction</a>
  const companyPattern =
    /SwitchCompany\?CompanyID=([0-9a-f-]+)"[^>]*>([^<]+)/gi;
  const companies: Company[] = [];
  let match;
  while ((match = companyPattern.exec(locationHtml)) !== null) {
    companies.push({ id: match[1], name: match[2].trim() });
  }

  return companies;
}

export async function login(
  email: string,
  password: string,
  companyId: string
): Promise<UnofficialSession> {
  const { jar } = await authenticate(email, password);

  // Select company/location
  await fetchFollowingCookies(
    jar,
    `https://my.acculynx.com/signin/SwitchCompany?CompanyID=${companyId}`
  );

  return { jar, companyId, email };
}
