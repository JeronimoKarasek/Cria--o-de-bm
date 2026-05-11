export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const { searchParams } = new URL(request?.url ?? 'http://localhost');
    const status = searchParams?.get?.('status') ?? '';
    const search = searchParams?.get?.('search') ?? '';

    const where: any = {};
    if (status && status !== 'TODOS') where.status = status;
    if (search) {
      where.OR = [
        { nomeFantasia: { contains: search } },
        { razaoSocial: { contains: search } },
        { cnpj: { contains: search } },
      ];
    }

    const empresas = await prisma.empresa.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documentos: true, contasMeta: true } },
      },
    });

    return NextResponse.json(
      (empresas ?? []).map((e: any) => ({
        ...(e ?? {}),
        createdAt: e?.createdAt?.toISOString?.() ?? '',
        updatedAt: e?.updatedAt?.toISOString?.() ?? '',
      }))
    );
  } catch (error: any) {
    console.error('List empresas error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const body = await request.json();
    const { razaoSocial, nomeFantasia, cnpj, segmento, email, telefone, website, endereco, cidade, estado, cep, observacoes } = body ?? {};

    if (!razaoSocial || !nomeFantasia || !cnpj || !segmento || !email) {
      return NextResponse.json({ error: 'Campos obrigat\u00f3rios faltando' }, { status: 400 });
    }

    const existingCnpj = await prisma.empresa.findUnique({ where: { cnpj } });
    if (existingCnpj) {
      return NextResponse.json({ error: 'CNPJ j\u00e1 cadastrado' }, { status: 400 });
    }

    const userId = (session?.user as any)?.id;
    const empresa = await prisma.empresa.create({
      data: {
        razaoSocial,
        nomeFantasia,
        cnpj: cnpj?.replace?.(/\D/g, '') ?? '',
        segmento,
        email,
        telefone: telefone ?? null,
        website: website ?? null,
        endereco: endereco ?? null,
        cidade: cidade ?? null,
        estado: estado ?? null,
        cep: cep ?? null,
        observacoes: observacoes ?? null,
        criadoPorId: userId,
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Empresa ${nomeFantasia} cadastrada`,
      entidade: 'Empresa',
      entidadeId: empresa?.id,
      userId,
      empresaId: empresa?.id,
    });

    return NextResponse.json({
      ...(empresa ?? {}),
      createdAt: empresa?.createdAt?.toISOString?.() ?? '',
      updatedAt: empresa?.updatedAt?.toISOString?.() ?? '',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create empresa error:', error);
    return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 });
  }
}
