import { prisma } from '@/lib/prisma';

export async function registrarAuditLog(params: {
  acao: string;
  descricao: string;
  entidade: string;
  entidadeId?: string;
  userId?: string;
  empresaId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        acao: params?.acao ?? 'UNKNOWN',
        descricao: params?.descricao ?? '',
        entidade: params?.entidade ?? '',
        entidadeId: params?.entidadeId ?? null,
        userId: params?.userId ?? null,
        empresaId: params?.empresaId ?? null,
        metadata: params?.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar audit log:', error);
  }
}
