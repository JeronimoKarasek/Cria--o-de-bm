/**
 * Meta factory helpers — create BM / WABA / phone com gates de segurança.
 * FEATURE_META_CREATE_LIVE=true habilita writes reais na Graph API.
 */

import {
  addPhoneNumber,
  createBusiness,
  createWABA,
  getBusinessVerificationStatus,
  getOwnedWABAs,
  getPhoneNumbers,
  requestVerificationCode,
  verifyCode,
  registerPhoneNumber,
} from '@/lib/meta-api';
import { prisma } from '@/lib/prisma';

export function isMetaCreateLive(): boolean {
  const v = (process.env.FEATURE_META_CREATE_LIVE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export async function resolveMetaAccessToken(opts?: {
  bodyToken?: string | null;
  contaMetaId?: string | null;
}): Promise<{ accessToken: string; apiVersion: string; source: string }> {
  if (opts?.bodyToken) {
    return { accessToken: opts.bodyToken, apiVersion: 'v21.0', source: 'body' };
  }
  if (opts?.contaMetaId) {
    const conta = await prisma.contaMeta.findUnique({ where: { id: opts.contaMetaId } });
    if (conta?.accessToken) {
      const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
      return {
        accessToken: conta.accessToken,
        apiVersion: config?.graphApiVersion ?? 'v21.0',
        source: 'contaMeta',
      };
    }
  }
  const config = await prisma.metaApiConfig.findFirst({ where: { ativo: true } });
  const token = config?.accessToken || process.env.META_SYSTEM_USER_TOKEN || '';
  if (!token) {
    throw new Error(
      'Access Token ausente. Conecte via Facebook Login ou salve System User Token na Integração Meta.'
    );
  }
  return {
    accessToken: token,
    apiVersion: config?.graphApiVersion ?? process.env.META_GRAPH_API_VERSION ?? 'v21.0',
    source: config?.accessToken ? 'metaApiConfig' : 'env',
  };
}

const VERTICALS = new Set([
  'ADVERTISING',
  'AUTOMOTIVE',
  'CONSUMER_PACKAGED_GOODS',
  'ECOMMERCE',
  'EDUCATION',
  'ENERGY_AND_UTILITIES',
  'ENTERTAINMENT_AND_MEDIA',
  'FINANCIAL_SERVICES',
  'GAMING',
  'GOVERNMENT_AND_POLITICS',
  'MARKETING',
  'ORGANIZATIONS_AND_ASSOCIATIONS',
  'PROFESSIONAL_SERVICES',
  'RETAIL',
  'TECHNOLOGY',
  'TELECOM',
  'TRAVEL',
  'OTHER',
]);

export function normalizeVertical(v?: string): string {
  const u = (v || 'OTHER').toUpperCase().replace(/\s+/g, '_');
  return VERTICALS.has(u) ? u : 'OTHER';
}

export type CreateBmInput = {
  empresaId: string;
  name: string;
  vertical?: string;
  timezone_id?: number;
  primary_page?: string;
  surveyEmail: string;
  surveyBusinessType?: string;
  dryRun?: boolean;
  accessToken?: string;
};

export async function factoryCreateBusiness(input: CreateBmInput) {
  const empresa = await prisma.empresa.findUnique({ where: { id: input.empresaId } });
  if (!empresa) throw new Error('Empresa não encontrada');

  const name = (input.name || empresa.nomeFantasia || empresa.razaoSocial || '').trim();
  if (!name || name.length < 3) throw new Error('Nome da BM deve ter ao menos 3 caracteres');

  const surveyEmail = (input.surveyEmail || '').trim().toLowerCase();
  if (!surveyEmail || !surveyEmail.includes('@')) {
    throw new Error('surveyEmail válido é obrigatório para criar BM');
  }

  const vertical = normalizeVertical(input.vertical);
  const payload = {
    name,
    vertical,
    timezone_id: input.timezone_id ?? 58, // America/Sao_Paulo approx
    primary_page: input.primary_page,
    surveyEmail,
    surveyBusinessType: input.surveyBusinessType || 'OTHER',
  };

  if (input.dryRun || !isMetaCreateLive()) {
    return {
      success: true as const,
      dryRun: true,
      live: isMetaCreateLive(),
      wouldPost: payload,
      message: isMetaCreateLive()
        ? 'dryRun=true — nada criado na Meta'
        : 'FEATURE_META_CREATE_LIVE=false — dry-run forçado. Set true no env Vercel para writes reais.',
    };
  }

  const { accessToken, apiVersion } = await resolveMetaAccessToken({ bodyToken: input.accessToken });
  const result = await createBusiness(payload, accessToken, apiVersion);
  if (!result.success) {
    return { success: false as const, error: result.error, code: result.code, type: result.type };
  }

  const businessId = String(result.data?.id || result.data?.business_id || '');
  if (!businessId) {
    return { success: false as const, error: 'Meta não retornou id da BM', raw: result.data };
  }

  let verificationStatus = 'NAO_VERIFICADA';
  const statusRes = await getBusinessVerificationStatus(businessId, accessToken, apiVersion);
  if (statusRes.success) {
    verificationStatus = statusRes.data?.verification_status ?? verificationStatus;
  }

  const contaMeta = await prisma.contaMeta.upsert({
    where: { id: `bm-${businessId}` },
    update: {
      nome: name,
      verificacaoStatus: verificationStatus,
      accessToken: accessToken,
      status: 'ATIVA',
    },
    create: {
      id: `bm-${businessId}`,
      nome: name,
      metaBusinessId: businessId,
      tipo: 'Business Manager',
      status: 'ATIVA',
      verificacaoStatus: verificationStatus,
      empresaId: input.empresaId,
      accessToken,
      observacoes: 'Criada via factory E5 (Graph API me/businesses)',
    },
  });

  return {
    success: true as const,
    dryRun: false,
    live: true,
    businessId,
    contaMetaId: contaMeta.id,
    data: result.data,
  };
}

export type CreateWabaInput = {
  empresaId: string;
  businessId: string;
  name: string;
  currency?: string;
  timezone_id?: string;
  contaMetaId?: string;
  dryRun?: boolean;
  accessToken?: string;
};

export async function factoryCreateWaba(input: CreateWabaInput) {
  const empresa = await prisma.empresa.findUnique({ where: { id: input.empresaId } });
  if (!empresa) throw new Error('Empresa não encontrada');

  const businessId = (input.businessId || '').trim();
  if (!businessId) throw new Error('businessId é obrigatório');

  const name = (input.name || `${empresa.nomeFantasia} WA`).trim();
  if (name.length < 3) throw new Error('Nome do WABA deve ter ao menos 3 caracteres');

  const payload = {
    name,
    currency: input.currency || 'BRL',
    timezone_id: input.timezone_id || '1',
  };

  if (input.dryRun || !isMetaCreateLive()) {
    return {
      success: true as const,
      dryRun: true,
      live: isMetaCreateLive(),
      wouldPost: { businessId, ...payload },
      message: isMetaCreateLive()
        ? 'dryRun=true — nada criado na Meta'
        : 'FEATURE_META_CREATE_LIVE=false — dry-run forçado.',
    };
  }

  const { accessToken, apiVersion } = await resolveMetaAccessToken({
    bodyToken: input.accessToken,
    contaMetaId: input.contaMetaId || `bm-${businessId}`,
  });

  const result = await createWABA(businessId, payload, accessToken, apiVersion);
  if (!result.success) {
    return { success: false as const, error: result.error, code: result.code, type: result.type };
  }

  const wabaId = String(result.data?.id || '');
  if (!wabaId) {
    return { success: false as const, error: 'Meta não retornou id do WABA', raw: result.data };
  }

  const contaId = input.contaMetaId || `bm-${businessId}`;
  const existing = await prisma.contaMeta.findUnique({ where: { id: contaId } });
  if (existing) {
    await prisma.contaMeta.update({
      where: { id: contaId },
      data: { wabaId, accessToken },
    });
  } else {
    await prisma.contaMeta.create({
      data: {
        id: contaId,
        nome: name,
        metaBusinessId: businessId,
        wabaId,
        tipo: 'Business Manager',
        status: 'ATIVA',
        empresaId: input.empresaId,
        accessToken,
        observacoes: 'WABA criada via factory E5',
      },
    });
  }

  return {
    success: true as const,
    dryRun: false,
    live: true,
    wabaId,
    businessId,
    contaMetaId: contaId,
    data: result.data,
  };
}

export type AddPhoneInput = {
  empresaId: string;
  wabaId: string;
  cc: string;
  phone_number: string;
  verified_name: string;
  contaMetaId?: string;
  dryRun?: boolean;
  accessToken?: string;
  requestCode?: boolean;
  codeMethod?: 'SMS' | 'VOICE';
};

export async function factoryAddPhone(input: AddPhoneInput) {
  const empresa = await prisma.empresa.findUnique({ where: { id: input.empresaId } });
  if (!empresa) throw new Error('Empresa não encontrada');

  const wabaId = (input.wabaId || '').trim();
  const cc = (input.cc || '55').replace(/\D/g, '');
  const phone = (input.phone_number || '').replace(/\D/g, '');
  const verifiedName = (input.verified_name || '').trim();

  if (!wabaId) throw new Error('wabaId é obrigatório');
  if (!phone || phone.length < 8) throw new Error('phone_number inválido');
  if (!verifiedName || verifiedName.length < 3) throw new Error('verified_name obrigatório (min 3)');

  const payload = { cc, phone_number: phone, verified_name: verifiedName };

  if (input.dryRun || !isMetaCreateLive()) {
    return {
      success: true as const,
      dryRun: true,
      live: isMetaCreateLive(),
      wouldPost: { wabaId, ...payload, requestCode: Boolean(input.requestCode) },
      message: isMetaCreateLive()
        ? 'dryRun=true — nada criado na Meta'
        : 'FEATURE_META_CREATE_LIVE=false — dry-run forçado.',
    };
  }

  let contaMetaId = input.contaMetaId;
  if (!contaMetaId) {
    const conta = await prisma.contaMeta.findFirst({
      where: { empresaId: input.empresaId, wabaId },
    });
    contaMetaId = conta?.id;
  }
  if (!contaMetaId) {
    throw new Error('contaMetaId não resolvido — importe/crie a BM antes de adicionar número');
  }

  const { accessToken, apiVersion } = await resolveMetaAccessToken({
    bodyToken: input.accessToken,
    contaMetaId,
  });

  const result = await addPhoneNumber(wabaId, payload, accessToken, apiVersion);
  if (!result.success) {
    return { success: false as const, error: result.error, code: result.code, type: result.type };
  }

  const phoneNumberId = String(result.data?.id || '');
  if (!phoneNumberId) {
    return { success: false as const, error: 'Meta não retornou phone number id', raw: result.data };
  }

  const display = `+${cc}${phone}`;
  const numId = `wapi-${phoneNumberId}`;
  await prisma.numeroWhatsapp.upsert({
    where: { id: numId },
    update: {
      numero: display,
      displayName: verifiedName,
      phoneNumberId,
      status: 'PENDENTE',
    },
    create: {
      id: numId,
      numero: display,
      phoneNumberId,
      displayName: verifiedName,
      status: 'PENDENTE',
      contaMetaId,
      empresaId: input.empresaId,
    },
  });

  let codeRequested = false;
  let codeError: string | undefined;
  if (input.requestCode) {
    const codeRes = await requestVerificationCode(
      phoneNumberId,
      accessToken,
      input.codeMethod || 'SMS',
      'pt_BR',
      apiVersion
    );
    codeRequested = codeRes.success;
    if (!codeRes.success) codeError = codeRes.error;
  }

  return {
    success: true as const,
    dryRun: false,
    live: true,
    phoneNumberId,
    numeroId: numId,
    display,
    codeRequested,
    codeError,
    data: result.data,
  };
}

export type VerifyPhoneInput = {
  phoneNumberId: string;
  code: string;
  pin?: string;
  register?: boolean;
  contaMetaId?: string;
  accessToken?: string;
};

export async function factoryVerifyPhone(input: VerifyPhoneInput) {
  if (!isMetaCreateLive()) {
    return {
      success: false as const,
      error: 'FEATURE_META_CREATE_LIVE=false — verificação real bloqueada',
    };
  }
  const code = (input.code || '').trim();
  if (!code) throw new Error('code OTP é obrigatório');

  const { accessToken, apiVersion } = await resolveMetaAccessToken({
    bodyToken: input.accessToken,
    contaMetaId: input.contaMetaId,
  });

  const v = await verifyCode(input.phoneNumberId, accessToken, code, apiVersion);
  if (!v.success) return { success: false as const, error: v.error, code: v.code };

  let registered = false;
  let registerError: string | undefined;
  if (input.register && input.pin) {
    const r = await registerPhoneNumber(input.phoneNumberId, accessToken, input.pin, apiVersion);
    registered = r.success;
    if (!r.success) registerError = r.error;
  }

  await prisma.numeroWhatsapp.updateMany({
    where: { phoneNumberId: input.phoneNumberId },
    data: {
      status: registered ? 'CONNECTED' : 'VERIFICADO',
      pin2fa: input.pin || undefined,
    },
  });

  return {
    success: true as const,
    verified: true,
    registered,
    registerError,
    data: v.data,
  };
}

export async function listFactorySnapshot(accessToken: string, apiVersion: string, businessId: string) {
  const [biz, wabas] = await Promise.all([
    getBusinessVerificationStatus(businessId, accessToken, apiVersion),
    getOwnedWABAs(businessId, accessToken, apiVersion),
  ]);
  const phones: any[] = [];
  if (wabas.success && wabas.data?.data) {
    for (const w of wabas.data.data) {
      const p = await getPhoneNumbers(w.id, accessToken, apiVersion);
      if (p.success && p.data?.data) {
        phones.push(...p.data.data.map((x: any) => ({ ...x, wabaId: w.id })));
      }
    }
  }
  return { biz, wabas: wabas.success ? wabas.data?.data : [], phones };
}
