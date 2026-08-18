export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';
import { recalcTrustForEmpresa } from '@/lib/recalc-trust';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const sites = await prisma.siteVerificacao.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        empresa: {
          select: {
            id: true,
            nomeFantasia: true,
            razaoSocial: true,
            cnpj: true,
            trustScore: true,
            email: true,
            telefone: true,
            website: true,
          },
        },
      },
    });

    return NextResponse.json(
      (sites ?? []).map((s: any) => ({
        ...(s ?? {}),
        createdAt: s?.createdAt?.toISOString?.() ?? '',
        updatedAt: s?.updatedAt?.toISOString?.() ?? '',
        publishedAt: s?.publishedAt?.toISOString?.() ?? null,
      }))
    );
  } catch (error: any) {
    console.error('List sites error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const {
      empresaId,
      dominio,
      template,
      segmento,
      nomeEmpresa,
      descricao,
      corPrimaria,
      corSecundaria,
      incluirTermos,
      incluirPrivacidade,
      incluirLgpd,
      metaPixelId,
      regenerateOnly,
      siteId,
    } = body ?? {};

    // Regenerar conteúdo de site existente
    if (regenerateOnly && siteId) {
      const existing = await prisma.siteVerificacao.findUnique({
        where: { id: siteId },
        include: { empresa: true },
      });
      if (!existing) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 });

      const input = empresaToTemplateInput(existing.empresa, {
        ...existing,
        nomeEmpresa: nomeEmpresa ?? existing.nomeEmpresa,
        segmento: segmento ?? existing.segmento,
        descricao: descricao ?? existing.descricao,
        dominio: dominio ?? existing.dominio,
        corPrimaria: corPrimaria ?? existing.corPrimaria,
        corSecundaria: corSecundaria ?? existing.corSecundaria,
        incluirTermos: incluirTermos ?? existing.incluirTermos,
        incluirPrivacidade: incluirPrivacidade ?? existing.incluirPrivacidade,
        incluirLgpd: incluirLgpd ?? existing.incluirLgpd,
      }, { metaPixelId });

      const artifact = buildSiteArtifact(input);
      const updated = await prisma.siteVerificacao.update({
        where: { id: siteId },
        data: {
          conteudoGerado: artifact.html,
          ...(nomeEmpresa ? { nomeEmpresa } : {}),
          ...(segmento ? { segmento } : {}),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(dominio !== undefined ? { dominio } : {}),
          ...(corPrimaria ? { corPrimaria } : {}),
          ...(corSecundaria ? { corSecundaria } : {}),
        },
      });

      await registrarAuditLog({
        acao: 'ATUALIZAR',
        descricao: `Site BMS regenerado (template Meta-ready) — scoreReady ${artifact.scoreReady}`,
        entidade: 'SiteVerificacao',
        entidadeId: siteId,
        userId: (session?.user as any)?.id,
        empresaId: existing.empresaId,
        metadata: { scoreReady: artifact.scoreReady, missing: artifact.missing },
      });

      // Site existe → pode subir trust (ainda não publicado)
      let trust = null;
      try {
        trust = await recalcTrustForEmpresa(existing.empresaId);
      } catch (e) {
        console.error('recalc trust after regenerate:', e);
      }

      return NextResponse.json({
        site: {
          ...updated,
          createdAt: updated.createdAt?.toISOString?.() ?? '',
          updatedAt: updated.updatedAt?.toISOString?.() ?? '',
        },
        artifact: {
          checklist: artifact.checklist,
          scoreReady: artifact.scoreReady,
          missing: artifact.missing,
          robotsTxt: artifact.robotsTxt,
          sitemapXml: artifact.sitemapXml,
        },
        trust,
      });
    }

    if (!empresaId || !segmento || !nomeEmpresa) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    const input = empresaToTemplateInput(
      empresa,
      {
        nomeEmpresa,
        segmento,
        descricao,
        dominio,
        corPrimaria: corPrimaria ?? '#1877F2',
        corSecundaria: corSecundaria ?? '#42B72A',
        incluirTermos: incluirTermos ?? true,
        incluirPrivacidade: incluirPrivacidade ?? true,
        incluirLgpd: incluirLgpd ?? true,
      },
      { metaPixelId }
    );

    const artifact = buildSiteArtifact(input);

    const site = await prisma.siteVerificacao.create({
      data: {
        empresaId,
        dominio: dominio ?? null,
        template: template ?? 'institucional',
        segmento,
        nomeEmpresa,
        descricao: descricao ?? null,
        corPrimaria: corPrimaria ?? '#1877F2',
        corSecundaria: corSecundaria ?? '#42B72A',
        incluirTermos: incluirTermos ?? true,
        incluirPrivacidade: incluirPrivacidade ?? true,
        incluirLgpd: incluirLgpd ?? true,
        conteudoGerado: artifact.html,
        status: 'rascunho',
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Site BMS Meta-ready gerado para ${nomeEmpresa} (scoreReady ${artifact.scoreReady})`,
      entidade: 'SiteVerificacao',
      entidadeId: site?.id,
      userId: (session?.user as any)?.id,
      empresaId,
      metadata: { scoreReady: artifact.scoreReady, missing: artifact.missing },
    });

    let trust = null;
    try {
      trust = await recalcTrustForEmpresa(empresaId);
    } catch (e) {
      console.error('recalc trust after create site:', e);
    }

    return NextResponse.json(
      {
        ...(site ?? {}),
        createdAt: site?.createdAt?.toISOString?.() ?? '',
        updatedAt: site?.updatedAt?.toISOString?.() ?? '',
        artifact: {
          checklist: artifact.checklist,
          scoreReady: artifact.scoreReady,
          missing: artifact.missing,
          robotsTxt: artifact.robotsTxt,
          sitemapXml: artifact.sitemapXml,
        },
        trust,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create site error:', error);
    return NextResponse.json({ error: 'Erro ao criar site' }, { status: 500 });
  }
}
