export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getHostingerStatus } from '@/lib/hostinger';

/**
 * GET /api/integracoes/hostinger/status
 * Admin (or any authenticated user): health read-only da integração Hostinger.
 * Não expõe token.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const status = await getHostingerStatus();
    return NextResponse.json({
      ...status,
      checkedAt: new Date().toISOString(),
      label: status.ok
        ? `Hostinger: OK · ${status.domainsCount} domínios`
        : status.configured
          ? `Hostinger: erro · ${status.error || 'falha'}`
          : 'Hostinger: não configurado',
    });
  } catch (error: any) {
    console.error('Hostinger status error:', error);
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: error?.message || 'Erro interno',
        label: 'Hostinger: erro',
      },
      { status: 500 }
    );
  }
}
