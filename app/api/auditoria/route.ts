export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        empresa: { select: { nomeFantasia: true } },
      },
    });

    return NextResponse.json(
      (logs ?? []).map((l: any) => ({
        ...(l ?? {}),
        createdAt: l?.createdAt?.toISOString?.() ?? '',
      }))
    );
  } catch (error: any) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
