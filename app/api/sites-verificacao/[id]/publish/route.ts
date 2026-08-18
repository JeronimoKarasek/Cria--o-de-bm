export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';
import { previewTrustForEmpresa, recalcTrustForEmpresa } from '@/lib/recalc-trust';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: Ctx['params']) {
  const p = await Promise.resolve(params);
  return p?.id;
}

/**
 * POST /api/sites-verificacao/[id]/publish
 * body: { mode?: 'dry-run' | 'local-mark', metaPixelId?: string, publishedUrl?: string }
 *
 * dry-run (default): gera artefato + checklist + preview de trust SEM alterar status/publicação real.
 * local-mark: marca status=publicado com URL local/simulada e recalcula trust (sem Hostinger — E3).
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const id = await resolveId(ctx.params);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const mode = (body?.mode === 'local-mark' ? 'local-mark' : 'dry-run') as 'dry-run' | 'local-mark';
    const metaPixelId = body?.metaPixelId as string | undefined;
    const publishedUrlOverride = body?.publishedUrl as string | undefined;

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 });

    const canonicalGuess =
      publishedUrlOverride ||
      site.publishedUrl ||
      (site.dominio
        ? site.dominio.startsWith('http')
          ? site.dominio
          : `https://${site.dominio}`
        : null) ||
      site.empresa?.website ||
      null;

    const input = empresaToTemplateInput(site.empresa, site, {
      metaPixelId,
      canonicalUrl: canonicalGuess,
    });
    const artifact = buildSiteArtifact(input);

    // Atualiza HTML gerado sempre (rascunho melhorado)
    await prisma.siteVerificacao.update({
      where: { id },
      data: { conteudoGerado: artifact.html },
    });

    if (mode === 'dry-run') {
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
        userId: (session?.user as any)?.id,
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
        artifact: {
          checklist: artifact.checklist,
          scoreReady: artifact.scoreReady,
          missing: artifact.missing,
          robotsTxt: artifact.robotsTxt,
          sitemapXml: artifact.sitemapXml,
          htmlLength: artifact.html.length,
          // html completo para preview no client
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
          'E3: provisionar domínio/subdomínio Hostinger e apontar DNS',
          'E3: publicar HTML + robots + sitemap no destino real',
          'Após publish real: mode=local-mark ou worker PUBLISH_SITE',
        ],
        hostinger: {
          enabled: false,
          note: 'Deploy Hostinger desabilitado neste endpoint (E2 dry-run only).',
        },
      });
    }

    // local-mark: simula publicação sem Hostinger
    const url =
      publishedUrlOverride ||
      site.publishedUrl ||
      (site.dominio
        ? site.dominio.startsWith('http')
          ? site.dominio
          : `https://${site.dominio}`
        : null) ||
      `https://local-preview.invalid/sites/${id}`;

    const updated = await prisma.siteVerificacao.update({
      where: { id },
      data: {
        status: 'publicado',
        publishedUrl: url,
        publishedAt: new Date(),
        deployProvider: site.deployProvider || 'none',
        lastPublishError: null,
        conteudoGerado: artifact.html,
      },
    });

    const trust = await recalcTrustForEmpresa(site.empresaId);

    await registrarAuditLog({
      acao: 'PUBLICAR_LOCAL',
      descricao: `Site marcado como publicado (local-mark) — ${url}`,
      entidade: 'SiteVerificacao',
      entidadeId: id,
      userId: (session?.user as any)?.id,
      empresaId: site.empresaId,
      metadata: {
        publishedUrl: url,
        scoreReady: artifact.scoreReady,
        trustTotal: trust.total,
      },
    });

    return NextResponse.json({
      mode: 'local-mark',
      site: {
        ...updated,
        createdAt: updated.createdAt?.toISOString?.() ?? '',
        updatedAt: updated.updatedAt?.toISOString?.() ?? '',
        publishedAt: updated.publishedAt?.toISOString?.() ?? null,
      },
      artifact: {
        checklist: artifact.checklist,
        scoreReady: artifact.scoreReady,
        missing: artifact.missing,
        robotsTxt: artifact.robotsTxt,
        sitemapXml: artifact.sitemapXml,
      },
      trust,
      hostinger: {
        enabled: false,
        note: 'Marcado localmente. Publish real Hostinger é E3.',
      },
    });
  } catch (error: any) {
    console.error('Publish site error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao processar publish' },
      { status: 500 }
    );
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  // Atalho: GET = dry-run
  const id = await resolveId(ctx.params);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const fakeReq = new Request('http://local/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'dry-run' }),
  });
  // Reusa POST — mas precisa session no mesmo request; melhor duplicar path via POST only.
  // Para GET autenticado, chamamos a lógica via POST interno não funciona com session cookie do browser se for server-side same.
  // Implementação direta:
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 });

    const input = empresaToTemplateInput(site.empresa, site);
    const artifact = buildSiteArtifact(input);
    const trustAtual = await previewTrustForEmpresa(site.empresaId);
    const trustSePublicado = await previewTrustForEmpresa(site.empresaId, {
      forceSiteExists: true,
      forceSitePublicado: true,
    });

    return NextResponse.json({
      mode: 'dry-run',
      siteId: id,
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
    });
  } catch (error: any) {
    console.error('Publish GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
