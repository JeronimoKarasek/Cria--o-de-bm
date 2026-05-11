/**
 * Meta Graph API — biblioteca central de chamadas.
 *
 * Convenções:
 *  - Toda função recebe accessToken e (opcionalmente) version.
 *  - Sempre retorna { success, data } | { success: false, error }.
 *  - Tokens sensíveis nunca são logados.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v21.0';

export function getGraphApiUrl(version: string = DEFAULT_VERSION) {
  return `${GRAPH_API_BASE}/${version}`;
}

type ApiResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; code?: number; type?: string };

async function safeFetch<T = any>(
  url: string,
  init?: RequestInit,
  errorLabel = 'Erro na Graph API'
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      return {
        success: false,
        error: json?.error?.message ?? errorLabel,
        code: json?.error?.code,
        type: json?.error?.type,
      };
    }
    return { success: true, data: json as T };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erro de rede' };
  }
}

// ============================================================
// DEBUG / IDENTIDADE
// ============================================================
export async function debugToken(accessToken: string, version = DEFAULT_VERSION) {
  const url = `${getGraphApiUrl(version)}/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Token inválido');
}

export async function getMe(accessToken: string, version = DEFAULT_VERSION) {
  const url = `${getGraphApiUrl(version)}/me?fields=id,name&access_token=${accessToken}`;
  return safeFetch(url);
}

export async function listAccessibleBusinesses(
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/me/businesses?fields=id,name,verification_status,created_time&limit=100&access_token=${accessToken}`;
  return safeFetch(url);
}

// ============================================================
// BUSINESS MANAGER
// ============================================================
export async function getBusinessVerificationStatus(
  businessId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}?fields=verification_status,name,id,created_time,primary_page,link&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar status do BM');
}

/**
 * Cria uma Business Manager.
 * NOTA: requer permissão especial `business_creation` na app.
 */
export async function createBusiness(
  params: {
    name: string;
    vertical: string; // ex.: 'OTHER', 'ECOMMERCE'
    timezone_id?: number;
    primary_page?: string;
    surveyEmail: string;
    surveyBusinessType?: string;
  },
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/me/businesses`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    },
    'Erro ao criar Business Manager'
  );
}

// ============================================================
// WABAs
// ============================================================
export async function getOwnedWABAs(
  businessId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar WABAs');
}

export async function getWABAReviewStatus(
  wabaId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}?fields=account_review_status,name,id,currency,timezone_id,message_template_namespace,on_behalf_of_business_info&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar status WABA');
}

export async function createWABA(
  businessId: string,
  params: { name: string; currency?: string; timezone_id?: string },
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_whatsapp_business_accounts`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    },
    'Erro ao criar WABA'
  );
}

// ============================================================
// PHONE NUMBERS (WhatsApp)
// ============================================================
export async function getPhoneNumbers(
  wabaId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,code_verification_status,name_status&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar números');
}

export async function addPhoneNumber(
  wabaId: string,
  params: { cc: string; phone_number: string; verified_name: string },
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/phone_numbers`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    },
    'Erro ao adicionar número'
  );
}

export async function requestVerificationCode(
  phoneNumberId: string,
  accessToken: string,
  codeMethod: 'SMS' | 'VOICE' = 'SMS',
  language = 'pt_BR',
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${phoneNumberId}/request_code`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code_method: codeMethod, language }),
    },
    'Erro ao solicitar código'
  );
}

export async function verifyCode(
  phoneNumberId: string,
  accessToken: string,
  code: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${phoneNumberId}/verify_code`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code }),
    },
    'Código inválido'
  );
}

export async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${phoneNumberId}/register`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    },
    'Erro ao registrar número'
  );
}

export async function deregisterPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${phoneNumberId}/deregister`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp' }),
    },
    'Erro ao desregistrar número'
  );
}

// ============================================================
// AD ACCOUNTS / PAGES
// ============================================================
export async function getAdAccounts(
  businessId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_ad_accounts?fields=id,name,account_id,account_status,currency,timezone_name,amount_spent&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar Ad Accounts');
}

export async function getBusinessPages(
  businessId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_pages?fields=id,name,category,verification_status,link&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar páginas');
}

// ============================================================
// DOMÍNIOS
// ============================================================
export async function getOwnedDomains(
  businessId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_domains?fields=id,domain_name,is_verified&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar domínios');
}

export async function addOwnedDomain(
  businessId: string,
  domainName: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${businessId}/owned_domains`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ domain_name: domainName }),
    },
    'Erro ao adicionar domínio'
  );
}

export async function verifyDomain(
  domainId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${domainId}/verify`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    },
    'Erro ao iniciar verificação do domínio'
  );
}

// ============================================================
// MESSAGE TEMPLATES
// ============================================================
export async function getMessageTemplates(
  wabaId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/message_templates?fields=id,name,status,category,language,quality_score,rejected_reason,components&limit=200&access_token=${accessToken}`;
  return safeFetch(url, undefined, 'Erro ao buscar templates');
}

export async function createMessageTemplate(
  wabaId: string,
  params: {
    name: string;
    category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
    language: string; // ex: pt_BR
    components: any[]; // ver docs: HEADER, BODY, FOOTER, BUTTONS
  },
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/message_templates`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    },
    'Erro ao criar template'
  );
}

export async function deleteMessageTemplate(
  wabaId: string,
  templateName: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/message_templates?name=${encodeURIComponent(
    templateName
  )}&access_token=${accessToken}`;
  return safeFetch(url, { method: 'DELETE' }, 'Erro ao deletar template');
}

// ============================================================
// WEBHOOK / ASSINATURAS
// ============================================================
export async function subscribeAppToWABA(
  wabaId: string,
  accessToken: string,
  version = DEFAULT_VERSION
) {
  const url = `${getGraphApiUrl(version)}/${wabaId}/subscribed_apps`;
  return safeFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    },
    'Erro ao inscrever app no webhook do WABA'
  );
}

// ============================================================
// LABELS / HELPERS DE UI
// ============================================================
export const verificationStatusLabels: Record<string, string> = {
  not_verified: 'Não Verificada',
  pending: 'Pendente',
  verified: 'Verificada',
  NAO_VERIFICADA: 'Não Verificada',
  PENDENTE: 'Pendente',
  VERIFICADA: 'Verificada',
};

export const qualityRatingLabels: Record<string, { label: string; color: string }> = {
  GREEN: { label: 'Alta', color: 'text-green-600 bg-green-50' },
  YELLOW: { label: 'Média', color: 'text-yellow-600 bg-yellow-50' },
  RED: { label: 'Baixa', color: 'text-red-600 bg-red-50' },
  NA: { label: 'N/A', color: 'text-gray-600 bg-gray-50' },
};

export const phoneStatusLabels: Record<string, string> = {
  CONNECTED: 'Conectado',
  OFFLINE: 'Offline',
  PENDING: 'Pendente',
  FLAGGED: 'Sinalizado',
  RATE_LIMITED: 'Limite Atingido',
  DISABLED: 'Desabilitado',
  BANNED: 'Banido',
  PENDENTE: 'Pendente',
  REGISTRADO: 'Registrado',
  VERIFICADO: 'Verificado',
};

export const accountReviewStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
};
