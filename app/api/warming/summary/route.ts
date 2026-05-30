export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getWarmingSummary } from '@/lib/warming';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const summary = await getWarmingSummary();
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Warming summary error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}