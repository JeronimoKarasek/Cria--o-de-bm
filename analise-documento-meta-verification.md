# Análise Completa — "Meta Verification SaaS"

> Documento: *Arquitetura Completa — criação de estrutura para validar empresa no Meta Business*

---

## 1. Visão Geral do Projeto

O documento descreve a arquitetura de um **SaaS B2B** focado em criar **infraestrutura automatizada de confiança digital** para aprovação de empresas no Meta Business. O conceito central é que o problema **não é criar sites**, mas sim construir uma camada completa de **reputação digital empresarial** que satisfaça o "grafo de confiança" avaliado pela Meta.

### Conceito Central
- **Trust Infrastructure Layer** — Camada de infraestrutura de confiança
- **Compliance Automation** — Automação de conformidade
- **Business Identity Provisioning** — Provisionamento de identidade empresarial
- **Meta Readiness Engine** — Motor de prontidão para aprovação Meta

### Proposta de Valor
> *"Empresa pronta para aprovação Meta em 24h."*

### Referências de Mercado
Stripe Atlas, Mercury, Shopify, Cloudflare Zero Trust — adaptados para "Business Verification Infrastructure".

---

## 2. Problema que Resolve

### O que a maioria faz (errado):
| Prática Errada | Consequência |
|---|---|
| Landing page genérica | Reprovação |
| Domínio novo | BM bloqueado |
| Email improvisado | Score ruim |
| WordPress mal feito | WABA limitada |
| Verificação imediata | Contas queimadas |

### O que está faltando (raiz do problema):
- Consistência jurídica
- Reputação digital
- Sinais de legitimidade
- Footprint operacional

---

## 3. Arquitetura de Alto Nível

```
Frontend SaaS (Next.js)
    ↓
API Gateway
    ↓
Core Orchestrator
    ↓
┌──────────────────────────────┐
│ Compliance Engine            │
│ Meta Readiness Engine        │
│ Domain Provisioning          │
│ Website Generator            │
│ DNS Automation               │
│ Email Provisioning           │
│ Trust Score Engine           │
│ Document Validator           │
│ WABA Manager                 │
└──────────────────────────────┘
    ↓
Supabase / PostgreSQL
    ↓
Workers / Queue System (Redis + Celery)
    ↓
External Providers
```

---

## 4. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | Next.js + Tailwind + shadcn/ui | SSR/SSG para sites gerados |
| **Hosting Frontend** | Vercel | — |
| **Backend** | Python FastAPI (recomendado) | Melhor para automações, scraping, workers, IA, filas |
| **Alternativa Backend** | Node.js NestJS | — |
| **Banco de Dados** | Supabase / PostgreSQL | Multi-tenant desde o início |
| **Infraestrutura** | Cloudflare + Hetzner ou AWS | — |
| **Filas** | Redis + Celery/RQ | Tarefas assíncronas: DNS, SSL, scraping, validações |

---

## 5. Módulos do Sistema (10 módulos)

### A. Tenant Manager
Gerenciamento multi-tenant de clientes.

**Entidades de dados:**
- `companies` — empresas cadastradas
- `domains` — domínios registrados
- `business_managers` — BMs do Meta
- `wabas` — contas WhatsApp Business API
- `verification_requests` — solicitações de verificação
- `trust_scores` — pontuações de confiança
- `generated_sites` — sites gerados
- `dns_records` — registros DNS
- `emails` — emails corporativos
- `documents` — documentos enviados

### B. Domain Provisioning Engine
**Funções:** Registrar domínio → Conectar DNS → Configurar SSL → Validar propagação

**Integrações:** Cloudflare API, Registro.br, GoDaddy, Namecheap

**Fluxo:** Cliente compra plano → sistema registra domínio → configura DNS → ativa SSL → conecta email

### C. Website Generator Engine (coração do sistema)
Gera sites "Meta-ready" usando **geração estática** (Next.js SSR/SSG). **Não usar WordPress.**

**Templates por nicho:**
- Fintech, Advocacia, Agência, E-commerce, Saúde, Logística, SaaS

**Páginas obrigatórias:**
- Home, Sobre, Contato, Política de Privacidade, Termos de Uso, LGPD

**Dados obrigatórios no site:**
- CNPJ, Razão Social, Telefone, Endereço, Email Corporativo

### D. AI Content Engine
Geração de conteúdo via IA para:
- Copy institucional, Políticas, FAQs, Termos, Sobre a empresa

**Requisito crítico:** NÃO gerar texto genérico. Usar:
- Embeddings, Industry templates, Compliance prompts

### E. Compliance Engine
Decide se a "empresa está pronta ou não".

**Checklist de verificação:**
- ✔ Domínio validado
- ✔ SSL ativo
- ✔ Email corporativo
- ✔ Política de privacidade
- ✔ Termos de uso
- ✔ CNPJ coerente
- ✔ Telefone válido
- ✔ Indexação Google
- ✔ Favicon
- ✔ Social links
- ✔ DNS correto
- ✔ Business schema.org

### F. Trust Score Engine (diferencial do produto)
Score proprietário de **0 a 100**.

| Sinal | Peso |
|---|---|
| Domínio > 90 dias | +15 |
| SSL válido | +10 |
| Email corporativo | +15 |
| Google indexado | +10 |
| Política de privacidade | +10 |
| DNS consistente | +10 |
| Social presence | +10 |
| CNPJ encontrado | +20 |

### G. Meta Readiness Engine
Simula a avaliação da Meta e detecta riscos.

**Verificações:**
- Inconsistência de nome
- Domínio suspeito
- Ausência de páginas legais
- Links quebrados
- Spam patterns
- Conteúdo sensível

### H. WABA Integration Layer
**Integrações:** Meta Graph API, Embedded Signup, WhatsApp Cloud API

**Funções:**
- Criar app no Meta
- Registrar WABA
- Validar domínio
- Conectar webhook
- Onboarding automático

### I. Document Validation Engine
**Uploads:** Contrato social, Cartão CNPJ, Comprovante de endereço

**IA verifica:** Nome, OCR, Coerência entre documentos

### J. Monitoring Engine
**Monitora:**
- Status de verificação
- Bloqueios de conta
- Qualidade da WABA
- Limites de mensagens

---

## 6. Fluxo Completo do Usuário

```
Cadastro
  ↓
Escolha do nicho
  ↓
Upload CNPJ
  ↓
Sistema gera automaticamente:
  → domínio
  → email corporativo
  → site institucional
  → páginas legais
  ↓
Compliance scan
  ↓
Trust score
  ↓
Correções automáticas
  ↓
Validação de domínio Meta
  ↓
Solicitação business verification
  ↓
Onboarding WhatsApp API
  ↓
Dashboard de monitoramento
```

---

## 7. Microserviços (Arquitetura Física)

| Serviço | Responsabilidade |
|---|---|
| `auth-service` | Autenticação e autorização |
| `tenant-service` | Gestão de clientes/empresas |
| `website-service` | Geração de sites |
| `compliance-service` | Verificações de conformidade |
| `meta-service` | Integração com Meta APIs |
| `domain-service` | Provisionamento de domínios |
| `notification-service` | Notificações |
| `ai-service` | Geração de conteúdo IA |
| `billing-service` | Cobrança e planos |

---

## 8. Automações Críticas

### DNS Automation
- Criação automática de **SPF, DKIM, DMARC**
- Sem isso → trust menor

### Google Indexation
- `sitemap.xml` automático
- `robots.txt` configurado
- `schema.org` (Business structured data)

### Warmup System
- **Aging system** — envelhecimento de domínios
- **Conteúdo progressivo** — publicação gradual
- **Trust timeline** — cronograma de construção de confiança

---

## 9. Modelo de Monetização

| Plano | Recursos |
|---|---|
| **Básico** | Site + Domínio + Email |
| **Profissional** | + WABA onboarding + Compliance |
| **Enterprise** | + Multi BM + Múltiplos domínios + Monitoramento |

### Receita Recorrente (MRR)
- Hospedagem
- Monitoramento
- Compliance contínuo
- Suporte WABA

---

## 10. Roadmap de Implementação

### Fase 1 — MVP (Prioridade)
**Construir:**
- ✅ Geração de site institucional
- ✅ Páginas legais automáticas
- ✅ Trust Score
- ✅ Validação de domínio

**NÃO construir ainda:**
- ❌ IA avançada
- ❌ Multi-cloud
- ❌ Microserviços complexos

### Fase 2 — Automação Meta
- Embedded Signup
- Onboarding WABA
- Trust analysis avançado

### Fase 3 — Escala
- Multi-empresa
- White-label
- APIs públicas
- Marketplace de parceiros

---

## 11. Oportunidade de Expansão

Após consolidar Meta Business, expandir para:
- Google Merchant
- Stripe Verification
- TikTok Business
- Google Ads Verification
- Apple Business Connect
- LinkedIn Company Trust

> Evolução: de "Meta Verification SaaS" para **"TrustOps Platform"**

---

## 12. Resumo de Requisitos Técnicos para Implementação

### Integrações Externas Necessárias
1. **Meta Graph API** — verificação de negócios, WABA
2. **WhatsApp Cloud API** — onboarding, webhooks
3. **Cloudflare API** — DNS, SSL, CDN
4. **Registradores de domínio** — Registro.br, GoDaddy, Namecheap
5. **Serviço de Email** — provisionamento de email corporativo
6. **Google Search Console / Indexing API** — indexação
7. **API de IA** (OpenAI ou similar) — geração de conteúdo
8. **OCR / Document AI** — validação de documentos

### Dados Essenciais por Empresa
- CNPJ, Razão Social, Nome Fantasia
- Endereço completo, Telefone, Email
- Nicho/segmento de atuação
- Documentos (Contrato Social, Cartão CNPJ, Comprovante)
- Domínio escolhido
- IDs do Meta Business Manager

### Requisitos Não-Funcionais
- **Multi-tenant** desde o início
- **Filas assíncronas** para tarefas longas
- **Monitoramento contínuo** de status
- **Segurança** de dados sensíveis (documentos, credenciais)
- **Escalabilidade** para múltiplas empresas simultâneas
