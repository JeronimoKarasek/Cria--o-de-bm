export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';
import { previewTrustForEmpresa } from '@/lib/recalc-trust';
import {
  isHostingerConfigured,
  isHostingerLiveEnabled,
  HostingerError,
} from '@/lib/hostinger';
import {
  publishOnApp,
  provisionFreeSub,
  provisionDnsSub,
  publicSiteUrl,
  type ProvisionMode,
} from '@/lib/site-provision';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: Ctx['params']) {
  const p = await Promise.resolve(params);
  return p?.id;
}

const MODES: ProvisionMode[] = [
  'dry-run',
  'local-mark',
  'publish-app',
  'free-sub',
  'dns-sub',
];

/**
 * POST /api/sites-verificacao/[id]/publish
 * body: {
 *   mode?: 'dry-run' | 'local-mark' | 'publish-app' | 'free-sub' | 'dns-sub',
 *   metaPixelId?: string,
 *   publishedUrl?: string,
 *   parentDomain?: string,   // dns-sub
 *   subdomain?: string,      // dns-sub
 *   cnameTarget?: string,    // dns-sub
 *   createHostingSubdomain?: boolean
 * }
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const id = await resolveId(ctx.params);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const rawMode = String(body?.mode || 'dry-run') as ProvisionMode;
    const mode: ProvisionMode = MODES.includes(rawMode) ? rawMode : 'dry-run';
    const metaPixelId = body?.metaPixelId as string | undefined;
    const publishedUrlOverride = body?.publishedUrl as string | undefined;
    const userId = (session?.user as any)?.id;

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 });

    // ---------- dry-run ----------
    if (mode === 'dry-run') {
      const canonicalGuess =
        publishedUrlOverride ||
        site.publishedUrl ||
        (site.dominio
          ? site.dominio.startsWith('http')
            ? site.dominio
            : `https://${site.dominio}`
          : null) ||
        publicSiteUrl(id);

      const input = empresaToTemplateInput(site.empresa, site, {
        metaPixelId,
        canonicalUrl: canonicalGuess,
      });
      const artifact = buildSiteArtifact(input);

      await prisma.siteVerificacao.update({
        where: { id },
        data: { conteudoGerado: artifact.html },
      });

      const trustAtual = await previewTrustForEmpresa(site.empresaId);
      const trustSePublicado = await previewTrustForEmpresa(site.empresaId, {
        forceSiteExists: true,
        forceSitePublicado: true,
      });
      const trustSeSoRascunho = await previewTrustForEmpresa(site.empresaId, {
        forceSiteExists: true,
        forceSitePublicado: false,
      });

      await registrarAuditLog({
        acao: 'DRY_RUN_PUBLISH',
        descricao: `Dry-run publish site ${site.nomeEmpresa} — scoreReady ${artifact.scoreReady}`,
        entidade: 'SiteVerificacao',
        entidadeId: id,
        userId,
        empresaId: site.empresaId,
        metadata: {
          scoreReady: artifact.scoreReady,
          missing: artifact.missing,
          trustAtual: trustAtual.total,
          trustSePublicado: trustSePublicado.total,
          canonicalGuess,
        },
      });

      return NextResponse.json({
        mode: 'dry-run',
        siteId: id,
        empresaId: site.empresaId,
        statusAtual: site.status,
        canonicalGuess,
        publicAppUrl: publicSiteUrl(id),
        artifact: {
          checklist: artifact.checklist,
          scoreReady: artifact.scoreReady,
          missing: artifact.missing,
          robotsTxt: artifact.robotsTxt,
          sitemapXml: artifact.sitemapXml,
          htmlLength: artifact.html.length,
          html: artifact.html,
        },
        trust: {
          atual: trustAtual,
          seRascunhoComSite: trustSeSoRascunho,
          sePublicado: trustSePublicado,
          deltaPublicar: trustSePublicado.total - trustAtual.total,
        },
        nextSteps: [
          artifact.missing.length
            ? `Completar dados: ${artifact.missing.join(', ')}`
            : 'Checklist footprint OK',
          'publish-app: HTML público em /s/{id} (sem Hostinger write)',
          'free-sub: gera *.hostingersite.com + publish-app (FEATURE_HOSTINGER_LIVE)',
          'dns-sub: CNAME em parent Hostinger → Vercel + publish-app',
        ],
        hostinger: {
          configured: isHostingerConfigured(),
          live: isHostingerLiveEnabled(),
          note: isHostingerLiveEnabled()
            ? 'Writes Hostinger habilitados (free-sub / dns-sub).'
            : 'FEATURE_HOSTINGER_LIVE off — use publish-app ou local-mark.',
        },
      });
    }

    // ---------- local-mark (legado E2) ----------
    if (mode === 'local-mark') {
      const url =
        publishedUrlOverride ||
        site.publishedUrl ||
        publicSiteUrl(id);

      const pub = await publishOnApp(id, {
        metaPixelId,
        publishedUrlOverride: url,
        deployProvider: site.deployProvider || 'none',
        dominioStrategy: site.dominioStrategy || 'LOCAL',
      });

      await registrarAuditLog({
        acao: 'PUBLICAR_LOCAL',
        descricao: `Site marcado como publicado (local-mark) — ${pub.publishedUrl}`,
        entidade: 'SiteVerificacao',
        entidadeId: id,
        userId,
        empresaId: site.empresaId,
        metadata: {
          publishedUrl: pub.publishedUrl,
          scoreReady: pub.artifact.scoreReady,
          trustTotal: pub.trust.total,
        },
      });

      return NextResponse.json({
        mode: 'local-mark',
        site: serializeSite(pub.site),
        artifact: slimArtifact(pub.artifact),
        trust: pub.trust,
        publishedUrl: pub.publishedUrl,
        hostinger: { enabled: false, note: 'local-mark sem Hostinger' },
      });
    }

    // ---------- publish-app ----------
    if (mode === 'publish-app') {
      const pub = await publishOnApp(id, {
        metaPixelId,
        publishedUrlOverride: publishedUrlOverride || publicSiteUrl(id),
        deployProvider: 'vercel',
        dominioStrategy: site.dominioStrategy || 'APP',
      });

      await registrarAuditLog({
        acao: 'PUBLICAR_APP',
        descricao: `Site publicado no app — ${pub.publishedUrl}`,
        entidade: 'SiteVerificacao',
        entidadeId: id,
        userId,
        empresaId: site.empresaId,
        metadata: {
          publishedUrl: pub.publishedUrl,
          scoreReady: pub.artifact.scoreReady,
          trustTotal: pub.trust.total,
          publicPath: pub.publicPath,
        },
      });

      return NextResponse.json({
        mode: 'publish-app',
        site: serializeSite(pub.site),
        artifact: slimArtifact(pub.artifact),
        trust: pub.trust,
        publishedUrl: pub.publishedUrl,
        publicPath: pub.publicPath,
        hostinger: {
          configured: isHostingerConfigured(),
          live: isHostingerLiveEnabled(),
          note: 'HTML servido em /s/{id} no Vercel',
        },
      });
    }

    // ---------- free-sub ----------
    if (mode === 'free-sub') {
      try {
        const result = await provisionFreeSub(id, { metaPixelId });
        await registrarAuditLog({
          acao: 'PROVISION_FREE_SUB',
          descricao: `Free-sub ${result.freeSubdomain} + app ${result.publishedUrl}`,
          entidade: 'SiteVerificacao',
          entidadeId: id,
          userId,
          empresaId: site.empresaId,
          metadata: {
            freeSubdomain: result.freeSubdomain,
            publishedUrl: result.publishedUrl,
            jobId: result.jobId,
            trustTotal: result.trust.total,
          },
        });
        return NextResponse.json({
          mode: 'free-sub',
          site: serializeSite(result.site),
          artifact: slimArtifact(result.artifact),
          trust: result.trust,
          publishedUrl: result.publishedUrl,
          freeSubdomain: result.freeSubdomain,
          jobId: result.jobId,
          hostinger: { enabled: true, live: true },
        });
      } catch (err: any) {
        const status = err instanceof HostingerError ? err.status || 500 : 500;
        return NextResponse.json(
          {
            error: err?.message || 'Falha free-sub',
            hostinger: {
              configured: isHostingerConfigured(),
              live: isHostingerLiveEnabled(),
            },
            body: err?.body,
          },
          { status: status >= 400 && status < 600 ? status : 500 }
        );
      }
    }

    // ---------- dns-sub ----------
    if (mode === 'dns-sub') {
      try {
        const result = await provisionDnsSub(id, {
          metaPixelId,
          parentDomain: body?.parentDomain,
          subdomain: body?.subdomain,
          cnameTarget: body?.cnameTarget,
          createHostingSubdomain: body?.createHostingSubdomain,
        });
        await registrarAuditLog({
          acao: 'PROVISION_DNS_SUB',
          descricao: `DNS-sub ${result.fqdn} → ${result.cnameTarget}`,
          entidade: 'SiteVerificacao',
          entidadeId: id,
          userId,
          empresaId: site.empresaId,
          metadata: {
            fqdn: result.fqdn,
            publishedUrl: result.publishedUrl,
            jobId: result.jobId,
            steps: result.steps,
            trustTotal: result.trust.total,
          },
        });
        return NextResponse.json({
          mode: 'dns-sub',
          site: serializeSite(result.site),
          artifact: slimArtifact(result.artifact),
          trust: result.trust,
          publishedUrl: result.publishedUrl,
          fqdn: result.fqdn,
          cnameTarget: result.cnameTarget,
          parentDomain: result.parentDomain,
          subdomain: result.subdomain,
          steps: result.steps,
          appFallbackUrl: result.appFallbackUrl,
          jobId: result.jobId,
          hostinger: { enabled: true, live: true },
        });
      } catch (err: any) {
        const status = err instanceof HostingerError ? err.status || 500 : 500;
        return NextResponse.json(
          {
            error: err?.message || 'Falha dns-sub',
            hostinger: {
              configured: isHostingerConfigured(),
              live: isHostingerLiveEnabled(),
            },
            body: err?.body,
          },
          { status: status >= 400 && status < 600 ? status : 500 }
        );
      }
    }

    return NextResponse.json({ error: `mode inválido: ${mode}` }, { status: 400 });
  } catch (error: any) {
    console.error('Publish site error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar publish' },
      { status: 500 }
    );
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  const id = await resolveId(ctx.params);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 });

    const input = empresaToTemplateInput(site.empresa, site, {
      canonicalUrl: site.publishedUrl || publicSiteUrl(id),
    });
    const artifact = buildSiteArtifact(input);
    const trustAtual = await previewTrustForEmpresa(site.empresaId);
    const trustSePublicado = await previewTrustForEmpresa(site.empresaId, {
      forceSiteExists: true,
      forceSitePublicado: true,
    });

    return NextResponse.json({
      mode: 'dry-run',
      siteId: id,
      publicAppUrl: publicSiteUrl(id),
      artifact: {
        checklist: artifact.checklist,
        scoreReady: artifact.scoreReady,
        missing: artifact.missing,
        htmlLength: artifact.html.length,
      },
      trust: {
        atual: trustAtual,
        sePublicado: trustSePublicado,
        deltaPublicar: trustSePublicado.total - trustAtual.total,
      },
      hostinger: {
        configured: isHostingerConfigured(),
        live: isHostingerLiveEnabled(),
      },
    });
  } catch (error: any) {
    console.error('Publish GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

function slimArtifact(artifact: {
  checklist: unknown;
  scoreReady: number;
  missing: string[];
  robotsTxt?: string;
  sitemapXml?: string;
}) {
  return {
    checklist: artifact.checklist,
    scoreReady: artifact.scoreReady,
    missing: artifact.missing,
    robotsTxt: artifact.robotsTxt,
    sitemapXml: artifact.sitemapXml,
  };
}

function serializeSite(site: any) {
  return {
    ...site,
    createdAt: site.createdAt?.toISOString?.() ?? site.createdAt ?? '',
    updatedAt: site.updatedAt?.toISOString?.() ?? site.updatedAt ?? '',
    publishedAt: site.publishedAt?.toISOString?.() ?? site.publishedAt ?? null,
  };
}
