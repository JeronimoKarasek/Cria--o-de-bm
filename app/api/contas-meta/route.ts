export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && status !== 'TODOS') where.status = status;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { metaBusinessId: { contains: search, mode: 'insensitive' } },
        { empresa: { nomeFantasia: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const contas = await prisma.contaMeta.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        empresa: { select: { nomeFantasia: true, cnpj: true } },
        historicoStatus: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    return NextResponse.json(
      (contas ?? []).map((c: any) => ({
        ...(c ?? {}),
        createdAt: c?.createdAt?.toISOString?.() ?? '',
        updatedAt: c?.updatedAt?.toISOString?.() ?? '',
        dataRestricao: c?.dataRestricao?.toISOString?.() ?? null,
        dataRecurso: c?.dataRecurso?.toISOString?.() ?? null,
        historicoStatus: (c?.historicoStatus ?? []).map((h: any) => ({
          ...h,
          createdAt: h?.createdAt?.toISOString?.() ?? '',
        })),
      }))
    );
  } catch (error: any) {
    console.error('List contas error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { nome, metaBusinessId, adAccountId, wabaId, accessToken, tipo, empresaId, observacoes, status: statusInicial } = body ?? {};

    if (!nome || !empresaId) {
      return NextResponse.json({ error: 'Nome e empresa são obrigatórios' }, { status: 400 });
    }

    const conta = await prisma.contaMeta.create({
      data: {
        nome,
        metaBusinessId: metaBusinessId ?? null,
        adAccountId: adAccountId ?? null,
        wabaId: wabaId ?? null,
        accessToken: accessToken ?? null,
        tipo: tipo ?? 'Business Manager',
        status: statusInicial ?? 'ATIVA',
        empresaId,
        observacoes: observacoes ?? null,
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Conta Meta ${nome} criada`,
      entidade: 'ContaMeta',
      entidadeId: conta?.id,
      userId: (session?.user as any)?.id,
      empresaId,
    });

    return NextResponse.json({
      ...(conta ?? {}),
      createdAt: conta?.createdAt?.toISOString?.() ?? '',
      updatedAt: conta?.updatedAt?.toISOString?.() ?? '',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create conta error:', error);
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 });
  }
}