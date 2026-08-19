# E5 — Meta Factory (criar BM / WABA / número)

## Objetivo

Criar recursos Meta a partir do Cria-BM (ADMIN), com **dry-run por padrão** até `FEATURE_META_CREATE_LIVE=true`.

Conectar BM **existente** = E5a OAuth (`docs/meta-facebook-oauth-bm.md`).  
**Criar** BM/WABA/número = este doc.

## Flag

```
FEATURE_META_CREATE_LIVE=false   # default seguro — só simula
FEATURE_META_CREATE_LIVE=true    # writes reais na Graph API
```

Mesmo com LIVE=true, body `dryRun: true` força simulação.

## API

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/meta-api/factory` | ADMIN — status LIVE + BMs do token |
| POST | `/api/meta-api/factory` | ADMIN — actions abaixo |

### Actions POST

```json
// 1) Criar Business Manager
{
  "action": "create_bm",
  "empresaId": "...",
  "name": "BM Cliente X",
  "vertical": "OTHER",
  "surveyEmail": "admin@cliente.com",
  "dryRun": true
}

// 2) Criar WABA no BM
{
  "action": "create_waba",
  "empresaId": "...",
  "businessId": "123456789",
  "name": "WABA Cliente X",
  "currency": "BRL",
  "dryRun": true
}

// 3) Adicionar número ao WABA
{
  "action": "add_phone",
  "empresaId": "...",
  "wabaId": "...",
  "cc": "55",
  "phone_number": "11999999999",
  "verified_name": "Empresa X",
  "requestCode": true,
  "codeMethod": "SMS",
  "dryRun": true
}

// 4) Verificar OTP (+ opcional register Cloud API)
{
  "action": "verify_phone",
  "phoneNumberId": "...",
  "code": "123456",
  "pin": "123456",
  "register": true
}
```

## Requisitos Meta

1. Token com `business_management` + WhatsApp scopes (OAuth ou System User).
2. **Criar BM** (`POST /me/businesses`) exige capability/app permission de business creation — muitos apps **não** têm em Development. Se a Meta recusar, use OAuth para **conectar** BM já criada no Business Suite.
3. WABA/phone: o user/token precisa ser admin do BM alvo.
4. App Review se app em Live mode para scopes avançados.

## Persistência local

- BM → `ContaMeta` id `bm-{businessId}`
- Phone → `NumeroWhatsapp` id `wapi-{phoneNumberId}`
- Audit: `FACTORY_DRY_RUN` | `FACTORY_CREATE` | `FACTORY_ERROR`

## UI

Integração Meta → card **Factory Meta (E5)** — dry-run default; create real só com flag + confirmação.

## Segurança

- Só role ADMIN
- LIVE off por padrão (igual Hostinger)
- Não loga tokens
- Rate/fila em escala = E6 (n8n); E5 core = API síncrona + audit
