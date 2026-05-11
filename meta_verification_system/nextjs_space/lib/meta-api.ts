/**
 * Meta Graph API Integration Library
 * Centraliza todas as chamadas à API da Meta
 */

const GRAPH_API_BASE = 'https://graph.facebook.com';

export function getGraphApiUrl(version: string = 'v21.0') {
  return `${GRAPH_API_BASE}/${version}`;
}

// ==========================================
// BUSINESS VERIFICATION
// ==========================================
export async function getBusinessVerificationStatus(businessId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${businessId}?fields=verification_status,name,id,created_time&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar status' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// BUSINESS PORTFOLIOS (WABAs)
// ==========================================
export async function getOwnedWABAs(businessId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar WABAs' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

export async function getWABAReviewStatus(wabaId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${wabaId}?fields=account_review_status,name,id,currency,timezone_id,message_template_namespace&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar status WABA' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// PHONE NUMBERS
// ==========================================
export async function getPhoneNumbers(wabaId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,code_verification_status,name_status&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar números' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

export async function requestVerificationCode(phoneNumberId: string, accessToken: string, codeMethod: 'SMS' | 'VOICE' = 'SMS', language: string = 'pt_BR', version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${phoneNumberId}/request_code`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_method: codeMethod, language }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao solicitar código' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

export async function verifyCode(phoneNumberId: string, accessToken: string, code: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${phoneNumberId}/verify_code`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Código inválido' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

export async function registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${phoneNumberId}/register`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao registrar número' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

export async function deregisterPhoneNumber(phoneNumberId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${phoneNumberId}/deregister`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp' }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao desregistrar' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// AD ACCOUNTS
// ==========================================
export async function getAdAccounts(businessId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${businessId}/owned_ad_accounts?fields=id,name,account_id,account_status,currency,timezone_name,amount_spent&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar Ad Accounts' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// PAGES
// ==========================================
export async function getBusinessPages(businessId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${businessId}/owned_pages?fields=id,name,category,verification_status,link&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar páginas' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// MESSAGE TEMPLATES
// ==========================================
export async function getMessageTemplates(wabaId: string, accessToken: string, version: string = 'v21.0') {
  try {
    const url = `${getGraphApiUrl(version)}/${wabaId}/message_templates?fields=id,name,status,category,language,quality_score&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message ?? 'Erro ao buscar templates' };
    }
    return { success: true, data: await res.json() };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Erro de conexão' };
  }
}

// ==========================================
// HELPER: Status labels
// ==========================================
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
