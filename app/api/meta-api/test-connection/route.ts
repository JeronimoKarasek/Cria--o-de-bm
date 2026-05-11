export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getGraphApiUrl } from '@/lib/meta-api';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { accessToken: bodyToken, businessId } = body ?? {};

    // Use provided token or get from config
    let accessToken = bodyToken;
    let apiVersion = 'v21.0';

    if (!accessToken) {
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      accessToken = config?.accessToken;
      apiVersion = config?.graphApiVersion ?? 'v21.0';
    }

    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Nenhum Access Token configurado' }, { status: 400 });
    }

    // Test 1: Validate token by getting token info
    const debugUrl = `${getGraphApiUrl(apiVersion)}/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();

    if (debugData?.error) {
      return NextResponse.json({
        success: false,
        error: debugData.error.message ?? 'Token inválido',
        errorCode: debugData.error.code,
        errorType: debugData.error.type,
      });
    }

    const tokenInfo = debugData?.data ?? {};
    const isValid = tokenInfo.is_valid !== false;
    const scopes = tokenInfo.scopes ?? [];
    const expiresAt = tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : null;
    const appName = tokenInfo.application ?? 'N/A';

    // Test 2: If businessId provided, test business access
    let businessInfo = null;
    if (businessId && isValid) {
      try {
        const bizUrl = `${getGraphApiUrl(apiVersion)}/${businessId}?fields=id,name,verification_status,created_time,primary_page,link&access_token=${accessToken}`;
        const bizRes = await fetch(bizUrl);
        const bizData = await bizRes.json();
        if (!bizData?.error) {
          businessInfo = {
            id: bizData.id,
            name: bizData.name,
            verificationStatus: bizData.verification_status ?? 'unknown',
            createdTime: bizData.created_time,
          };
        } else {
          businessInfo = { error: bizData.error.message };
        }
      } catch {
        businessInfo = { error: 'Erro ao acessar o Business ID' };
      }
    }

    // Test 3: Get ME (who owns this token)
    let meInfo = null;
    if (isValid) {
      try {
        const meUrl = `${getGraphApiUrl(apiVersion)}/me?fields=id,name&access_token=${accessToken}`;
        const meRes = await fetch(meUrl);
        const meData = await meRes.json();
        if (!meData?.error) {
          meInfo = { id: meData.id, name: meData.name };
        }
      } catch {}
    }

    // Test 4: List businesses accessible to this token
    let businesses: any[] = [];
    if (isValid) {
      try {
        const bizListUrl = `${getGraphApiUrl(apiVersion)}/me/businesses?fields=id,name,verification_status,created_time&access_token=${accessToken}`;
        const bizListRes = await fetch(bizListUrl);
        const bizListData = await bizListRes.json();
        if (bizListData?.data) {
          businesses = bizListData.data.map((b: any) => ({
            id: b.id,
            name: b.name,
            verificationStatus: b.verification_status ?? 'unknown',
            createdTime: b.created_time,
          }));
        }
      } catch {}
    }

    return NextResponse.json({
      success: isValid,
      token: {
        valid: isValid,
        type: tokenInfo.type ?? 'unknown',
        appName,
        expiresAt,
        neverExpires: tokenInfo.expires_at === 0,
        scopes,
      },
      me: meInfo,
      businesses,
      businessInfo,
      requiredScopes: [
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'business_management',
      ],
      missingScopes: [
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'business_management',
      ].filter(s => !scopes.includes(s)),
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Erro de conexão com a Meta API' }, { status: 500 });
  }
}
