export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { verifyDomain, getOwnedDomains } from '@/lib/meta-api';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { acao, contaMetaId } = body ?? {};

    const dom = await prisma.dominioVerificacao.findUnique({ where: { id: params.id } });
    if (!dom) return NextResponse.json({ error: 'Domínio não encontrado' }, { status: 404 });

    if (acao === 'verificar') {
      const conta = contaMetaId
        ? await prisma.contaMeta.findUnique({ where: { id: contaMetaId } })
        : null;
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      const token = conta?.accessToken ?? config?.accessToken ?? process.env.META_SYSTEM_USER_TOKEN;
      const version = config?.graphApiVersion ?? 'v21.0';

      if (!dom.domainId || !token) {
        return NextResponse.json(
          { error: 'Domínio não tem domainId ou token ausente' },
          { status: 400 }
        );
      }

      const result = await verifyDomain(dom.domainId, token, version);

      const verificado = result.success && (result.data?.success === true);
      await prisma.dominioVerificacao.update({
        where: { id: params.id },
        data: {
          verificado,
          ultimoCheck: new Date(),
        },
      });

      await registrarAuditLog({
        acao: 'VERIFICAR_DOMINIO',
        descricao: `Verificação do domínio ${dom.dominio}: ${verificado ? 'sucesso' : 'falha'}`,
        entidade: 'DominioVerificacao',
        entidadeId: dom.id,
        userId: (session?.user as any)?.id,
        empresaId: dom.empresaId,
      });

      return NextResponse.json({ success: result.success, verificado, raw: result });
    }

    // Update genérico
    const updateData: any = {};
    for (const f of ['metodo', 'tokenVerific', 'verificado']) {
      if (body?.[f] !== undefined) updateData[f] = body[f];
    }
    const atualizado = await prisma.dominioVerificacao.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(atualizado);
  } catch (err: any) {
    console.error('Update dominio error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const dom = await prisma.dominioVerificacao.findUnique({ where: { id: params.id } });
    if (!dom) return NextResponse.json({ error: 'Domínio não encontrado' }, { status: 404 });

    await prisma.dominioVerificacao.delete({ where: { id: params.id } });
    await registrarAuditLog({
      acao: 'EXCLUIR',
      descricao: `Domínio ${dom.dominio} removido`,
      entidade: 'DominioVerificacao',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: dom.empresaId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete dominio error:', err);
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}
