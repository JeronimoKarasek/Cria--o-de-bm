export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { createMessageTemplate, getMessageTemplates } from '@/lib/meta-api';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const contaMetaId = searchParams.get('contaMetaId');
    const where: any = {};
    if (contaMetaId) where.contaMetaId = contaMetaId;

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { contaMeta: { select: { nome: true, wabaId: true } } },
    });

    return NextResponse.json(
      (templates ?? []).map((t: any) => ({
        ...t,
        createdAt: t.createdAt?.toISOString?.() ?? '',
        updatedAt: t.updatedAt?.toISOString?.() ?? '',
      }))
    );
  } catch (err: any) {
    console.error('List templates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * Cria template localmente e envia para a Meta (WABA).
 * Body: { contaMetaId, name, category, language, components }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { contaMetaId, name, category, language, components } = body ?? {};

    if (!contaMetaId || !name || !category || !language || !components) {
      return NextResponse.json(
        { error: 'contaMetaId, name, category, language e components são obrigatórios' },
        { status: 400 }
      );
    }

    const conta = await prisma.contaMeta.findUnique({ where: { id: contaMetaId } });
    if (!conta) return NextResponse.json({ error: 'Conta Meta não encontrada' }, { status: 404 });
    if (!conta.wabaId) {
      return NextResponse.json({ error: 'Conta não tem WABA configurada' }, { status: 400 });
    }

    const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
    const token = conta.accessToken ?? config?.accessToken ?? process.env.META_SYSTEM_USER_TOKEN;
    const version = config?.graphApiVersion ?? 'v21.0';
    if (!token) {
      return NextResponse.json({ error: 'Access Token ausente' }, { status: 400 });
    }

    const result = await createMessageTemplate(
      conta.wabaId,
      { name, category, language, components },
      token,
      version
    );

    const localStatus = result.success ? (result.data?.status ?? 'PENDING') : 'ERROR';

    const novo = await prisma.messageTemplate.create({
      data: {
        name,
        templateId: result.success ? String(result.data?.id ?? '') : null,
        status: localStatus,
        category,
        language,
        components: JSON.stringify(components),
        rejectionReason: result.success ? null : (result as any).error,
        contaMetaId,
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR_TEMPLATE',
      descricao: `Template ${name} criado (status: ${localStatus})`,
      entidade: 'MessageTemplate',
      entidadeId: novo.id,
      userId: (session?.user as any)?.id,
      empresaId: conta.empresaId,
    });

    return NextResponse.json(
      {
        ...novo,
        createdAt: novo.createdAt?.toISOString?.() ?? '',
        updatedAt: novo.updatedAt?.toISOString?.() ?? '',
        meta: result,
      },
      { status: result.success ? 201 : 502 }
    );
  } catch (err: any) {
    console.error('Create template error:', err);
    return NextResponse.json({ error: 'Erro ao criar template' }, { status: 500 });
  }
}
