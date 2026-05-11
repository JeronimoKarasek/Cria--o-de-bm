export interface TrustScoreBreakdown {
  documentos: number;
  perfil: number;
  dominio: number;
  contaMeta: number;
  siteVerificacao: number;
  total: number;
}

export function calcularTrustScore(params: {
  totalDocumentos: number;
  documentosAprovados: number;
  temCnpj: boolean;
  temEndereco: boolean;
  temTelefone: boolean;
  temEmail: boolean;
  temWebsite: boolean;
  temDominio: boolean;
  temContaMeta: boolean;
  contaMetaAtiva: boolean;
  temSiteVerificacao: boolean;
  sitePublicado: boolean;
}): TrustScoreBreakdown {
  let documentos = 0;
  if ((params?.totalDocumentos ?? 0) > 0) {
    const ratio = (params?.documentosAprovados ?? 0) / (params?.totalDocumentos ?? 1);
    documentos = Math.round(ratio * 25);
  }

  let perfil = 0;
  if (params?.temCnpj) perfil += 5;
  if (params?.temEndereco) perfil += 5;
  if (params?.temTelefone) perfil += 5;
  if (params?.temEmail) perfil += 5;
  if (params?.temWebsite) perfil += 5;

  let dominio = 0;
  if (params?.temDominio) dominio += 10;
  if (params?.temWebsite) dominio += 5;

  let contaMeta = 0;
  if (params?.temContaMeta) contaMeta += 10;
  if (params?.contaMetaAtiva) contaMeta += 10;

  let siteVerificacao = 0;
  if (params?.temSiteVerificacao) siteVerificacao += 10;
  if (params?.sitePublicado) siteVerificacao += 10;

  const total = Math.min(100, documentos + perfil + dominio + contaMeta + siteVerificacao);

  return { documentos, perfil, dominio, contaMeta, siteVerificacao, total };
}

export function getTrustScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Regular';
  if (score >= 20) return 'Baixo';
  return 'Crítico';
}

export function getTrustScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}
