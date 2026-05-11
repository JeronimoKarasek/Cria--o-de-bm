export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { deleteMessageTemplate } from '@/lib/meta-api';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const tpl = await prisma.messageTemplate.findUnique({
      where: { id: params.id },
      include: { contaMeta: true },
    });
    if (!tpl) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });

    const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
    const token = tpl.contaMeta?.accessToken ?? config?.accessToken ?? process.env.META_SYSTEM_USER_TOKEN;
    const version = config?.graphApiVersion ?? 'v21.0';

    if (tpl.contaMeta?.wabaId && token) {
      await deleteMessageTemplate(tpl.contaMeta.wabaId, tpl.name, token, version);
    }

    await prisma.messageTemplate.delete({ where: { id: params.id } });

    await registrarAuditLog({
      acao: 'EXCLUIR_TEMPLATE',
      descricao: `Template ${tpl.name} removido`,
      entidade: 'MessageTemplate',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: tpl.contaMeta?.empresaId ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete template error:', err);
    return NextResponse.json({ error: 'Erro ao excluir template' }, { status: 500 });
  }
}
