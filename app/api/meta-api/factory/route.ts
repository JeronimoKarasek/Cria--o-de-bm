export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { registrarAuditLog } from '@/lib/audit';
import {
  factoryAddPhone,
  factoryCreateBusiness,
  factoryCreateWaba,
  factoryVerifyPhone,
  isMetaCreateLive,
  resolveMetaAccessToken,
} from '@/lib/meta-factory';
import { listAccessibleBusinesses } from '@/lib/meta-api';

/**
 * GET  /api/meta-api/factory — status da factory + BMs do token
 * POST /api/meta-api/factory — { action, ... }
 *   actions: create_bm | create_waba | add_phone | verify_phone
 *
 * Writes reais exigem FEATURE_META_CREATE_LIVE=true (senão dry-run).
 * dryRun=true no body força simulação mesmo com LIVE on.
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  if ((session.user as any)?.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Apenas admins' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;

    let businesses: any[] = [];
    let tokenError: string | undefined;
    try {
      const { accessToken, apiVersion, source } = await resolveMetaAccessToken();
      const list = await listAccessibleBusinesses(accessToken, apiVersion);
      if (list.success) {
        businesses = (list.data?.data || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          verification_status: b.verification_status,
        }));
      } else {
        tokenError = list.error;
      }
      return NextResponse.json({
        live: isMetaCreateLive(),
        featureFlag: 'FEATURE_META_CREATE_LIVE',
        tokenSource: source,
        businesses,
        tokenError,
        actions: ['create_bm', 'create_waba', 'add_phone', 'verify_phone'],
        notes: [
          'create_bm exige permissão business_creation / capabilities do app+user',
          'LIVE=false → todas as criações retornam dry-run (seguro)',
          'OAuth usuário ~60d; System User preferível para factory em escala',
        ],
      });
    } catch (e: any) {
      return NextResponse.json({
        live: isMetaCreateLive(),
        featureFlag: 'FEATURE_META_CREATE_LIVE',
        businesses: [],
        tokenError: e?.message || 'Token não configurado',
        actions: ['create_bm', 'create_waba', 'add_phone', 'verify_phone'],
      });
    }
  } catch (error: any) {
    console.error('factory GET', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const session = gate.session!;
    const userId = (session.user as any)?.id as string | undefined;

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').toLowerCase();
    if (!action) {
      return NextResponse.json(
        { error: 'action obrigatório: create_bm | create_waba | add_phone | verify_phone' },
        { status: 400 }
      );
    }

    // dryRun default true se omitido (seguro). Só false com dryRun:false explícito + LIVE.
    const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);

    let result: any;

    if (action === 'create_bm') {
      result = await factoryCreateBusiness({
        empresaId: body.empresaId,
        name: body.name,
        vertical: body.vertical,
        timezone_id: body.timezone_id,
        primary_page: body.primary_page,
        surveyEmail: body.surveyEmail,
        surveyBusinessType: body.surveyBusinessType,
        dryRun,
        accessToken: body.accessToken,
      });
    } else if (action === 'create_waba') {
      result = await factoryCreateWaba({
        empresaId: body.empresaId,
        businessId: body.businessId,
        name: body.name,
        currency: body.currency,
        timezone_id: body.timezone_id,
        contaMetaId: body.contaMetaId,
        dryRun,
        accessToken: body.accessToken,
      });
    } else if (action === 'add_phone') {
      result = await factoryAddPhone({
        empresaId: body.empresaId,
        wabaId: body.wabaId,
        cc: body.cc ?? '55',
        phone_number: body.phone_number ?? body.phoneNumber,
        verified_name: body.verified_name ?? body.verifiedName,
        contaMetaId: body.contaMetaId,
        dryRun,
        accessToken: body.accessToken,
        requestCode: Boolean(body.requestCode),
        codeMethod: body.codeMethod === 'VOICE' ? 'VOICE' : 'SMS',
      });
    } else if (action === 'verify_phone') {
      result = await factoryVerifyPhone({
        phoneNumberId: body.phoneNumberId,
        code: body.code,
        pin: body.pin,
        register: Boolean(body.register),
        contaMetaId: body.contaMetaId,
        accessToken: body.accessToken,
      });
    } else {
      return NextResponse.json({ error: `action desconhecida: ${action}` }, { status: 400 });
    }

    await registrarAuditLog({
      acao: result?.dryRun ? 'FACTORY_DRY_RUN' : result?.success ? 'FACTORY_CREATE' : 'FACTORY_ERROR',
      descricao: `Meta factory ${action}: ${result?.success ? 'ok' : result?.error || 'fail'}${
        result?.dryRun ? ' (dry-run)' : ''
      }`,
      entidade: 'MetaFactory',
      entidadeId: result?.businessId || result?.wabaId || result?.phoneNumberId || undefined,
      userId,
      empresaId: body.empresaId,
      metadata: {
        action,
        dryRun: Boolean(result?.dryRun),
        live: isMetaCreateLive(),
        success: Boolean(result?.success),
        error: result?.error,
        businessId: result?.businessId,
        wabaId: result?.wabaId,
        phoneNumberId: result?.phoneNumberId,
      },
    });

    if (!result?.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('factory POST', error);
    return NextResponse.json({ error: error?.message || 'Erro na factory' }, { status: 500 });
  }
}
