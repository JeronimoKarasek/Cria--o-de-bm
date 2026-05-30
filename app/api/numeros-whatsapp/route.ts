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
    const contaMetaId = searchParams.get('contaMetaId');
    const empresaId = searchParams.get('empresaId');
    const status = searchParams.get('status');

    const where: any = {};
    if (contaMetaId) where.contaMetaId = contaMetaId;
    if (empresaId) where.empresaId = empresaId;
    if (status) where.status = status;

    const numeros = await prisma.numeroWhatsapp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        contaMeta: { select: { nome: true, metaBusinessId: true } },
        empresa: { select: { nomeFantasia: true, cnpj: true } },
      },
    });

    const includeWarming = searchParams.get('includeWarming') === 'true';

    return NextResponse.json(
      (numeros ?? []).map((n: any) => ({
        ...n,
        createdAt: n?.createdAt?.toISOString?.() ?? '',
        updatedAt: n?.updatedAt?.toISOString?.() ?? '',
        qualityHistory: includeWarming ? (n.qualityHistory ?? []) : undefined,
      }))
    );
  } catch (error: any) {
    console.error('List numeros error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { numero, displayName, contaMetaId, empresaId, pin2fa } = body ?? {};

    if (!numero || !contaMetaId || !empresaId) {
      return NextResponse.json({ error: 'Número, conta Meta e empresa são obrigatórios' }, { status: 400 });
    }

    const novoNumero = await prisma.numeroWhatsapp.create({
      data: {
        numero,
        displayName: displayName ?? null,
        pin2fa: pin2fa ?? null,
        contaMetaId,
        empresaId,
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Número WhatsApp ${numero} cadastrado`,
      entidade: 'NumeroWhatsapp',
      entidadeId: novoNumero.id,
      userId: (session?.user as any)?.id,
      empresaId,
    });

    return NextResponse.json({
      ...novoNumero,
      createdAt: novoNumero.createdAt?.toISOString?.() ?? '',
      updatedAt: novoNumero.updatedAt?.toISOString?.() ?? '',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create numero error:', error);
    return NextResponse.json({ error: 'Erro ao criar número' }, { status: 500 });
  }
}
