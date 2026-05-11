export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import { registerPhoneNumber, requestVerificationCode, verifyCode } from '@/lib/meta-api';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { acao, ...updateData } = body ?? {};

    const numero = await prisma.numeroWhatsapp.findUnique({
      where: { id: params.id },
      include: { contaMeta: true },
    });
    if (!numero) return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 });

    // Handle Meta API actions
    if (acao) {
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      const accessToken = numero.contaMeta?.accessToken ?? config?.accessToken;
      const apiVersion = config?.graphApiVersion ?? 'v21.0';

      if (!accessToken) {
        return NextResponse.json({ error: 'Access Token não configurado' }, { status: 400 });
      }

      if (acao === 'solicitar_codigo') {
        if (!numero.phoneNumberId) {
          return NextResponse.json({ error: 'Phone Number ID não configurado' }, { status: 400 });
        }
        const result = await requestVerificationCode(
          numero.phoneNumberId, accessToken,
          updateData?.metodo ?? 'SMS', 'pt_BR', apiVersion
        );
        return NextResponse.json(result);
      }

      if (acao === 'verificar_codigo') {
        if (!numero.phoneNumberId || !updateData?.codigo) {
          return NextResponse.json({ error: 'Phone Number ID e código são obrigatórios' }, { status: 400 });
        }
        const result = await verifyCode(numero.phoneNumberId, accessToken, updateData.codigo, apiVersion);
        if (result.success) {
          await prisma.numeroWhatsapp.update({
            where: { id: params.id },
            data: { status: 'VERIFICADO' },
          });
        }
        return NextResponse.json(result);
      }

      if (acao === 'registrar') {
        if (!numero.phoneNumberId) {
          return NextResponse.json({ error: 'Phone Number ID não configurado' }, { status: 400 });
        }
        const pin = updateData?.pin ?? numero.pin2fa ?? '000000';
        const result = await registerPhoneNumber(numero.phoneNumberId, accessToken, pin, apiVersion);
        if (result.success) {
          await prisma.numeroWhatsapp.update({
            where: { id: params.id },
            data: { status: 'REGISTRADO' },
          });
        }
        return NextResponse.json(result);
      }
    }

    // Regular update
    const data: any = {};
    if (updateData.displayName !== undefined) data.displayName = updateData.displayName;
    if (updateData.phoneNumberId !== undefined) data.phoneNumberId = updateData.phoneNumberId;
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.pin2fa !== undefined) data.pin2fa = updateData.pin2fa;
    if (updateData.qualityRating !== undefined) data.qualityRating = updateData.qualityRating;
    if (updateData.limiteMsg !== undefined) data.limiteMsg = updateData.limiteMsg;

    const updated = await prisma.numeroWhatsapp.update({
      where: { id: params.id },
      data,
    });

    await registrarAuditLog({
      acao: 'ATUALIZAR',
      descricao: `Número WhatsApp ${numero.numero} atualizado`,
      entidade: 'NumeroWhatsapp',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: numero.empresaId,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt?.toISOString?.() ?? '',
      updatedAt: updated.updatedAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Update numero error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar número' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const numero = await prisma.numeroWhatsapp.findUnique({ where: { id: params.id } });
    if (!numero) return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 });

    await prisma.numeroWhatsapp.delete({ where: { id: params.id } });

    await registrarAuditLog({
      acao: 'EXCLUIR',
      descricao: `Número WhatsApp ${numero.numero} excluído`,
      entidade: 'NumeroWhatsapp',
      entidadeId: params.id,
      userId: (session?.user as any)?.id,
      empresaId: numero.empresaId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete numero error:', error);
    return NextResponse.json({ error: 'Erro ao excluir número' }, { status: 500 });
  }
}
