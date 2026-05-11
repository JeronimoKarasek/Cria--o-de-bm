-- ============================================
-- MetaVerify - Schema SQL para Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FUNCIONARIO');
CREATE TYPE "EmpresaStatus" AS ENUM ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA');
CREATE TYPE "DocumentoTipo" AS ENUM ('CNPJ_CARTAO', 'CONTRATO_SOCIAL', 'PROCURACAO', 'COMPROVANTE_ENDERECO', 'IDENTIDADE', 'OUTRO');
CREATE TYPE "DocumentoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');
CREATE TYPE "ContaMetaStatus" AS ENUM ('ATIVA', 'DESATIVADA', 'EM_REVISAO', 'SUSPENSA', 'CANCELADA', 'RESTRITA');

-- Tabela: User (usu\u00e1rios do sistema)
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FUNCIONARIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Tabela: Empresa
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "segmento" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "website" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "status" "EmpresaStatus" NOT NULL DEFAULT 'PENDENTE',
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Empresa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");
CREATE INDEX "Empresa_cnpj_idx" ON "Empresa"("cnpj");
CREATE INDEX "Empresa_status_idx" ON "Empresa"("status");
CREATE INDEX "Empresa_criadoPorId_idx" ON "Empresa"("criadoPorId");

-- Tabela: Documento
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" "DocumentoTipo" NOT NULL,
    "nome" TEXT NOT NULL,
    "cloudStoragePath" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Documento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Documento_empresaId_idx" ON "Documento"("empresaId");
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- Tabela: ContaMeta
CREATE TABLE "ContaMeta" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nome" TEXT NOT NULL,
    "metaBusinessId" TEXT,
    "adAccountId" TEXT,
    "wabaId" TEXT,
    "appId" TEXT,
    "accessToken" TEXT,
    "status" "ContaMetaStatus" NOT NULL DEFAULT 'ATIVA',
    "tipo" TEXT NOT NULL DEFAULT 'Business Manager',
    "verificacaoStatus" TEXT DEFAULT 'NAO_VERIFICADA',
    "observacoes" TEXT,
    "motivoRestricao" TEXT,
    "dataRestricao" TIMESTAMP(3),
    "recursoEnviado" BOOLEAN NOT NULL DEFAULT false,
    "dataRecurso" TIMESTAMP(3),
    "recursoDescricao" TEXT,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaMeta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContaMeta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ContaMeta_empresaId_idx" ON "ContaMeta"("empresaId");
CREATE INDEX "ContaMeta_status_idx" ON "ContaMeta"("status");

-- Tabela: NumeroWhatsapp
CREATE TABLE "NumeroWhatsapp" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "displayName" TEXT,
    "qualityRating" TEXT DEFAULT 'GREEN',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "codigoVerificacao" TEXT,
    "pin2fa" TEXT,
    "limiteMsg" TEXT DEFAULT '250',
    "categoria" TEXT DEFAULT 'UTILITY',
    "contaMetaId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroWhatsapp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NumeroWhatsapp_contaMetaId_fkey" FOREIGN KEY ("contaMetaId") REFERENCES "ContaMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NumeroWhatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NumeroWhatsapp_contaMetaId_idx" ON "NumeroWhatsapp"("contaMetaId");
CREATE INDEX "NumeroWhatsapp_empresaId_idx" ON "NumeroWhatsapp"("empresaId");
CREATE INDEX "NumeroWhatsapp_status_idx" ON "NumeroWhatsapp"("status");

-- Tabela: ContaMetaHistorico (histórico de mudanças de status)
CREATE TABLE "ContaMetaHistorico" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "statusAnterior" TEXT NOT NULL,
    "statusNovo" TEXT NOT NULL,
    "motivo" TEXT,
    "contaMetaId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaMetaHistorico_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContaMetaHistorico_contaMetaId_fkey" FOREIGN KEY ("contaMetaId") REFERENCES "ContaMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ContaMetaHistorico_contaMetaId_idx" ON "ContaMetaHistorico"("contaMetaId");
CREATE INDEX "ContaMetaHistorico_createdAt_idx" ON "ContaMetaHistorico"("createdAt");

-- Tabela: SiteVerificacao
CREATE TABLE "SiteVerificacao" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "dominio" TEXT,
    "template" TEXT NOT NULL DEFAULT 'institucional',
    "segmento" TEXT NOT NULL,
    "nomeEmpresa" TEXT NOT NULL,
    "descricao" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#1877F2',
    "corSecundaria" TEXT NOT NULL DEFAULT '#42B72A',
    "incluirTermos" BOOLEAN NOT NULL DEFAULT true,
    "incluirPrivacidade" BOOLEAN NOT NULL DEFAULT true,
    "incluirLgpd" BOOLEAN NOT NULL DEFAULT true,
    "conteudoGerado" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVerificacao_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SiteVerificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SiteVerificacao_empresaId_idx" ON "SiteVerificacao"("empresaId");

-- Tabela: TrustScoreHistorico
CREATE TABLE "TrustScoreHistorico" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "score" INTEGER NOT NULL,
    "detalhes" TEXT,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreHistorico_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustScoreHistorico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrustScoreHistorico_empresaId_idx" ON "TrustScoreHistorico"("empresaId");
CREATE INDEX "TrustScoreHistorico_createdAt_idx" ON "TrustScoreHistorico"("createdAt");

-- Tabela: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "acao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "userId" TEXT,
    "empresaId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_empresaId_idx" ON "AuditLog"("empresaId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Tabela: MetaApiConfig (configuração da API da Meta)
CREATE TABLE "MetaApiConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT,
    "accessToken" TEXT,
    "webhookToken" TEXT,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v21.0',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaApiConfig_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- FIM DO SCHEMA
-- ============================================
