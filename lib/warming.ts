// ============================================================================
// lib/warming.ts — Controle de warming para números WhatsApp
// 
// ⚠️  Esta lib deve ser importada em TODOS os endpoints de disparo.
//     Sempre chame canSendMessage() antes de enviar qualquer mensagem.
// ============================================================================

import { prisma } from '@/lib/prisma';

// --------------------------------------------------------------------------
// Constantes de limite por estágio
// --------------------------------------------------------------------------
export const WARMING_LIMITS: Record<string, number> = {
  COLD:           10,
  WARMING_1_3:    20,
  WARMING_4_7:    50,
  WARMING_8_14:   150,
  WARMING_15_21:  500,
  ACTIVE:         2000,
  BLOCKED:        0,
  PAUSED:         0,
};

// --------------------------------------------------------------------------
// Verificação pré-envio — retorna { ok: boolean, reason?: string }
// --------------------------------------------------------------------------
export async function canSendMessage(numeroId: string): Promise<{ ok: boolean; reason?: string }> {
  const numero = await prisma.numeroWhatsapp.findUnique({
    where: { id: numeroId },
    select: {
      id: true,
      numero: true,
      warmingStage: true,
      dailyMsgCount: true,
      dailyMsgLimit: true,
      qualityRating: true,
    },
  });

  if (!numero) {
    return { ok: false, reason: 'Número não encontrado' };
  }

  // Bloqueado ou pausado
  if (numero.warmingStage === 'BLOCKED') {
    return { ok: false, reason: 'Número bloqueado — verificar status no Meta' };
  }
  if (numero.warmingStage === 'PAUSED') {
    return { ok: false, reason: 'Aquecimento pausado' };
  }

  // Qualidade muito baixa
  if (numero.qualityRating === 'RED' && numero.warmingStage !== 'ACTIVE') {
    return { ok: false, reason: 'Qualidade RED — interromper envios até regularizar' };
  }

  // Limite diário atingido
  if ((numero.dailyMsgCount ?? 0) >= (numero.dailyMsgLimit ?? 0)) {
    return { ok: false, reason: `Limite diário atingido (${numero.dailyMsgCount}/${numero.dailyMsgLimit})` };
  }

  return { ok: true };
}

// --------------------------------------------------------------------------
// Registrar envio de mensagem (incrementa contadores)
// --------------------------------------------------------------------------
export async function registerMessageSent(numeroId: string, count: number = 1) {
  const updated = await prisma.numeroWhatsapp.update({
    where: { id: numeroId },
    data: {
      dailyMsgCount: { increment: count },
      msgTotalSent:  { increment: count },
      lastMsgAt:     new Date(),
    },
    select: {
      id: true,
      dailyMsgCount: true,
      dailyMsgLimit: true,
      msgTotalSent: true,
    },
  });

  return updated;
}

// --------------------------------------------------------------------------
// Avançar dia de warming (roda via cronjob diário)
// --------------------------------------------------------------------------
export async function advanceWarmingDay() {
  const numeros = await prisma.numeroWhatsapp.findMany({
    where: {
      warmingStage: {
        notIn: ['ACTIVE', 'BLOCKED', 'PAUSED'],
      },
      warmingStartedAt: { not: null },
    },
  });

  const results = [];

  for (const n of numeros) {
    const newDay = (n.warmingDay ?? 0) + 1;
    let newStage = n.warmingStage!;

    // Determinar novo estágio baseado no dia
    if (newDay <= 3) newStage = 'WARMING_1_3';
    else if (newDay <= 7) newStage = 'WARMING_4_7';
    else if (newDay <= 14) newStage = 'WARMING_8_14';
    else if (newDay <= 21) newStage = 'WARMING_15_21';
    else newStage = 'ACTIVE';

    const newLimit = WARMING_LIMITS[newStage] ?? 10;

    const updated = await prisma.numeroWhatsapp.update({
      where: { id: n.id },
      data: {
        warmingDay:    newDay,
        warmingStage:  newStage,
        dailyMsgCount: 0, // resetar contador diário
        dailyMsgLimit: newLimit,
      },
    });

    // Registrar no log
    await prisma.warmingLog.create({
      data: {
        numeroId:       n.id,
        warmingDay:     newDay,
        stage:          newStage,
        msgSentToday:   n.dailyMsgCount ?? 0,
        msgLimitToday:  newLimit,
        qualityRating:  n.qualityRating,
        notes:          newStage === 'ACTIVE'
          ? '✅ Aquecimento concluído — número liberado para disparo normal'
          : `⏳ Avançou para dia ${newDay} — estágio ${newStage}`,
      },
    });

    results.push({ id: n.id, numero: n.numero, day: newDay, stage: newStage });
  }

  return results;
}

// --------------------------------------------------------------------------
// Resumo de warming (dashboard)
// --------------------------------------------------------------------------
export async function getWarmingSummary() {
  const [byStage, total, active, blocked] = await Promise.all([
    prisma.numeroWhatsapp.groupBy({
      by: ['warmingStage'],
      _count: true,
    }),
    prisma.numeroWhatsapp.count(),
    prisma.numeroWhatsapp.count({ where: { warmingStage: 'ACTIVE' } }),
    prisma.numeroWhatsapp.count({ where: { warmingStage: 'BLOCKED' } }),
  ]);

  return {
    total,
    active,
    blocked,
    inWarming: total - active - blocked,
    byStage: byStage.reduce((acc: any, s: any) => {
      acc[s.warmingStage] = s._count;
      return acc;
    }, {}),
  };
}