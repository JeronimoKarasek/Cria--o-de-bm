# Conectar BM via Facebook Login (OAuth)

## Objetivo

Permitir que um admin autentique com a conta Facebook dona da Business Manager e o Cria-BM grave um **user access token long-lived (~60 dias)**, listando e opcionalmente importando BMs/WABAs/números — sem colar System User Token.

## Fluxo

1. Admin salva **App ID + App Secret** em Integração Meta (uma vez). **Access Token manual é opcional** — o OAuth grava o token depois.
2. Clica **Entrar com Facebook e conectar BM** (opcional: escolhe Empresa para auto-import).
3. `GET /api/meta-api/oauth/start` → redirect dialog Facebook.
4. Facebook → `GET /api/meta-api/oauth/callback?code&state`.
5. Backend:
   - valida `state` HMAC (userId + nonce + TTL 15min);
   - troca `code` → short token → **long-lived**;
   - grava `accessToken` em `MetaApiConfig` ativo;
   - lista `me/businesses`;
   - se `empresaId` no state: upsert `ContaMeta` + WABA + números (mesmo padrão do import manual);
   - audit log + redirect `/integracao-meta?oauth=ok&bms=N`.

## Config no Meta App

1. [developers.facebook.com/apps](https://developers.facebook.com/apps/) → app Business.
2. Produto **Facebook Login** (ou Login for Business).
3. **Valid OAuth Redirect URIs**:
   - Prod: `https://cria-o-de-bm.vercel.app/api/meta-api/oauth/callback`
   - Local: `http://localhost:3000/api/meta-api/oauth/callback`
4. Permissões (Development: roles do app; Live: App Review):
   - `business_management` (obrigatório para listar BMs)
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `pages_show_list`, `ads_read`, `public_profile`, `email` (úteis / default)
5. App em modo Development: só usuários com role no app conseguem autorizar.

## Env

```
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v21.0
# opcional override de scopes
# META_OAUTH_SCOPES=business_management,...
NEXTAUTH_URL=https://cria-o-de-bm.vercel.app
NEXTAUTH_SECRET=...   # assina o state OAuth
```

Credenciais também podem viver só no banco (`MetaApiConfig`).

## Rotas

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/meta-api/oauth/start?empresaId=&returnTo=` | session ADMIN |
| GET | `/api/meta-api/oauth/callback` | session + state; middleware liberado |

## Limitações

- Token de **usuário** expira (~60d long-lived). Renovar = clicar de novo no botão.
- System User Token (nunca expira) continua disponível no fluxo manual / env `META_SYSTEM_USER_TOKEN`.
- Auto-import cria `ContaMeta` com id `bm-{businessId}` — mesmo contrato do import por BM ID.
- Não implementa Embedded Signup de WABA nova (E5+); só conecta BMs já existentes na conta.

## Segurança

- `state` assinado HMAC-SHA256 com `NEXTAUTH_SECRET` (fallback `META_APP_SECRET`).
- Callback confere `state.u === session.user.id`.
- App Secret e tokens nunca voltam em claro na API GET (máscara + flags `hasAppSecret` / `hasAccessToken`).
- Re-save de config sem secret preserva o secret anterior.
