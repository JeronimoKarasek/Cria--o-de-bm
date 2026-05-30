// ============================================================================
// API Route: /api/numeros-whatsapp/[id]/warming
// Controle de aquecimento (warming) de números WhatsApp
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

// --------------------------------------------------------------------------
// GET /api/numeros-whatsapp/[id]/warming — status de warming
// --------------------------------------------------------------------------
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const numero = await prisma.numeroWhatsapp.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        numero: true,
        warmingStage: true,
        warmingDay: true,
        warmingStartedAt: true,
        dailyMsgCount: true,
        dailyMsgLimit: true,
        msgTotalSent: true,
        qualityRating: true,
        qualityHistory: true,
        lastMsgAt: true,
        warmingNotes: true,
      },
    });

    if (!numero) {
      return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 });
    }

    // Buscar último log de warming
    const lastLog = await prisma.warmingLog.findFirst({
      where: { numeroId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ...numero,
      qualityHistory: numero.qualityHistory ?? [],
      lastWarmingLog: lastLog ? {
        day: lastLog.warmingDay,
        stage: lastLog.stage,
        sentToday: lastLog.msgSentToday,
        limitToday: lastLog.msgLimitToday,
        notes: lastLog.notes,
      } : null,
    });
  } catch (error: any) {
    console.error('Warming GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// --------------------------------------------------------------------------
// PATCH /api/numeros-whatsapp/[id]/warming — controlar warming
// --------------------------------------------------------------------------
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { action } = body; // 'start' | 'pause' | 'resume' | 'reset'

    const numero = await prisma.numeroWhatsapp.findUnique({
      where: { id: params.id },
    });

    if (!numero) {
      return NextResponse.json({ error: 'Número não encontrado' }, { status: 404 });
    }

    let updated: any;
    let descricao: string;

    switch (action) {
      case 'start':
        // Iniciar aquecimento do zero
        updated = await prisma.numeroWhatsapp.update({
          where: { id: params.id },
          data: {
            warmingStage: 'WARMING_1_3',
            warmingStartedAt: new Date(),
            warmingDay: 1,
            dailyMsgCount: 0,
            dailyMsgLimit: 20,
            warmingNotes: 'Aquecimento iniciado automaticamente',
          },
        });
        descricao = `Warming iniciado para número ${numero.numero}`;
        break;

      case 'pause':
        updated = await prisma.numeroWhatsapp.update({
          where: { id: params.id },
          data: {
            warmingStage: 'PAUSED',
            warmingNotes: body.motivo ?? 'Pausado manualmente',
          },
        });
        descricao = `Warming pausado para número ${numero.numero}`;
        break;

      case 'resume':
        updated = await prisma.numeroWhatsapp.update({
          where: { id: params.id },
          data: {
            warmingStage: `WARMING_${Math.ceil(numero.warmingDay / 3) * 3}_${Math.ceil(numero.warmingDay / 3) * 3 + 2}`.replace(/WARMING_(\d+)_(\d+)/, (_, start, end) => {
              if (Number(start) <= 3) return 'WARMING_1_3';
              if (Number(start) <= 7) return 'WARMING_4_7';
              if (Number(start) <= 14) return 'WARMING_8_14';
              if (Number(start) <= 21) return 'WARMING_15_21';
              return 'ACTIVE';
            }),
            warmingNotes: null,
          },
        });
        descricao = `Warming retomado para número ${numero.numero}`;
        break;

      case 'reset':
        // Voltar ao início
        updated = await prisma.numeroWhatsapp.update({
          where: { id: params.id },
          data: {
            warmingStage: 'COLD',
            warmingStartedAt: null,
            warmingDay: 0,
            dailyMsgCount: 0,
            dailyMsgLimit: 10,
            msgTotalSent: 0,
            warmingNotes: 'Reset manual',
          },
        });
        descricao = `Warming resetado para número ${numero.numero}`;
        break;

      default:
        return NextResponse.json({ error: 'Ação inválida. Use: start, pause, resume, reset' }, { status: 400 });
    }

    await registrarAuditLog({
      acao: 'WARMING',
      descricao,
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
    console.error('Warming PATCH error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
