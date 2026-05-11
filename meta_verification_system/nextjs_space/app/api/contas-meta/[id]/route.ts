export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const conta = await prisma.contaMeta.findUnique({
      where: { id: params.id },
      include: {
        empresa: { select: { nomeFantasia: true, cnpj: true, id: true } },
        historicoStatus: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    return NextResponse.json({
      ...(conta ?? {}),
      createdAt: conta?.createdAt?.toISOString?.() ?? '',
      updatedAt: conta?.updatedAt?.toISOString?.() ?? '',
      dataRestricao: conta?.dataRestricao?.toISOString?.() ?? null,
      dataRecurso: conta?.dataRecurso?.toISOString?.() ?? null,
      historicoStatus: (conta?.historicoStatus ?? []).map((h: any) => ({
        ...h,
        createdAt: h?.createdAt?.toISOString?.() ?? '',
      })),
    });
  } catch (error: any) {
    console.error('Get conta error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const {
      nome, metaBusinessId, adAccountId, wabaId, accessToken: tokenUpdate, appId,
      tipo, status, observacoes,
      motivoRestricao, recursoEnviado, recursoDescricao, verificacaoStatus,
    } = body ?? {};

    const contaAtual = await prisma.contaMeta.findUnique({ where: { id: params.id } });
    if (!contaAtual) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome;
    if (metaBusinessId !== undefined) updateData.metaBusinessId = metaBusinessId;
    if (adAccountId !== undefined) updateData.adAccountId = adAccountId;
    if (wabaId !== undefined) updateData.wabaId = wabaId;
    if (tokenUpdate !== undefined) updateData.accessToken = tokenUpdate;
    if (appId !== undefined) updateData.appId = appId;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (motivoRestricao !== undefined) updateData.motivoRestricao = motivoRestricao;
    if (recursoEnviado !== undefined) updateData.recursoEnviado = recursoEnviado;
    if (recursoDescricao !== undefined) updateData.recursoDescricao = recursoDescricao;
    if (verificacaoStatus !== undefined) updateData.verificacaoStatus = verificacaoStatus;

    // Handle status change with history tracking
    if (status && status !== contaAtual.status) {
      updateData.status = status;

      // Set restriction date when moving to restricted/cancelled/suspended/disabled status
      const restrictedStatuses = ['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'];
      if (restrictedStatuses.includes(status) && !restrictedStatuses.includes(contaAtual.status)) {
        updateData.dataRestricao = new Date();
      }

      // If reactivating, clear restriction data
      if (status === 'ATIVA') {
        updateData.dataRestricao = null;
        updateData.motivoRestricao = null;
        updateData.recursoEnviado = false;
        updateData.dataRecurso = null;
        updateData.recursoDescricao = null;
      }

      // Record status change history
      await prisma.contaMetaHistorico.create({
        data: {
          statusAnterior: contaAtual.status,
          statusNovo: status,
          motivo: motivoRestricao ?? body?.motivoMudanca ?? null,
          contaMetaId: params.id,
          criadoPorId: (session?.user as any)?.id ?? null,
        },
      });
    }

    // Handle appeal submission
    if (recursoEnviado === true && !contaAtual.recursoEnviado) {
      updateData.dataRecurso = new Date();
    }

    const contaAtualizada = await prisma.contaMeta.update({
      where: { id: params.id },
      data: updateData,
      include: {
        empresa: { select: { nomeFantasia: true, cnpj: true } },
        historicoStatus: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    await registrarAuditLog({
      acao: 'ATUALIZAR',
      descricao: status && status !== contaAtual.status
        ? `Status da conta Meta ${contaAtualizada.nome} alterado de ${contaAtual.status} para ${status}${motivoRestricao ? ` - Motivo: ${motivoRestricao}` : ''}`
        : `Conta Meta ${contaAtualizada.nome} atualizada`,
      entidade: 'ContaMeta',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: contaAtualizada.empresaId,
      metadata: JSON.stringify({ statusAnterior: contaAtual.status, statusNovo: status }) as any,
    });

    return NextResponse.json({
      ...(contaAtualizada ?? {}),
      createdAt: contaAtualizada?.createdAt?.toISOString?.() ?? '',
      updatedAt: contaAtualizada?.updatedAt?.toISOString?.() ?? '',
      dataRestricao: contaAtualizada?.dataRestricao?.toISOString?.() ?? null,
      dataRecurso: contaAtualizada?.dataRecurso?.toISOString?.() ?? null,
      historicoStatus: (contaAtualizada?.historicoStatus ?? []).map((h: any) => ({
        ...h,
        createdAt: h?.createdAt?.toISOString?.() ?? '',
      })),
    });
  } catch (error: any) {
    console.error('Update conta error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar conta' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem excluir contas' }, { status: 403 });
    }

    const conta = await prisma.contaMeta.findUnique({ where: { id: params.id } });
    if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    await prisma.contaMeta.delete({ where: { id: params.id } });

    await registrarAuditLog({
      acao: 'EXCLUIR',
      descricao: `Conta Meta ${conta.nome} excluída`,
      entidade: 'ContaMeta',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: conta.empresaId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete conta error:', error);
    return NextResponse.json({ error: 'Erro ao excluir conta' }, { status: 500 });
  }
}
