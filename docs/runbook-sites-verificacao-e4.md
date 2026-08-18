# Runbook E4 — Sites de Verificação (produção controlada)

**Prod:** https://cria-o-de-bm.vercel.app  
**Repo:** `/root/Cria--o-de-bm`  
**Plano:** `/root/farol/plans/cria-bm-plano-producao-hibrido-2026-08-18.md`

## Flags (prod Vercel)

| Env | Default prod | Efeito |
|-----|--------------|--------|
| `FEATURE_HOSTINGER_LIVE` | **false** | Bloqueia free-sub / dns-sub writes |
| `FEATURE_DOMAIN_PURCHASE` | **false** | Bloqueia compra L2/L3 |
| `HOSTINGER_API_TOKEN` | set | Read (status) sempre; write só com LIVE |
| `HOSTINGER_DEFAULT_PARENT_DOMAIN` | farolbase.com | Parent default L1 |
| `SITES_PUBLIC_BASE_URL` | https://cria-o-de-bm.vercel.app | Canônica `/s/{id}` |
| `VERCEL_CNAME_TARGET` | opcional | Target CNAME L1 |
| `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` | opcional | Add domain no projeto |

**Regra:** não ligar `FEATURE_HOSTINGER_LIVE=true` sem OK do CEO e piloto publish-app estável.

## Fluxo padrão cliente (sem Hostinger write)

1. Login → **Sites de Verificação BMS**
2. **Gerar site** a partir de empresa real (descrição ≥ ~40 chars, CNPJ/endereço se possível)
3. **Dry-run** → conferir `scoreReady`, missing, Δtrust
4. **Publicar app** → status `publicado`, `publishedUrl = {SITES_PUBLIC_BASE_URL}/s/{id}`
5. Abrir live em aba anônima → HTTPS 200, HTML com razão social
6. **Trust Score** da empresa sobe (componente site publicado)
7. Registrar URL no processo Meta/BM se for o caso

### API equivalente

```bash
# requer sessão cookie NextAuth
curl -X POST "https://cria-o-de-bm.vercel.app/api/sites-verificacao/{id}/publish" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"mode":"publish-app"}'
```

## Rollback / despublicar

1. UI: botão **Despublicar** no card (confirm)
2. Ou API: `{"mode":"rollback","reason":"incidente-x"}`  
   - opcional `"clearHostingerMeta": true` limpa hostingerDomain/parent/ref no DB
3. Efeito:
   - `status = rascunho`
   - `publishedUrl = null`
   - `GET /s/{id}` deixa de servir HTML (404 / não publicado)
   - `conteudoGerado` **permanece** (republicar é barato)
   - audit: `ROLLBACK_SITE` / `UNPUBLISH_SITE`
   - `ProvisionJob` type `UNPUBLISH`
4. **DNS Hostinger:** NÃO é apagado automaticamente. Se L1 CNAME foi criado:
   - hPanel → DNS zone do parent → remover CNAME do sub  
   - ou API `PUT /api/dns/v1/zones/{parent}` com overwrite (cuidado: overwrite=true)
5. Republicar: **Publicar app** de novo

## Free-sub (L0) — só com LIVE=true

1. CEO: `vercel env` → `FEATURE_HOSTINGER_LIVE=true` + redeploy
2. UI **Free-sub** ou `mode: free-sub`
3. Gera `*.hostingersite.com` (nome) + publish-app
4. Live canônica continua `/s/{id}` (files Hostinger = read-only)
5. Se falhar: UI mostra toast + `lastPublishError` no card; audit/job error

## DNS-sub (L1) — só com LIVE=true

```json
{
  "mode": "dns-sub",
  "parentDomain": "farolbase.com",
  "subdomain": "empresa-x",
  "cnameTarget": "cria-o-de-bm.vercel.app",
  "createHostingSubdomain": false
}
```

Pós-DNS: validar resolução + add domain Vercel se `VERCEL_TOKEN` set. Fallback sempre `/s/{id}`.

## Monitoramento

| Sinal | Onde |
|-------|------|
| `lastPublishError` | Card UI + coluna DB |
| Audit | `/auditoria` — PUBLICAR_APP, PROVISION_*, ROLLBACK_*, UNPUBLISH_* |
| Jobs | tabela `ProvisionJob` (FREE_SUB, DNS_SUB, UNPUBLISH) |
| Health Hostinger | `/api/integracoes/hostinger/status` (auth) |
| Público | `curl -sI https://cria-o-de-bm.vercel.app/s/{id}` |

## Checklist go-live (3 clientes)

Para cada cliente:

- [ ] Empresa com dados reais
- [ ] Site gerado + dry-run scoreReady aceitável
- [ ] publish-app → HTTPS 200 em `/s/{id}`
- [ ] `status=publicado` + URL gravada
- [ ] Trust reflete site
- [ ] Sem `lastPublishError`
- [ ] Rollback testado em **1** ambiente (piloto) antes do lote

## Incidentes comuns

| Sintoma | Ação |
|---------|------|
| `/s/id` 307 login | middleware matcher — path deve ser público |
| `/s/id` 404 “não encontrado” | id errado ou site não existe |
| `/s/id` vazio / não publicado | status ≠ publicado → Publicar app |
| Free-sub 403 | `FEATURE_HOSTINGER_LIVE` false |
| DNS falha | zone parent não na conta; ver lastPublishError + job.result |
| Trust não sobe | recalc falhou — rodar dry-run e republicar; checar empresaId |

## Ligar Hostinger LIVE (procedimento)

1. 3 clientes OK só com publish-app  
2. OK CEO explícito  
3. `vercel env add/update FEATURE_HOSTINGER_LIVE true production`  
4. Redeploy prod  
5. 1 free-sub piloto  
6. Se OK, documentar parent L1 preferido  

## Contatos / paths

- Secrets: `/root/.config/farol/secrets/hostinger/`, `vercel_token`  
- Skill: `cria-bm-sites-verificacao`  
- Plano E5+ só após footprint 3 clientes  
