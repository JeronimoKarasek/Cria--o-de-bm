export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import {
  getGraphApiUrl,
  getOwnedWABAs,
  getPhoneNumbers,
  getAdAccounts,
  getBusinessPages,
} from '@/lib/meta-api';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem importar' }, { status: 403 });
    }

    const body = await request.json();
    const { empresaId, businessIds, accessToken: bodyToken } = body ?? {};

    if (!empresaId) return NextResponse.json({ error: 'Empresa é obrigatória' }, { status: 400 });

    // Check empresa exists
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // Get access token
    let accessToken = bodyToken;
    let apiVersion = 'v21.0';
    if (!accessToken) {
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      accessToken = config?.accessToken;
      apiVersion = config?.graphApiVersion ?? 'v21.0';
    }
    if (!accessToken) {
      return NextResponse.json({ error: 'Access Token não configurado' }, { status: 400 });
    }

    const imported: any = { contas: [], wabas: [], numeros: [], adAccounts: [], pages: [], errors: [] };

    // Determine business IDs to import
    let bizIds: string[] = Array.isArray(businessIds) ? businessIds : [];

    // If no specific IDs, fetch all accessible businesses
    if (bizIds.length === 0) {
      try {
        const meUrl = `${getGraphApiUrl(apiVersion)}/me/businesses?fields=id,name,verification_status,created_time&limit=100&access_token=${accessToken}`;
        const meRes = await fetch(meUrl);
        const meData = await meRes.json();
        if (meData?.data) {
          bizIds = meData.data.map((b: any) => b.id);
        }
      } catch (e: any) {
        imported.errors.push(`Erro ao listar businesses: ${e?.message}`);
      }
    }

    if (bizIds.length === 0) {
      return NextResponse.json({ error: 'Nenhum Business encontrado com este token. Verifique as permissões.' }, { status: 400 });
    }

    // Import each business
    for (const bizId of bizIds) {
      try {
        // Get business details
        const bizUrl = `${getGraphApiUrl(apiVersion)}/${bizId}?fields=id,name,verification_status,created_time,primary_page&access_token=${accessToken}`;
        const bizRes = await fetch(bizUrl);
        const bizData = await bizRes.json();

        if (bizData?.error) {
          imported.errors.push(`Business ${bizId}: ${bizData.error.message}`);
          continue;
        }

        // Create or update ContaMeta
        const contaMeta = await prisma.contaMeta.upsert({
          where: { id: `bm-${bizId}` },
          update: {
            nome: bizData.name ?? `BM - ${bizId}`,
            verificacaoStatus: bizData.verification_status ?? 'NAO_VERIFICADA',
            accessToken: bodyToken ?? undefined,
          },
          create: {
            id: `bm-${bizId}`,
            nome: bizData.name ?? `BM - ${bizId}`,
            metaBusinessId: bizId,
            tipo: 'Business Manager',
            status: 'ATIVA',
            verificacaoStatus: bizData.verification_status ?? 'NAO_VERIFICADA',
            empresaId,
            accessToken: bodyToken ?? null,
          },
        });
        imported.contas.push({ id: contaMeta.id, name: contaMeta.nome, businessId: bizId });

        // Fetch WABAs
        const wabaResult = await getOwnedWABAs(bizId, accessToken, apiVersion);
        if (wabaResult.success && wabaResult.data?.data) {
          for (const waba of wabaResult.data.data) {
            imported.wabas.push({ id: waba.id, name: waba.name, businessId: bizId });

            // Update conta with WABA ID
            await prisma.contaMeta.update({
              where: { id: contaMeta.id },
              data: { wabaId: waba.id },
            });

            // Fetch phone numbers for this WABA
            const phonesResult = await getPhoneNumbers(waba.id, accessToken, apiVersion);
            if (phonesResult.success && phonesResult.data?.data) {
              for (const phone of phonesResult.data.data) {
                const numId = `wapi-${phone.id}`;
                await prisma.numeroWhatsapp.upsert({
                  where: { id: numId },
                  update: {
                    displayName: phone.verified_name ?? phone.display_phone_number,
                    qualityRating: phone.quality_rating ?? 'NA',
                    status: phone.status === 'CONNECTED' ? 'CONNECTED' : phone.code_verification_status === 'VERIFIED' ? 'VERIFICADO' : 'PENDENTE',
                    limiteMsg: phone.messaging_limit_tier ?? 'TIER_250',
                    phoneNumberId: phone.id,
                  },
                  create: {
                    id: numId,
                    numero: phone.display_phone_number ?? '',
                    phoneNumberId: phone.id,
                    displayName: phone.verified_name ?? phone.display_phone_number,
                    qualityRating: phone.quality_rating ?? 'NA',
                    status: phone.status === 'CONNECTED' ? 'CONNECTED' : 'PENDENTE',
                    limiteMsg: phone.messaging_limit_tier ?? 'TIER_250',
                    contaMetaId: contaMeta.id,
                    empresaId,
                  },
                });
                imported.numeros.push({
                  id: phone.id,
                  number: phone.display_phone_number,
                  name: phone.verified_name,
                  quality: phone.quality_rating,
                  status: phone.status,
                });
              }
            }
          }
        }

        // Fetch Ad Accounts
        const adResult = await getAdAccounts(bizId, accessToken, apiVersion);
        if (adResult.success && adResult.data?.data) {
          for (const ad of adResult.data.data) {
            imported.adAccounts.push({ id: ad.account_id, name: ad.name, status: ad.account_status });

            // Update first ad account ID on the conta
            if (!contaMeta.adAccountId) {
              await prisma.contaMeta.update({
                where: { id: contaMeta.id },
                data: { adAccountId: `act_${ad.account_id}` },
              });
            }
          }
        }

        // Fetch Pages
        const pagesResult = await getBusinessPages(bizId, accessToken, apiVersion);
        if (pagesResult.success && pagesResult.data?.data) {
          for (const page of pagesResult.data.data) {
            imported.pages.push({ id: page.id, name: page.name, category: page.category });
          }
        }
      } catch (e: any) {
        imported.errors.push(`Business ${bizId}: ${e?.message}`);
      }
    }

    await registrarAuditLog({
      acao: 'IMPORTAR',
      descricao: `Importação da Meta API: ${imported.contas.length} contas, ${imported.wabas.length} WABAs, ${imported.numeros.length} números, ${imported.adAccounts.length} ad accounts, ${imported.pages.length} páginas`,
      entidade: 'ContaMeta',
      userId: (session?.user as any)?.id,
      empresaId,
    });

    return NextResponse.json({
      success: true,
      summary: {
        contas: imported.contas.length,
        wabas: imported.wabas.length,
        numeros: imported.numeros.length,
        adAccounts: imported.adAccounts.length,
        pages: imported.pages.length,
        errors: imported.errors.length,
      },
      data: imported,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro na importação' }, { status: 500 });
  }
}
