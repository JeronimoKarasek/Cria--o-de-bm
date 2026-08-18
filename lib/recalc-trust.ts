import { prisma } from '@/lib/prisma';
import { calcularTrustScore } from '@/lib/trust-score';

/**
 * Recalcula e persiste trust score da empresa com base no estado atual.
 */
export async function recalcTrustForEmpresa(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      documentos: { select: { status: true } },
      contasMeta: { select: { status: true } },
      sitesVerificacao: { select: { status: true, publishedUrl: true, publishedAt: true } },
      dominios: { select: { verificado: true, dominio: true } },
    },
  });

  if (!empresa) {
    throw new Error('Empresa não encontrada');
  }

  const totalDocumentos = empresa.documentos?.length ?? 0;
  const documentosAprovados = (empresa.documentos ?? []).filter((d) => d.status === 'APROVADO').length;
  const temContaMeta = (empresa.contasMeta?.length ?? 0) > 0;
  const contaMetaAtiva = (empresa.contasMeta ?? []).some((c) => c.status === 'ATIVA');
  const temSiteVerificacao = (empresa.sitesVerificacao?.length ?? 0) > 0;
  const sitePublicado = (empresa.sitesVerificacao ?? []).some(
    (s) => s.status === 'publicado' && Boolean(s.publishedUrl || s.publishedAt)
  );
  const temDominio =
    (empresa.dominios?.length ?? 0) > 0 ||
    Boolean(empresa.website) ||
    (empresa.sitesVerificacao ?? []).some((s) => Boolean(s.publishedUrl));

  const breakdown = calcularTrustScore({
    totalDocumentos,
    documentosAprovados,
    temCnpj: Boolean(empresa.cnpj),
    temEndereco: Boolean(empresa.endereco),
    temTelefone: Boolean(empresa.telefone),
    temEmail: Boolean(empresa.email),
    temWebsite: Boolean(empresa.website) || sitePublicado,
    temDominio,
    temContaMeta,
    contaMetaAtiva,
    temSiteVerificacao,
    sitePublicado,
  });

  await prisma.$transaction([
    prisma.empresa.update({
      where: { id: empresaId },
      data: { trustScore: breakdown.total },
    }),
    prisma.trustScoreHistorico.create({
      data: {
        empresaId,
        score: breakdown.total,
        detalhes: JSON.stringify(breakdown),
      },
    }),
  ]);

  return breakdown;
}

/** Preview de trust sem gravar (para dry-run UI). */
export async function previewTrustForEmpresa(
  empresaId: string,
  overrides?: { forceSiteExists?: boolean; forceSitePublicado?: boolean }
) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      documentos: { select: { status: true } },
      contasMeta: { select: { status: true } },
      sitesVerificacao: { select: { status: true, publishedUrl: true, publishedAt: true } },
      dominios: { select: { verificado: true } },
    },
  });
  if (!empresa) throw new Error('Empresa não encontrada');

  const totalDocumentos = empresa.documentos?.length ?? 0;
  const documentosAprovados = (empresa.documentos ?? []).filter((d) => d.status === 'APROVADO').length;
  const temContaMeta = (empresa.contasMeta?.length ?? 0) > 0;
  const contaMetaAtiva = (empresa.contasMeta ?? []).some((c) => c.status === 'ATIVA');
  const temSiteVerificacao =
    overrides?.forceSiteExists ?? (empresa.sitesVerificacao?.length ?? 0) > 0;
  const sitePublicado =
    overrides?.forceSitePublicado ??
    (empresa.sitesVerificacao ?? []).some((s) => s.status === 'publicado' && Boolean(s.publishedUrl));
  const temDominio =
    (empresa.dominios?.length ?? 0) > 0 ||
    Boolean(empresa.website) ||
    sitePublicado;

  return calcularTrustScore({
    totalDocumentos,
    documentosAprovados,
    temCnpj: Boolean(empresa.cnpj),
    temEndereco: Boolean(empresa.endereco),
    temTelefone: Boolean(empresa.telefone),
    temEmail: Boolean(empresa.email),
    temWebsite: Boolean(empresa.website) || sitePublicado,
    temDominio,
    temContaMeta,
    contaMetaAtiva,
    temSiteVerificacao,
    sitePublicado,
  });
}
