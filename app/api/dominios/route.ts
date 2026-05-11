export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { addOwnedDomain, getOwnedDomains } from '@/lib/meta-api';
import { isValidDomain } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const where: any = {};
    if (empresaId) where.empresaId = empresaId;

    const dominios = await prisma.dominioVerificacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { empresa: { select: { nomeFantasia: true } } },
    });

    return NextResponse.json(
      (dominios ?? []).map((d: any) => ({
        ...d,
        createdAt: d.createdAt?.toISOString?.() ?? '',
        updatedAt: d.updatedAt?.toISOString?.() ?? '',
        ultimoCheck: d.ultimoCheck?.toISOString?.() ?? null,
      }))
    );
  } catch (err: any) {
    console.error('List dominios error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * Cadastra um domínio na empresa e (se businessId fornecido) o adiciona à BM via Graph API.
 * Body: { empresaId, dominio, businessId?, contaMetaId? }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { empresaId, dominio, contaMetaId } = body ?? {};

    if (!empresaId || !dominio) {
      return NextResponse.json({ error: 'empresaId e dominio são obrigatórios' }, { status: 400 });
    }
    if (!isValidDomain(dominio)) {
      return NextResponse.json({ error: 'Domínio inválido' }, { status: 400 });
    }

    // Tenta registrar na Meta API se houver contaMeta vinculada
    let domainId: string | null = null;
    let metaErrors: string | null = null;
    if (contaMetaId) {
      const conta = await prisma.contaMeta.findUnique({ where: { id: contaMetaId } });
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      const token = conta?.accessToken ?? config?.accessToken ?? process.env.META_SYSTEM_USER_TOKEN;
      const version = config?.graphApiVersion ?? 'v21.0';
      if (conta?.metaBusinessId && token) {
        const r = await addOwnedDomain(conta.metaBusinessId, dominio, token, version);
        if (r.success) domainId = r.data?.id ?? null;
        else metaErrors = r.error;
      }
    }

    const novo = await prisma.dominioVerificacao.upsert({
      where: { empresaId_dominio: { empresaId, dominio } },
      update: { domainId: domainId ?? undefined },
      create: {
        empresaId,
        dominio,
        domainId,
        verificado: false,
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Domínio ${dominio} cadastrado`,
      entidade: 'DominioVerificacao',
      entidadeId: novo.id,
      userId: (session?.user as any)?.id,
      empresaId,
      metadata: metaErrors ? { metaErrors } : undefined,
    });

    return NextResponse.json(
      {
        ...novo,
        createdAt: novo.createdAt?.toISOString?.() ?? '',
        updatedAt: novo.updatedAt?.toISOString?.() ?? '',
        metaErrors,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create dominio error:', err);
    return NextResponse.json({ error: 'Erro ao salvar domínio' }, { status: 500 });
  }
}
