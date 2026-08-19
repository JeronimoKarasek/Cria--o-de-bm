export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';
import {
  decodeOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getOAuthRedirectUri,
  resolveMetaAppCredentials,
} from '@/lib/meta-oauth';
import {
  getGraphApiUrl,
  listAccessibleBusinesses,
  getOwnedWABAs,
  getPhoneNumbers,
  getAdAccounts,
  getBusinessPages,
} from '@/lib/meta-api';

/**
 * GET /api/meta-api/oauth/callback?code=...&state=...
 * Troca code → long-lived token, grava em MetaApiConfig, opcionalmente importa BMs.
 */
export async function GET(request: NextRequest) {
  const baseRedirect = (path: string, params: Record<string, string>) => {
    const u = new URL(path, request.url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return NextResponse.redirect(u);
  };

  try {
    const err = request.nextUrl.searchParams.get('error');
    const errDesc = request.nextUrl.searchParams.get('error_description');
    if (err) {
      return baseRedirect('/integracao-meta', {
        oauth: 'denied',
        msg: errDesc || err,
      });
    }

    const code = request.nextUrl.searchParams.get('code');
    const stateRaw = request.nextUrl.searchParams.get('state');
    if (!code || !stateRaw) {
      return baseRedirect('/integracao-meta', {
        oauth: 'error',
        msg: 'Callback sem code/state',
      });
    }

    const state = decodeOAuthState(stateRaw);
    const session = await getServerSession(authOptions);
    if (!session) {
      return baseRedirect('/login', {
        callbackUrl: '/integracao-meta?oauth=relogin',
      });
    }
    const userId = (session.user as any)?.id as string | undefined;
    if (!userId || userId !== state.u) {
      return baseRedirect('/integracao-meta', {
        oauth: 'error',
        msg: 'Sessão não confere com o state OAuth',
      });
    }
    if ((session.user as any)?.role !== 'ADMIN') {
      return baseRedirect('/integracao-meta', {
        oauth: 'error',
        msg: 'Apenas admins',
      });
    }

    const creds = await resolveMetaAppCredentials();
    const redirectUri = getOAuthRedirectUri(request.url);

    const short = await exchangeCodeForToken({
      appId: creds.appId,
      appSecret: creds.appSecret,
      code,
      redirectUri,
      version: creds.graphApiVersion,
    });

    let accessToken = short.access_token;
    let expiresIn = short.expires_in;
    try {
      const long = await exchangeForLongLivedToken({
        appId: creds.appId,
        appSecret: creds.appSecret,
        shortToken: short.access_token,
        version: creds.graphApiVersion,
      });
      accessToken = long.access_token;
      expiresIn = long.expires_in ?? expiresIn;
    } catch (e: any) {
      console.warn('long-lived exchange failed, using short token:', e?.message);
    }

    // Persistir token no config ativo (cria se só houver env)
    let configId = creds.configId;
    if (configId) {
      await prisma.metaApiConfig.update({
        where: { id: configId },
        data: { accessToken },
      });
    } else {
      await prisma.metaApiConfig.updateMany({ where: { ativo: true }, data: { ativo: false } });
      const created = await prisma.metaApiConfig.create({
        data: {
          appId: creds.appId,
          appSecret: creds.appSecret,
          accessToken,
          graphApiVersion: creds.graphApiVersion,
          descricao: 'OAuth Facebook Login',
          ativo: true,
        },
      });
      configId = created.id;
    }

    // Lista BMs acessíveis
    const bizList = await listAccessibleBusinesses(accessToken, creds.graphApiVersion);
    const businesses: { id: string; name: string; verification_status?: string }[] =
      bizList.success && Array.isArray((bizList.data as any)?.data)
        ? (bizList.data as any).data.map((b: any) => ({
            id: b.id,
            name: b.name || b.id,
            verification_status: b.verification_status,
          }))
        : [];

    let importSummary: { contas: number; numeros: number; errors: number } | null = null;

    // Auto-import se empresaId veio no state
    if (state.e && businesses.length > 0) {
      const empresa = await prisma.empresa.findUnique({ where: { id: state.e } });
      if (empresa) {
        const imported = { contas: 0, numeros: 0, errors: 0 };
        for (const b of businesses) {
          try {
            const bizUrl = `${getGraphApiUrl(creds.graphApiVersion)}/${b.id}?fields=id,name,verification_status&access_token=${accessToken}`;
            const br = await fetch(bizUrl);
            const bd = await br.json();
            if (bd?.error) {
              imported.errors++;
              continue;
            }
            const contaMeta = await prisma.contaMeta.upsert({
              where: { id: `bm-${b.id}` },
              update: {
                nome: bd.name ?? b.name,
                verificacaoStatus: bd.verification_status ?? 'NAO_VERIFICADA',
                accessToken,
                appId: creds.appId,
              },
              create: {
                id: `bm-${b.id}`,
                nome: bd.name ?? b.name,
                metaBusinessId: b.id,
                tipo: 'Business Manager',
                status: 'ATIVA',
                verificacaoStatus: bd.verification_status ?? 'NAO_VERIFICADA',
                empresaId: state.e!,
                accessToken,
                appId: creds.appId,
              },
            });
            imported.contas++;

            const wabaResult = await getOwnedWABAs(b.id, accessToken, creds.graphApiVersion);
            if (wabaResult.success && wabaResult.data?.data) {
              for (const waba of wabaResult.data.data) {
                await prisma.contaMeta.update({
                  where: { id: contaMeta.id },
                  data: { wabaId: waba.id },
                });
                const phonesResult = await getPhoneNumbers(waba.id, accessToken, creds.graphApiVersion);
                if (phonesResult.success && phonesResult.data?.data) {
                  for (const phone of phonesResult.data.data) {
                    const numId = `wapi-${phone.id}`;
                    await prisma.numeroWhatsapp.upsert({
                      where: { id: numId },
                      update: {
                        displayName: phone.verified_name ?? phone.display_phone_number,
                        qualityRating: phone.quality_rating ?? 'NA',
                        status:
                          phone.status === 'CONNECTED'
                            ? 'CONNECTED'
                            : phone.code_verification_status === 'VERIFIED'
                              ? 'VERIFICADO'
                              : 'PENDENTE',
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
                        empresaId: state.e!,
                      },
                    });
                    imported.numeros++;
                  }
                }
              }
            }

            const adResult = await getAdAccounts(b.id, accessToken, creds.graphApiVersion);
            if (adResult.success && adResult.data?.data?.[0] && !contaMeta.adAccountId) {
              const ad = adResult.data.data[0];
              await prisma.contaMeta.update({
                where: { id: contaMeta.id },
                data: { adAccountId: `act_${ad.account_id || ad.id}` },
              });
            }
            await getBusinessPages(b.id, accessToken, creds.graphApiVersion);
          } catch {
            imported.errors++;
          }
        }
        importSummary = imported;
      }
    }

    await registrarAuditLog({
      acao: 'CONFIGURAR',
      descricao: `Facebook Login OAuth: token salvo; ${businesses.length} BM(s)${
        importSummary
          ? `; import ${importSummary.contas} contas / ${importSummary.numeros} números`
          : ''
      }`,
      entidade: 'MetaApiConfig',
      entidadeId: configId,
      userId,
      empresaId: state.e || undefined,
    });

    const returnPath = state.r || '/integracao-meta';
    const params: Record<string, string> = {
      oauth: 'ok',
      bms: String(businesses.length),
      expires: expiresIn ? String(expiresIn) : '',
    };
    if (importSummary) {
      params.imported = String(importSummary.contas);
      params.nums = String(importSummary.numeros);
    }
    if (businesses.length === 0) {
      params.msg = 'Token ok, mas nenhuma BM acessível. Confira permissões business_management.';
    }

    return baseRedirect(returnPath, params);
  } catch (error: any) {
    console.error('oauth/callback', error);
    return baseRedirect('/integracao-meta', {
      oauth: 'error',
      msg: error?.message || 'Falha no callback OAuth',
    });
  }
}
