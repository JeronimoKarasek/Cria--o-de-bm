/**
 * Hostinger API client — server-only (token never in client bundle).
 * Base: https://developers.hostinger.com
 * Auth: Authorization: Bearer <HOSTINGER_API_TOKEN>
 *
 * E1: read-only + safe helpers. Write/DNS/purchase only used from later stages
 * behind feature flags and ADMIN checks.
 */

const HOSTINGER_BASE =
  process.env.HOSTINGER_API_BASE?.replace(/\/$/, '') ||
  'https://developers.hostinger.com';

export type HostingerDomain = {
  id?: number | string;
  domain: string;
  type?: string;
  status?: string;
  created_at?: string;
  expires_at?: string;
  [key: string]: unknown;
};

export type HostingerWebsite = {
  domain: string;
  vhost_type?: string;
  is_enabled?: boolean;
  username?: string;
  client_id?: number;
  order_id?: number;
  created_at?: string;
  root_directory?: string;
  parent_domain?: string | null;
  [key: string]: unknown;
};

export class HostingerError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'HostingerError';
    this.status = status;
    this.body = body;
  }
}

function getToken(): string {
  const token = process.env.HOSTINGER_API_TOKEN?.trim();
  if (!token) {
    throw new HostingerError('HOSTINGER_API_TOKEN não configurado', 500);
  }
  return token;
}

export function isHostingerConfigured(): boolean {
  return Boolean(process.env.HOSTINGER_API_TOKEN?.trim());
}

async function hostingerFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = path.startsWith('http')
    ? path
    : `${HOSTINGER_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as any).message)
        : `Hostinger HTTP ${res.status}`;
    throw new HostingerError(msg, res.status, body);
  }

  return body as T;
}

/** GET /api/domains/v1/portfolio */
export async function listDomainPortfolio(): Promise<HostingerDomain[]> {
  const data = await hostingerFetch<HostingerDomain[] | { data: HostingerDomain[] }>(
    '/api/domains/v1/portfolio'
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return [];
}

/** GET /api/hosting/v1/websites */
export async function listWebsites(): Promise<HostingerWebsite[]> {
  const data = await hostingerFetch<{ data?: HostingerWebsite[] } | HostingerWebsite[]>(
    '/api/hosting/v1/websites'
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return [];
}

/** GET /api/dns/v1/zones/{domain} */
export async function getDnsZone(domain: string): Promise<unknown> {
  const d = encodeURIComponent(domain);
  return hostingerFetch(`/api/dns/v1/zones/${d}`);
}

/** GET /api/dns/v1/snapshots/{domain} */
export async function listDnsSnapshots(domain: string): Promise<unknown> {
  const d = encodeURIComponent(domain);
  return hostingerFetch(`/api/dns/v1/snapshots/${d}`);
}

/**
 * POST /api/domains/v1/availability
 * Body expects domain names + tlds per Hostinger docs.
 */
export async function checkDomainAvailability(payload: {
  domains?: string[];
  tlds?: string[];
  [key: string]: unknown;
}): Promise<unknown> {
  return hostingerFetch('/api/domains/v1/availability', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** GET /api/hosting/v1/orders */
export async function listHostingOrders(): Promise<unknown> {
  return hostingerFetch('/api/hosting/v1/orders');
}

/** FEATURE_HOSTINGER_LIVE=true habilita writes (free-sub, DNS, subdomain). */
export function isHostingerLiveEnabled(): boolean {
  const v = (process.env.FEATURE_HOSTINGER_LIVE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export type FreeSubdomainResult = {
  domain: string;
  [key: string]: unknown;
};

/** POST /api/hosting/v1/domains/free-subdomains — gera *.hostingersite.com */
export async function generateFreeSubdomain(): Promise<FreeSubdomainResult> {
  const data = await hostingerFetch<FreeSubdomainResult>(
    '/api/hosting/v1/domains/free-subdomains',
    { method: 'POST', body: JSON.stringify({}) }
  );
  return data;
}

export type DnsZoneUpdate = {
  overwrite?: boolean;
  zone: Array<{
    name: string;
    type: string;
    ttl?: number;
    records: Array<{ content: string }>;
  }>;
};

/** PUT /api/dns/v1/zones/{domain} */
export async function updateDnsZone(
  domain: string,
  payload: DnsZoneUpdate
): Promise<unknown> {
  const d = encodeURIComponent(domain);
  return hostingerFetch(`/api/dns/v1/zones/${d}`, {
    method: 'PUT',
    body: JSON.stringify({
      overwrite: payload.overwrite ?? true,
      zone: payload.zone,
    }),
  });
}

/** DELETE /api/dns/v1/zones/{domain} — filters name+type */
export async function deleteDnsRecords(
  domain: string,
  filters: Array<{ name: string; type: string }>
): Promise<unknown> {
  const d = encodeURIComponent(domain);
  return hostingerFetch(`/api/dns/v1/zones/${d}`, {
    method: 'DELETE',
    body: JSON.stringify({ filters }),
  });
}

/** POST /api/hosting/v1/accounts/{username}/websites/{domain}/subdomains */
export async function createWebsiteSubdomain(
  username: string,
  parentDomain: string,
  body: {
    subdomain: string;
    directory?: string | null;
    is_using_public_directory?: boolean;
  }
): Promise<unknown> {
  const u = encodeURIComponent(username);
  const d = encodeURIComponent(parentDomain);
  return hostingerFetch(
    `/api/hosting/v1/accounts/${u}/websites/${d}/subdomains`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

/** GET /api/hosting/v1/accounts/{username}/websites/{domain}/subdomains */
export async function listWebsiteSubdomains(
  username: string,
  parentDomain: string
): Promise<unknown> {
  const u = encodeURIComponent(username);
  const d = encodeURIComponent(parentDomain);
  return hostingerFetch(
    `/api/hosting/v1/accounts/${u}/websites/${d}/subdomains`
  );
}

/**
 * Health/status aggregate for admin dashboard (read-only).
 * Never returns the raw token.
 */
export async function getHostingerStatus(): Promise<{
  configured: boolean;
  ok: boolean;
  baseUrl: string;
  domainsCount: number;
  websitesCount: number;
  domains: Array<{ domain: string; status?: string; type?: string }>;
  websites: Array<{ domain: string; vhost_type?: string; username?: string }>;
  error?: string;
}> {
  if (!isHostingerConfigured()) {
    return {
      configured: false,
      ok: false,
      baseUrl: HOSTINGER_BASE,
      domainsCount: 0,
      websitesCount: 0,
      domains: [],
      websites: [],
      error: 'HOSTINGER_API_TOKEN ausente',
    };
  }

  try {
    const [domains, websites] = await Promise.all([
      listDomainPortfolio(),
      listWebsites(),
    ]);

    return {
      configured: true,
      ok: true,
      baseUrl: HOSTINGER_BASE,
      domainsCount: domains.length,
      websitesCount: websites.length,
      domains: domains.map((d) => ({
        domain: d.domain,
        status: d.status,
        type: d.type,
      })),
      websites: websites.map((w) => ({
        domain: w.domain,
        vhost_type: w.vhost_type,
        username: w.username,
      })),
    };
  } catch (err: any) {
    return {
      configured: true,
      ok: false,
      baseUrl: HOSTINGER_BASE,
      domainsCount: 0,
      websitesCount: 0,
      domains: [],
      websites: [],
      error: err?.message || 'Falha ao consultar Hostinger',
    };
  }
}
