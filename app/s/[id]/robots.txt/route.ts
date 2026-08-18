export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildSiteArtifact, empresaToTemplateInput } from '@/lib/site-template';
import { publicSiteUrl } from '@/lib/site-provision';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: Ctx['params']) {
  const p = await Promise.resolve(params);
  return p?.id;
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) return new NextResponse('Not found', { status: 404 });

    const site = await prisma.siteVerificacao.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!site || site.status !== 'publicado') {
      return new NextResponse('Not found', { status: 404 });
    }

    const canonical = site.publishedUrl || publicSiteUrl(id);
    const input = empresaToTemplateInput(site.empresa, site, {
      canonicalUrl: canonical,
    });
    const { robotsTxt } = buildSiteArtifact(input);

    return new NextResponse(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return new NextResponse('Erro', { status: 500 });
  }
}
