/**
 * E3 — provision híbrido de sites de verificação.
 *
 * Hostinger files API = read-only → HTML é servido no app (Vercel) em /s/{id}.
 * Hostinger entra para: free-sub (nome), DNS L1 (CNAME), subdomínio no parent.
 *
 * Flags:
 * - FEATURE_HOSTINGER_LIVE=true → permite writes Hostinger (free-sub/DNS)
 * - HOSTINGER_DEFAULT_PARENT_DOMAIN → parent p/ SUB (ex.: futpass.store)
 * - SITES_PUBLIC_BASE_URL → base canônica (default NEXTAUTH_URL)
 * - VERCEL_TOKEN + VERCEL_PROJECT_ID → add domain no projeto (opcional L1)
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  HostingerError,
  generateFreeSubdomain,
  updateDnsZone,
  createWebsiteSubdomain,
  listWebsites,
  isHostingerConfigured,
  isHostingerLiveEnabled,
} from '@/lib/hostinger';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';
import { recalcTrustForEmpresa } from '@/lib/recalc-trust';

export type ProvisionMode =
  | 'dry-run'
  | 'local-mark'
  | 'publish-app'
  | 'free-sub'
  | 'dns-sub'
  | 'unpublish'
  | 'rollback';

export function getSitesPublicBaseUrl(): string {
  const raw =
    process.env.SITES_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export function publicSitePath(siteId: string): string {
  return `/s/${siteId}`;
}

export function publicSiteUrl(siteId: string): string {
  return `${getSitesPublicBaseUrl()}${publicSitePath(siteId)}`;
}

export function slugifySubdomain(input: string, fallback: string): string {
  const base = String(input || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || `bm-${fallback.slice(0, 8)}`;
}

function vercelConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_TOKEN?.trim() &&
      (process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_NAME?.trim())
  );
}

async function addDomainToVercel(domain: string): Promise<{ ok: boolean; detail?: unknown; error?: string }> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId =
    process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_PROJECT_NAME?.trim();
  if (!token || !projectId) {
    return { ok: false, error: 'VERCEL_TOKEN/VERCEL_PROJECT_ID ausente — DNS ok, domain no projeto manual' };
  }
  const team = process.env.VERCEL_TEAM_ID?.trim();
  const qs = team ? `?teamId=${encodeURIComponent(team)}` : '';
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${qs}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    // 409 = already exists → ok
    if (res.ok || res.status === 409) {
      return { ok: true, detail: body };
    }
    return {
      ok: false,
      error: (body as any)?.error?.message || `Vercel domain HTTP ${res.status}`,
      detail: body,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha Vercel domains API' };
  }
}

export async function buildArtifactForSite(
  siteId: string,
  extras?: { metaPixelId?: string; canonicalUrl?: string | null }
) {
  const site = await prisma.siteVerificacao.findUnique({
    where: { id: siteId },
    include: { empresa: true },
  });
  if (!site) throw new Error('Site não encontrado');

  const canonical =
    extras?.canonicalUrl ||
    site.publishedUrl ||
    (site.dominio
      ? site.dominio.startsWith('http')
        ? site.dominio
        : `https://${site.dominio}`
      : null) ||
    publicSiteUrl(siteId);

  const input = empresaToTemplateInput(site.empresa, site, {
    metaPixelId: extras?.metaPixelId,
    canonicalUrl: canonical,
  });
  const artifact = buildSiteArtifact(input);
  return { site, artifact, canonical };
}

/**
 * Publica no app (Vercel): salva HTML e marca publishedUrl = /s/{id}.
 * Sempre disponível; não depende de Hostinger write.
 */
export async function publishOnApp(
  siteId: string,
  opts?: {
    metaPixelId?: string;
    publishedUrlOverride?: string;
    deployProvider?: string;
    dominioStrategy?: string | null;
    hostingerDomain?: string | null;
    parentDomain?: string | null;
    hostingerRef?: string | null;
    clearError?: boolean;
  }
) {
  const { site, artifact, canonical } = await buildArtifactForSite(siteId, {
    metaPixelId: opts?.metaPixelId,
    canonicalUrl: opts?.publishedUrlOverride || undefined,
  });

  const url = opts?.publishedUrlOverride || publicSiteUrl(siteId);

  const updated = await prisma.siteVerificacao.update({
    where: { id: siteId },
    data: {
      status: 'publicado',
      publishedUrl: url,
      publishedAt: new Date(),
      deployProvider: opts?.deployProvider || 'vercel',
      conteudoGerado: artifact.html,
      lastPublishError: opts?.clearError === false ? site.lastPublishError : null,
      ...(opts?.dominioStrategy !== undefined
        ? { dominioStrategy: opts.dominioStrategy }
        : {}),
      ...(opts?.hostingerDomain !== undefined
        ? { hostingerDomain: opts.hostingerDomain, dominio: opts.hostingerDomain }
        : {}),
      ...(opts?.parentDomain !== undefined ? { parentDomain: opts.parentDomain } : {}),
      ...(opts?.hostingerRef !== undefined ? { hostingerRef: opts.hostingerRef } : {}),
    },
  });

  const trust = await recalcTrustForEmpresa(site.empresaId);

  return {
    site: updated,
    artifact,
    publishedUrl: url,
    canonical,
    trust,
    publicPath: publicSitePath(siteId),
  };
}

/**
 * L0: gera free-sub Hostinger + publica no app.
 * Free-sub fica em hostingerDomain (identidade/footprint); conteúdo em /s/{id}.
 */
export async function provisionFreeSub(
  siteId: string,
  opts?: { metaPixelId?: string }
) {
  if (!isHostingerConfigured()) {
    throw new HostingerError('HOSTINGER_API_TOKEN não configurado', 500);
  }
  if (!isHostingerLiveEnabled()) {
    throw new HostingerError(
      'FEATURE_HOSTINGER_LIVE=false — free-sub bloqueado (set true p/ write)',
      403
    );
  }

  const job = await prisma.provisionJob.create({
    data: {
      type: 'FREE_SUB',
      status: 'running',
      payload: JSON.stringify({ siteId }),
      attempts: 1,
      siteId,
      startedAt: new Date(),
    },
  });

  try {
    const free = await generateFreeSubdomain();
    const domain = free.domain;
    if (!domain) throw new HostingerError('Free-sub sem domain na resposta', 502, free);

    const pub = await publishOnApp(siteId, {
      metaPixelId: opts?.metaPixelId,
      // URL pública canônica continua no app (files Hostinger = RO)
      publishedUrlOverride: publicSiteUrl(siteId),
      deployProvider: 'vercel+hostinger-free-sub',
      dominioStrategy: 'FREE_SUB',
      hostingerDomain: domain,
      hostingerRef: domain,
      clearError: true,
    });

    await prisma.provisionJob.update({
      where: { id: job.id },
      data: {
        status: 'success',
        result: JSON.stringify({
          freeSubdomain: domain,
          publishedUrl: pub.publishedUrl,
          note: 'HTML servido no app; free-sub Hostinger registrado como hostingerDomain',
        }),
        finishedAt: new Date(),
      },
    });

    return {
      ...pub,
      freeSubdomain: domain,
      jobId: job.id,
      hostingerLive: true,
    };
  } catch (err: any) {
    const msg = err?.message || 'Falha free-sub';
    await prisma.provisionJob.update({
      where: { id: job.id },
      data: {
        status: 'error',
        result: JSON.stringify({ error: msg, body: err?.body }),
        finishedAt: new Date(),
      },
    });
    await prisma.siteVerificacao.update({
      where: { id: siteId },
      data: { lastPublishError: msg },
    });
    throw err;
  }
}

/**
 * L1: CNAME {sub}.{parent} → target (default cname.vercel-dns.com) + publish app.
 * Opcional: cria subdomain no painel hosting + add domain no Vercel.
 */
export async function provisionDnsSub(
  siteId: string,
  opts?: {
    metaPixelId?: string;
    parentDomain?: string;
    subdomain?: string;
    cnameTarget?: string;
    createHostingSubdomain?: boolean;
  }
) {
  if (!isHostingerConfigured()) {
    throw new HostingerError('HOSTINGER_API_TOKEN não configurado', 500);
  }
  if (!isHostingerLiveEnabled()) {
    throw new HostingerError(
      'FEATURE_HOSTINGER_LIVE=false — DNS-sub bloqueado (set true p/ write)',
      403
    );
  }

  const site = await prisma.siteVerificacao.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('Site não encontrado');

  const parent =
    (opts?.parentDomain ||
      site.parentDomain ||
      process.env.HOSTINGER_DEFAULT_PARENT_DOMAIN ||
      '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');

  if (!parent) {
    throw new Error(
      'parentDomain obrigatório (body.parentDomain ou HOSTINGER_DEFAULT_PARENT_DOMAIN)'
    );
  }

  const sub =
    opts?.subdomain?.trim().toLowerCase() ||
    slugifySubdomain(site.nomeEmpresa || site.dominio || '', siteId);
  const fqdn = `${sub}.${parent}`;
  const cnameTarget = (opts?.cnameTarget || process.env.SITES_CNAME_TARGET || 'cname.vercel-dns.com')
    .trim()
    .replace(/\.$/, '');

  const job = await prisma.provisionJob.create({
    data: {
      type: 'DNS_SUB',
      status: 'running',
      payload: JSON.stringify({ siteId, parent, sub, fqdn, cnameTarget }),
      attempts: 1,
      siteId,
      startedAt: new Date(),
    },
  });

  const steps: Record<string, unknown> = {};

  try {
    // 1) DNS CNAME no parent (overwrite só o name/type do sub)
    await updateDnsZone(parent, {
      overwrite: true,
      zone: [
        {
          name: sub,
          type: 'CNAME',
          ttl: 300,
          records: [{ content: `${cnameTarget}.` }],
        },
      ],
    });
    steps.dns = { ok: true, name: sub, type: 'CNAME', content: cnameTarget };

    // 2) opcional: subdomain no hosting (document root) — best-effort
    if (opts?.createHostingSubdomain !== false) {
      try {
        const websites = await listWebsites();
        const parentSite =
          websites.find((w) => w.domain === parent) ||
          websites.find((w) => (w.domain || '').endsWith(parent));
        if (parentSite?.username) {
          await createWebsiteSubdomain(parentSite.username, parent, {
            subdomain: sub,
            is_using_public_directory: true,
          });
          steps.hostingSubdomain = { ok: true, username: parentSite.username };
        } else {
          steps.hostingSubdomain = {
            ok: false,
            error: `Website parent ${parent} não encontrado na conta Hostinger`,
          };
        }
      } catch (e: any) {
        steps.hostingSubdomain = {
          ok: false,
          error: e?.message || 'Falha create subdomain hosting',
          status: e?.status,
        };
      }
    }

    // 3) add domain no Vercel (best-effort)
    let vercelDomain: { ok: boolean; detail?: unknown; error?: string } = {
      ok: false,
      error: 'skip',
    };
    if (vercelConfigured()) {
      vercelDomain = await addDomainToVercel(fqdn);
    } else {
      vercelDomain = {
        ok: false,
        error: 'VERCEL_TOKEN/PROJECT ausente — adicione o domínio manualmente no projeto',
      };
    }
    steps.vercelDomain = vercelDomain;

    // 4) publish no app; publishedUrl preferencialmente https://fqdn (quando DNS propagar)
    //    fallback canônico no app se domínio ainda não estiver no Vercel
    const preferredUrl = vercelDomain.ok
      ? `https://${fqdn}`
      : publicSiteUrl(siteId);

    const pub = await publishOnApp(siteId, {
      metaPixelId: opts?.metaPixelId,
      publishedUrlOverride: preferredUrl,
      deployProvider: 'vercel+hostinger-dns',
      dominioStrategy: 'SUB',
      hostingerDomain: fqdn,
      parentDomain: parent,
      hostingerRef: JSON.stringify({ sub, parent, cnameTarget, steps }),
      clearError: true,
    });

    // também grava URL do app como referência se preferred for FQDN
    if (preferredUrl.startsWith('https://') && !preferredUrl.includes('/s/')) {
      // ok — host custom
    }

    await prisma.provisionJob.update({
      where: { id: job.id },
      data: {
        status: 'success',
        result: JSON.stringify({
          fqdn,
          publishedUrl: pub.publishedUrl,
          appFallback: publicSiteUrl(siteId),
          steps,
        }),
        finishedAt: new Date(),
      },
    });

    return {
      ...pub,
      fqdn,
      cnameTarget,
      parentDomain: parent,
      subdomain: sub,
      steps,
      jobId: job.id,
      hostingerLive: true,
      appFallbackUrl: publicSiteUrl(siteId),
    };
  } catch (err: any) {
    const msg = err?.message || 'Falha dns-sub';
    await prisma.provisionJob.update({
      where: { id: job.id },
      data: {
        status: 'error',
        result: JSON.stringify({ error: msg, body: err?.body, steps }),
        finishedAt: new Date(),
      },
    });
    await prisma.siteVerificacao.update({
      where: { id: siteId },
      data: { lastPublishError: msg },
    });
    throw err;
  }
}

/**
 * E4 — tira o site do ar (status rascunho, limpa publishedUrl).
 * Não apaga conteudoGerado (permite republicar). DNS Hostinger NÃO é removido
 * automaticamente (requer delete zone manual/API admin) — ver runbook.
 */
export async function unpublishSite(
  siteId: string,
  opts?: { reason?: string; clearHostingerMeta?: boolean }
) {
  const site = await prisma.siteVerificacao.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('Site não encontrado');

  const reason = (opts?.reason || 'unpublish').slice(0, 500);
  const updated = await prisma.siteVerificacao.update({
    where: { id: siteId },
    data: {
      status: 'rascunho',
      publishedUrl: null,
      publishedAt: null,
      lastPublishError: null,
      deployProvider: site.deployProvider || 'vercel',
      ...(opts?.clearHostingerMeta
        ? {
            hostingerDomain: null,
            hostingerRef: null,
            parentDomain: null,
            dominioStrategy: 'APP',
          }
        : {}),
    },
  });

  const trust = await recalcTrustForEmpresa(site.empresaId);

  await prisma.provisionJob.create({
    data: {
      type: 'UNPUBLISH',
      status: 'success',
      payload: JSON.stringify({
        siteId,
        reason,
        previousStatus: site.status,
        previousUrl: site.publishedUrl,
        previousDominio: site.dominio,
        clearHostingerMeta: Boolean(opts?.clearHostingerMeta),
      }),
      result: JSON.stringify({ ok: true, status: 'rascunho' }),
      attempts: 1,
      siteId,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  return {
    site: updated,
    trust,
    previousUrl: site.publishedUrl,
    reason,
    note:
      'HTML /s/{id} deixa de servir (só status=publicado). DNS Hostinger, se existir, permanece até remoção manual (runbook E4).',
  };
}

/** Alias runbook */
export async function rollbackSite(
  siteId: string,
  opts?: { reason?: string; clearHostingerMeta?: boolean }
) {
  return unpublishSite(siteId, {
    reason: opts?.reason || 'rollback',
    clearHostingerMeta: opts?.clearHostingerMeta,
  });
}

export function newOpaqueRef(prefix = 'pv'): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}
