export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const [totalEmpresas, empresasAprovadas, empresasPendentes, empresasRejeitadas, empresasEmAnalise, totalContas, contasAtivas, totalSites, recentEmpresas, trustScoreAvg] = await Promise.all([
      prisma.empresa.count(),
      prisma.empresa.count({ where: { status: 'APROVADA' } }),
      prisma.empresa.count({ where: { status: 'PENDENTE' } }),
      prisma.empresa.count({ where: { status: 'REJEITADA' } }),
      prisma.empresa.count({ where: { status: 'EM_ANALISE' } }),
      prisma.contaMeta.count(),
      prisma.contaMeta.count({ where: { status: 'ATIVA' } }),
      prisma.siteVerificacao.count(),
      prisma.empresa.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, nomeFantasia: true, cnpj: true, status: true, trustScore: true, segmento: true, createdAt: true },
      }),
      prisma.empresa.aggregate({ _avg: { trustScore: true } }),
    ]);

    // Score distribution
    const allScores = await prisma.empresa.findMany({ select: { trustScore: true } });
    const scoreDistribution = [
      { range: '0-20', count: (allScores ?? []).filter((e: any) => (e?.trustScore ?? 0) <= 20).length },
      { range: '21-40', count: (allScores ?? []).filter((e: any) => (e?.trustScore ?? 0) > 20 && (e?.trustScore ?? 0) <= 40).length },
      { range: '41-60', count: (allScores ?? []).filter((e: any) => (e?.trustScore ?? 0) > 40 && (e?.trustScore ?? 0) <= 60).length },
      { range: '61-80', count: (allScores ?? []).filter((e: any) => (e?.trustScore ?? 0) > 60 && (e?.trustScore ?? 0) <= 80).length },
      { range: '81-100', count: (allScores ?? []).filter((e: any) => (e?.trustScore ?? 0) > 80).length },
    ];

    // Segmentos
    const empresasPorSegmento = await prisma.empresa.groupBy({
      by: ['segmento'],
      _count: { segmento: true },
    });

    return NextResponse.json({
      metrics: {
        totalEmpresas,
        empresasAprovadas,
        empresasPendentes,
        empresasRejeitadas,
        empresasEmAnalise,
        totalContas,
        contasAtivas,
        totalSites,
        trustScoreMedio: Math.round(trustScoreAvg?._avg?.trustScore ?? 0),
      },
      recentEmpresas: (recentEmpresas ?? []).map((e: any) => ({
        ...e,
        createdAt: e?.createdAt?.toISOString?.() ?? '',
      })),
      scoreDistribution,
      empresasPorSegmento: (empresasPorSegmento ?? []).map((s: any) => ({
        segmento: s?.segmento ?? 'N/A',
        count: s?._count?.segmento ?? 0,
      })),
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
