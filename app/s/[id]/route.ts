export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: Ctx['params']) {
  const p = await Promise.resolve(params);
  return p?.id;
}

/**
 * GET /s/{id} — HTML público do site de verificação (E3).
 * Serve conteudoGerado ou regenera a partir do template.
 * Sem auth (footprint público para Meta).
 */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return new NextResponse('Not found', { status: 404 });
    }

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });

    if (!site) {
      return new NextResponse('Site não encontrado', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Só serve se publicado OU se tem conteúdo (preview interno via auth no dashboard)
    // Público: requer status publicado para evitar vazar rascunhos
    if (site.status !== 'publicado') {
      return new NextResponse('Site ainda não publicado', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    let html = site.conteudoGerado;
    if (!html || html.length < 100) {
      const canonical =
        site.publishedUrl ||
        (site.dominio
          ? site.dominio.startsWith('http')
            ? site.dominio
            : `https://${site.dominio}`
          : null);
      const input = empresaToTemplateInput(site.empresa, site, {
        canonicalUrl: canonical,
      });
      html = buildSiteArtifact(input).html;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (err: any) {
    console.error('GET /s/[id] error:', err);
    return new NextResponse('Erro interno', { status: 500 });
  }
}
