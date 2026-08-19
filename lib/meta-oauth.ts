/**
 * Facebook Login (OAuth) → token de usuário → listar/importar BMs.
 * Não usa System User; complementa o fluxo manual de token.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getGraphApiUrl } from '@/lib/meta-api';

const DEFAULT_SCOPES = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'pages_show_list',
  'pages_read_engagement',
  'ads_read',
  'public_profile',
  'email',
].join(',');

export type OAuthStatePayload = {
  u: string; // userId
  e?: string | null; // empresaId opcional p/ auto-import
  n: string; // nonce
  t: number; // unix ms
  r?: string; // return path relativo
};

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.META_APP_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET ou META_APP_SECRET ausente para assinar state OAuth');
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function decodeOAuthState(state: string, maxAgeMs = 15 * 60 * 1000): OAuthStatePayload {
  const [body, sig] = (state || '').split('.');
  if (!body || !sig) throw new Error('State OAuth inválido');
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('State OAuth adulterado');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  if (!payload?.u || !payload?.t || !payload?.n) throw new Error('State OAuth incompleto');
  if (Date.now() - payload.t > maxAgeMs) throw new Error('State OAuth expirado — tente conectar de novo');
  return payload;
}

export function createOAuthNonce(): string {
  return randomBytes(16).toString('hex');
}

export function getPublicBaseUrl(reqUrl?: string): string {
  const env =
    process.env.NEXTAUTH_URL ||
    process.env.SITES_PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (env) {
    const base = env.startsWith('http') ? env : `https://${env}`;
    return base.replace(/\/$/, '');
  }
  if (reqUrl) {
    const u = new URL(reqUrl);
    return `${u.protocol}//${u.host}`;
  }
  return 'http://localhost:3000';
}

export function getOAuthRedirectUri(reqUrl?: string): string {
  return `${getPublicBaseUrl(reqUrl)}/api/meta-api/oauth/callback`;
}

export function buildFacebookAuthUrl(opts: {
  appId: string;
  state: string;
  redirectUri: string;
  scopes?: string;
  version?: string;
}): string {
  const version = opts.version || process.env.META_GRAPH_API_VERSION || 'v21.0';
  const params = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: opts.scopes || process.env.META_OAUTH_SCOPES || DEFAULT_SCOPES,
    response_type: 'code',
    // auth_type=rerequest força re-pedir scopes negados antes
    auth_type: 'rerequest',
  });
  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(opts: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
  version?: string;
}): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const base = getGraphApiUrl(opts.version);
  const params = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
  const res = await fetch(`${base}/oauth/access_token?${params.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error || !json?.access_token) {
    throw new Error(json?.error?.message || 'Falha ao trocar code por access_token');
  }
  return json;
}

/** Troca token de curta duração (~1–2h) por long-lived (~60 dias). */
export async function exchangeForLongLivedToken(opts: {
  appId: string;
  appSecret: string;
  shortToken: string;
  version?: string;
}): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const base = getGraphApiUrl(opts.version);
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.shortToken,
  });
  const res = await fetch(`${base}/oauth/access_token?${params.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error || !json?.access_token) {
    // se falhar, devolve o curto — caller decide
    throw new Error(json?.error?.message || 'Falha ao obter long-lived token');
  }
  return json;
}

export async function resolveMetaAppCredentials(): Promise<{
  appId: string;
  appSecret: string;
  graphApiVersion: string;
  configId?: string;
}> {
  // Prefer DB config ativo; fallback env
  const { prisma } = await import('@/lib/prisma');
  const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
  const appId = config?.appId || process.env.META_APP_ID || '';
  const appSecret = config?.appSecret || process.env.META_APP_SECRET || '';
  const graphApiVersion = config?.graphApiVersion || process.env.META_GRAPH_API_VERSION || 'v21.0';
  if (!appId) throw new Error('Meta App ID não configurado (Integração Meta ou META_APP_ID)');
  if (!appSecret) {
    throw new Error('Meta App Secret não configurado (salve o secret na Integração Meta ou META_APP_SECRET)');
  }
  return { appId, appSecret, graphApiVersion, configId: config?.id };
}

export { DEFAULT_SCOPES };
