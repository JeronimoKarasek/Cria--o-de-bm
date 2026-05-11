/**
 * Webhook do Meta — recebe atualizações de:
 *  - account_review_update
 *  - phone_number_quality_update
 *  - phone_number_name_update
 *  - message_template_status_update
 *  - messages (mensagens recebidas)
 *
 * Documentação: https://developers.facebook.com/docs/graph-api/webhooks
 *
 * Modo GET:  Meta envia hub.challenge para validar (uma vez no registro).
 * Modo POST: Meta envia payloads JSON com signature em X-Hub-Signature-256.
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMetaSignature } from '@/lib/meta-webhook';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  // raw body para validar a assinatura
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  // App secret: prioridade env, fallback config no banco
  let appSecret = process.env.META_APP_SECRET ?? '';
  if (!appSecret) {
    const cfg = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
    appSecret = cfg?.appSecret ?? '';
  }

  const signatureOk = verifyMetaSignature(rawBody, signature, appSecret);

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  const eventType =
    payload?.entry?.[0]?.changes?.[0]?.field ??
    payload?.object ??
    'unknown';

  // Persistir para auditoria/replay
  const ev = await prisma.webhookEvent.create({
    data: {
      event: eventType,
      payload: rawBody.slice(0, 100_000), // limita
      signatureOk,
      processed: false,
    },
  });

  if (!signatureOk) {
    // Mesmo com assinatura inválida, retornamos 200 para o Meta
    // não retry-forever; mas marcamos no log.
    console.warn('Meta webhook: assinatura inválida', { id: ev.id });
    return NextResponse.json({ received: true });
  }

  // Processamento por tipo
  try {
    const change = payload?.entry?.[0]?.changes?.[0];
    const value = change?.value;

    if (eventType === 'account_review_update' && value?.account_review_status) {
      // value: { account_review_status: "APPROVED"|"REJECTED"|"PENDING", ... }
      const wabaId = payload?.entry?.[0]?.id;
      if (wabaId) {
        await prisma.contaMeta.updateMany({
          where: { wabaId },
          data: {
            verificacaoStatus: String(value.account_review_status).toUpperCase(),
          },
        });
      }
    }

    if (eventType === 'phone_number_quality_update' && value?.display_phone_number) {
      await prisma.numeroWhatsapp.updateMany({
        where: { phoneNumberId: value.phone_number_id ?? value.id ?? '' },
        data: {
          qualityRating: value.event ?? value.current_limit ?? value.new_quality_rating ?? 'GREEN',
          limiteMsg: value.current_limit ?? undefined,
        },
      });
    }

    if (eventType === 'message_template_status_update' && value?.message_template_id) {
      await prisma.messageTemplate.updateMany({
        where: { templateId: String(value.message_template_id) },
        data: {
          status: String(value.event ?? value.message_template_status ?? 'UNKNOWN').toUpperCase(),
          rejectionReason: value.reason ?? null,
        },
      });
    }

    await prisma.webhookEvent.update({
      where: { id: ev.id },
      data: { processed: true },
    });
  } catch (err: any) {
    await prisma.webhookEvent.update({
      where: { id: ev.id },
      data: { processed: false, errorMsg: err?.message ?? 'erro processamento' },
    });
  }

  return NextResponse.json({ received: true });
}
