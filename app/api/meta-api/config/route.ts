export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem acessar configurações' }, { status: 403 });
    }

    const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
    if (!config) return NextResponse.json(null);

    return NextResponse.json({
      ...config,
      // Mask sensitive data
      appSecret: config.appSecret ? '***' + config.appSecret.slice(-4) : null,
      accessToken: config.accessToken ? '***' + config.accessToken.slice(-8) : null,
      createdAt: config.createdAt?.toISOString?.() ?? '',
      updatedAt: config.updatedAt?.toISOString?.() ?? '',
    });
  } catch (error: any) {
    console.error('Get meta config error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem configurar' }, { status: 403 });
    }

    const body = await request.json();
    const { appId, appSecret, accessToken, webhookToken, graphApiVersion, descricao } = body ?? {};

    if (!appId) return NextResponse.json({ error: 'App ID é obrigatório' }, { status: 400 });

    // Deactivate existing
    await prisma.metaApiConfig.updateMany({ where: { ativo: true }, data: { ativo: false } });

    const config = await prisma.metaApiConfig.create({
      data: {
        appId,
        appSecret: appSecret ?? null,
        accessToken: accessToken ?? null,
        webhookToken: webhookToken ?? null,
        graphApiVersion: graphApiVersion ?? 'v21.0',
        descricao: descricao ?? null,
        ativo: true,
      },
    });

    await registrarAuditLog({
      acao: 'CONFIGURAR',
      descricao: 'Configuração da Meta API atualizada',
      entidade: 'MetaApiConfig',
      entidadeId: config.id,
      userId: (session?.user as any)?.id,
    });

    return NextResponse.json({ success: true, id: config.id }, { status: 201 });
  } catch (error: any) {
    console.error('Save meta config error:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}
