export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import {
  getBusinessVerificationStatus,
  getOwnedWABAs,
  getPhoneNumbers,
  getAdAccounts,
  getBusinessPages,
} from '@/lib/meta-api';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { contaMetaId, acao } = body ?? {};

    if (!contaMetaId) return NextResponse.json({ error: 'ID da conta obrigatório' }, { status: 400 });

    const conta = await prisma.contaMeta.findUnique({
      where: { id: contaMetaId },
      include: { empresa: true },
    });
    if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    // Get active config or use conta's own token
    const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
    const accessToken = conta.accessToken ?? config?.accessToken;
    const apiVersion = config?.graphApiVersion ?? 'v21.0';

    if (!accessToken) {
      return NextResponse.json({ error: 'Nenhum Access Token configurado. Configure nas Configurações da Meta API ou diretamente na conta.' }, { status: 400 });
    }

    if (!conta.metaBusinessId) {
      return NextResponse.json({ error: 'Meta Business ID não configurado nesta conta' }, { status: 400 });
    }

    const results: any = { verificacao: null, wabas: null, adAccounts: null, pages: null, phoneNumbers: null };

    // Sync Business Verification Status
    if (!acao || acao === 'verificacao' || acao === 'tudo') {
      const verResult = await getBusinessVerificationStatus(conta.metaBusinessId, accessToken, apiVersion);
      results.verificacao = verResult;
      if (verResult.success) {
        await prisma.contaMeta.update({
          where: { id: contaMetaId },
          data: { verificacaoStatus: verResult.data?.verification_status ?? 'NAO_VERIFICADA' },
        });
      }
    }

    // Sync WABAs
    if (!acao || acao === 'wabas' || acao === 'tudo') {
      const wabaResult = await getOwnedWABAs(conta.metaBusinessId, accessToken, apiVersion);
      results.wabas = wabaResult;
      if (wabaResult.success && wabaResult.data?.data?.[0]) {
        const firstWaba = wabaResult.data.data[0];
        await prisma.contaMeta.update({
          where: { id: contaMetaId },
          data: { wabaId: firstWaba.id },
        });
      }
    }

    // Sync Phone Numbers (if WABA exists)
    if ((!acao || acao === 'numeros' || acao === 'tudo') && conta.wabaId) {
      const phonesResult = await getPhoneNumbers(conta.wabaId, accessToken, apiVersion);
      results.phoneNumbers = phonesResult;
      if (phonesResult.success && Array.isArray(phonesResult.data?.data)) {
        for (const phone of phonesResult.data.data) {
          await prisma.numeroWhatsapp.upsert({
            where: { id: `wapi-${phone.id}` },
            update: {
              displayName: phone.verified_name ?? phone.display_phone_number,
              qualityRating: phone.quality_rating ?? 'NA',
              status: phone.status ?? 'PENDENTE',
              limiteMsg: phone.messaging_limit_tier ?? '250',
            },
            create: {
              id: `wapi-${phone.id}`,
              numero: phone.display_phone_number ?? '',
              phoneNumberId: phone.id,
              displayName: phone.verified_name ?? phone.display_phone_number,
              qualityRating: phone.quality_rating ?? 'NA',
              status: phone.status ?? 'PENDENTE',
              limiteMsg: phone.messaging_limit_tier ?? '250',
              contaMetaId: conta.id,
              empresaId: conta.empresaId,
            },
          });
        }
      }
    }

    // Sync Ad Accounts
    if (!acao || acao === 'adAccounts' || acao === 'tudo') {
      const adResult = await getAdAccounts(conta.metaBusinessId, accessToken, apiVersion);
      results.adAccounts = adResult;
    }

    // Sync Pages
    if (!acao || acao === 'pages' || acao === 'tudo') {
      const pagesResult = await getBusinessPages(conta.metaBusinessId, accessToken, apiVersion);
      results.pages = pagesResult;
    }

    await registrarAuditLog({
      acao: 'SINCRONIZAR',
      descricao: `Sincronização com Meta API para conta ${conta.nome}${acao ? ` (${acao})` : ''}`,
      entidade: 'ContaMeta',
      entidadeId: contaMetaId,
      userId: (session?.user as any)?.id,
      empresaId: conta.empresaId,
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Meta sync error:', error);
    return NextResponse.json({ error: 'Erro na sincronização' }, { status: 500 });
  }
}
