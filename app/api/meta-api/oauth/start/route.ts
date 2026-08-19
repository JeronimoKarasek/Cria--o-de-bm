export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  buildFacebookAuthUrl,
  createOAuthNonce,
  encodeOAuthState,
  getOAuthRedirectUri,
  resolveMetaAppCredentials,
} from '@/lib/meta-oauth';

/**
 * GET /api/meta-api/oauth/start?empresaId=...&returnTo=/integracao-meta
 * Inicia Facebook Login e redireciona para o dialog OAuth.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      const login = new URL('/login', request.url);
      login.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    if ((session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem conectar BM via Facebook' }, { status: 403 });
    }

    const empresaId = request.nextUrl.searchParams.get('empresaId') || undefined;
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/integracao-meta';
    // só paths relativos internos
    const safeReturn =
      returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/integracao-meta';

    const creds = await resolveMetaAppCredentials();
    const redirectUri = getOAuthRedirectUri(request.url);
    const state = encodeOAuthState({
      u: (session.user as any).id,
      e: empresaId || null,
      n: createOAuthNonce(),
      t: Date.now(),
      r: safeReturn,
    });

    const url = buildFacebookAuthUrl({
      appId: creds.appId,
      state,
      redirectUri,
      version: creds.graphApiVersion,
    });

    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error('oauth/start', error);
    const dest = new URL('/integracao-meta', request.url);
    dest.searchParams.set('oauth', 'error');
    dest.searchParams.set('msg', error?.message || 'Falha ao iniciar Facebook Login');
    return NextResponse.redirect(dest);
  }
}
