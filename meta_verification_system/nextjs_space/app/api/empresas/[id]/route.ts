export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const empresa = await prisma.empresa.findUnique({
      where: { id: params?.id },
      include: {
        documentos: { orderBy: { createdAt: 'desc' } },
        contasMeta: { orderBy: { createdAt: 'desc' } },
        sitesVerificacao: { orderBy: { createdAt: 'desc' } },
        trustScoreHistorico: { orderBy: { createdAt: 'desc' }, take: 10 },
        criadoPor: { select: { name: true, email: true } },
      },
    });

    if (!empresa) return NextResponse.json({ error: 'Empresa n\u00e3o encontrada' }, { status: 404 });

    const serialized = {
      ...(empresa ?? {}),
      createdAt: empresa?.createdAt?.toISOString?.() ?? '',
      updatedAt: empresa?.updatedAt?.toISOString?.() ?? '',
      documentos: (empresa?.documentos ?? []).map((d: any) => ({ ...(d ?? {}), createdAt: d?.createdAt?.toISOString?.() ?? '', updatedAt: d?.updatedAt?.toISOString?.() ?? '' })),
      contasMeta: (empresa?.contasMeta ?? []).map((c: any) => ({ ...(c ?? {}), createdAt: c?.createdAt?.toISOString?.() ?? '', updatedAt: c?.updatedAt?.toISOString?.() ?? '' })),
      sitesVerificacao: (empresa?.sitesVerificacao ?? []).map((s: any) => ({ ...(s ?? {}), createdAt: s?.createdAt?.toISOString?.() ?? '', updatedAt: s?.updatedAt?.toISOString?.() ?? '' })),
      trustScoreHistorico: (empresa?.trustScoreHistorico ?? []).map((t: any) => ({ ...(t ?? {}), createdAt: t?.createdAt?.toISOString?.() ?? '' })),
    };

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('Get empresa error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const body = await request.json();
    const userId = (session?.user as any)?.id;

    const updateData: any = {};
    const fields = ['razaoSocial', 'nomeFantasia', 'segmento', 'email', 'telefone', 'website', 'endereco', 'cidade', 'estado', 'cep', 'observacoes', 'status', 'trustScore'];
    for (const f of fields) {
      if (body?.[f] !== undefined) updateData[f] = body[f];
    }

    const empresa = await prisma.empresa.update({
      where: { id: params?.id },
      data: updateData,
    });

    await registrarAuditLog({
      acao: 'ATUALIZAR',
      descricao: `Empresa ${empresa?.nomeFantasia} atualizada`,
      entidade: 'Empresa',
      entidadeId: empresa?.id,
      userId,
      empresaId: empresa?.id,
      metadata: updateData,
    });

    return NextResponse.json({
      ...(empresa ?? {}),
      createdAt: empresa?.createdAt?.toISOString?.() ?? '',
      updatedAt: empresa?.updatedAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Update empresa error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });
    const userRole = (session?.user as any)?.role;
    if (userRole !== 'ADMIN') return NextResponse.json({ error: 'Sem permiss\u00e3o' }, { status: 403 });

    const userId = (session?.user as any)?.id;
    const empresa = await prisma.empresa.findUnique({ where: { id: params?.id } });

    await prisma.empresa.delete({ where: { id: params?.id } });

    await registrarAuditLog({
      acao: 'DELETAR',
      descricao: `Empresa ${empresa?.nomeFantasia ?? ''} removida`,
      entidade: 'Empresa',
      entidadeId: params?.id,
      userId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete empresa error:', error);
    return NextResponse.json({ error: 'Erro ao deletar' }, { status: 500 });
  }
}
