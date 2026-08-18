/**
 * Template Meta-ready v1 (E2) — HTML single-file multi-seção.
 * Dados reais da Empresa; sem deploy Hostinger (E3).
 */

export type SiteTemplateInput = {
  nomeEmpresa: string;
  razaoSocial?: string | null;
  segmento: string;
  descricao?: string | null;
  dominio?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  website?: string | null;
  corPrimaria?: string;
  corSecundaria?: string;
  incluirTermos?: boolean;
  incluirPrivacidade?: boolean;
  incluirLgpd?: boolean;
  metaPixelId?: string | null;
  canonicalUrl?: string | null;
};

export type SiteChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  weight: number; // pontos de trust estimados (só informativo)
};

export type SiteArtifact = {
  html: string;
  robotsTxt: string;
  sitemapXml: string;
  checklist: SiteChecklistItem[];
  scoreReady: number; // 0-100 qualidade footprint (não é trust da empresa)
  missing: string[];
};

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCnpj(cnpj?: string | null): string {
  const c = String(cnpj ?? '').replace(/\D/g, '');
  if (c.length !== 14) return cnpj ? String(cnpj) : '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function buildAddress(p: SiteTemplateInput): string {
  const parts = [p.endereco, p.cidade, p.estado, p.cep].filter(Boolean);
  return parts.join(' — ');
}

export function buildSiteChecklist(p: SiteTemplateInput): SiteChecklistItem[] {
  const items: SiteChecklistItem[] = [
    { id: 'nome', label: 'Nome da empresa', ok: Boolean(p.nomeEmpresa?.trim()), weight: 5 },
    { id: 'cnpj', label: 'CNPJ', ok: Boolean(p.cnpj && String(p.cnpj).replace(/\D/g, '').length >= 14), weight: 15 },
    { id: 'email', label: 'E-mail de contato', ok: Boolean(p.email?.includes('@')), weight: 10 },
    { id: 'telefone', label: 'Telefone', ok: Boolean(p.telefone && String(p.telefone).replace(/\D/g, '').length >= 10), weight: 10 },
    { id: 'endereco', label: 'Endereço', ok: Boolean(p.endereco?.trim()), weight: 10 },
    { id: 'cidade_uf', label: 'Cidade/UF', ok: Boolean(p.cidade?.trim() && p.estado?.trim()), weight: 5 },
    { id: 'segmento', label: 'Segmento', ok: Boolean(p.segmento?.trim()), weight: 5 },
    { id: 'descricao', label: 'Descrição institucional', ok: Boolean((p.descricao ?? '').trim().length >= 40), weight: 10 },
    { id: 'dominio', label: 'Domínio / URL alvo', ok: Boolean((p.dominio || p.canonicalUrl || p.website)?.trim()), weight: 10 },
    { id: 'termos', label: 'Página Termos de Uso', ok: p.incluirTermos !== false, weight: 5 },
    { id: 'privacidade', label: 'Página Privacidade', ok: p.incluirPrivacidade !== false, weight: 5 },
    { id: 'lgpd', label: 'Seção LGPD', ok: p.incluirLgpd !== false, weight: 5 },
    { id: 'pixel', label: 'Meta Pixel (opcional)', ok: Boolean(p.metaPixelId?.trim()), weight: 5 },
  ];
  return items;
}

export function buildSiteArtifact(p: SiteTemplateInput): SiteArtifact {
  const checklist = buildSiteChecklist(p);
  const max = checklist.reduce((s, i) => s + i.weight, 0) || 1;
  const got = checklist.filter((i) => i.ok).reduce((s, i) => s + i.weight, 0);
  const scoreReady = Math.round((got / max) * 100);
  const missing = checklist.filter((i) => !i.ok).map((i) => i.label);

  const nome = esc(p.nomeEmpresa);
  const razao = esc(p.razaoSocial || p.nomeEmpresa);
  const segmento = esc(p.segmento);
  const descRaw =
    (p.descricao && p.descricao.trim()) ||
    `${p.nomeEmpresa} atua no segmento de ${p.segmento}, com atendimento profissional e conformidade legal.`;
  const desc = esc(descRaw);
  const cnpjFmt = esc(formatCnpj(p.cnpj));
  const email = esc(p.email);
  const telefone = esc(p.telefone);
  const endereco = esc(buildAddress(p));
  const primary = esc(p.corPrimaria || '#1877F2');
  const secondary = esc(p.corSecundaria || '#42B72A');
  const host =
    (p.canonicalUrl ||
      (p.dominio ? (p.dominio.startsWith('http') ? p.dominio : `https://${p.dominio}`) : null) ||
      (p.website
        ? p.website.startsWith('http')
          ? p.website
          : `https://${p.website}`
        : null) ||
      '') as string;
  const hostEsc = esc(host);
  const year = new Date().getFullYear();
  const incluirTermos = p.incluirTermos !== false;
  const incluirPrivacidade = p.incluirPrivacidade !== false;
  const incluirLgpd = p.incluirLgpd !== false;
  const pixel = (p.metaPixelId || '').replace(/[^\d]/g, '');

  const pixelBlock = pixel
    ? `
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixel}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1"/></noscript>`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: p.nomeEmpresa,
    legalName: p.razaoSocial || p.nomeEmpresa,
    ...(p.cnpj ? { taxID: String(p.cnpj).replace(/\D/g, '') } : {}),
    ...(host ? { url: host } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.telefone ? { telephone: p.telefone } : {}),
    ...(p.endereco
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: p.endereco,
            addressLocality: p.cidade || undefined,
            addressRegion: p.estado || undefined,
            postalCode: p.cep || undefined,
            addressCountry: 'BR',
          },
        }
      : {}),
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nome} | Site Oficial</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="index,follow">
  ${host ? `<link rel="canonical" href="${hostEsc}">` : ''}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${nome} | Site Oficial">
  <meta property="og:description" content="${desc}">
  ${host ? `<meta property="og:url" content="${hostEsc}">` : ''}
  <meta property="og:locale" content="pt_BR">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${nome}">
  <meta name="twitter:description" content="${desc}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${pixelBlock}
  <style>
    :root { --primary: ${primary}; --secondary: ${secondary}; --text:#1f2937; --muted:#6b7280; --bg:#f8fafc; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color:var(--text); background:#fff; line-height:1.6; }
    a { color: var(--primary); }
    .header { background: var(--primary); color:#fff; padding:16px 24px; display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:20; }
    .header h1 { font-size:1.15rem; font-weight:700; }
    .nav { display:flex; flex-wrap:wrap; gap:14px; }
    .nav a { color:#fff; text-decoration:none; font-size:.9rem; opacity:.95; }
    .nav a:hover { text-decoration:underline; }
    .hero { background: linear-gradient(135deg, var(--primary), var(--secondary)); color:#fff; padding:72px 24px; text-align:center; }
    .hero h2 { font-size:clamp(1.75rem,4vw,2.5rem); margin-bottom:12px; }
    .hero p { max-width:720px; margin:0 auto; opacity:.95; font-size:1.05rem; }
    .section { padding:56px 24px; max-width:960px; margin:0 auto; }
    .section.alt { background: var(--bg); max-width:none; }
    .section.alt .inner { max-width:960px; margin:0 auto; }
    .section h3 { font-size:1.5rem; color:var(--primary); margin-bottom:16px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-top:20px; }
    .card { border:1px solid #e5e7eb; border-radius:12px; padding:18px; background:#fff; }
    .card h4 { margin-bottom:8px; font-size:1rem; }
    .card p { color:var(--muted); font-size:.92rem; }
    .meta-list { list-style:none; display:grid; gap:8px; }
    .meta-list li { padding:10px 12px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; }
    .meta-list strong { display:inline-block; min-width:110px; color:#111; }
    .footer { background:#0f172a; color:#94a3b8; padding:36px 24px; text-align:center; font-size:.9rem; }
    .footer a { color: var(--secondary); }
    .badge { display:inline-block; margin-top:16px; background:rgba(255,255,255,.15); padding:6px 12px; border-radius:999px; font-size:.8rem; }
    @media (max-width:640px) { .hero { padding:48px 16px; } .section { padding:40px 16px; } }
  </style>
</head>
<body>
  <header class="header">
    <h1>${nome}</h1>
    <nav class="nav" aria-label="Principal">
      <a href="#inicio">Início</a>
      <a href="#sobre">Sobre</a>
      <a href="#servicos">Serviços</a>
      <a href="#contato">Contato</a>
      ${incluirTermos ? '<a href="#termos">Termos</a>' : ''}
      ${incluirPrivacidade ? '<a href="#privacidade">Privacidade</a>' : ''}
      ${incluirLgpd ? '<a href="#lgpd">LGPD</a>' : ''}
    </nav>
  </header>

  <section class="hero" id="inicio">
    <h2>${nome}</h2>
    <p>${desc}</p>
    <span class="badge">Segmento: ${segmento}</span>
  </section>

  <section class="section" id="sobre">
    <h3>Sobre nós</h3>
    <p>${desc}</p>
    <p style="margin-top:12px;color:var(--muted)">
      Razão social: <strong>${razao}</strong>
      ${cnpjFmt ? ` · CNPJ: <strong>${cnpjFmt}</strong>` : ''}
    </p>
    <p style="margin-top:12px">Atuamos no segmento de <strong>${segmento}</strong>, com foco em atendimento transparente e presença digital confiável.</p>
  </section>

  <section class="section alt" id="servicos">
    <div class="inner">
      <h3>Serviços</h3>
      <div class="grid">
        <div class="card"><h4>Atendimento comercial</h4><p>Orientação e suporte para clientes e parceiros no segmento de ${segmento}.</p></div>
        <div class="card"><h4>Presença digital</h4><p>Canal oficial da empresa para informações institucionais e contato.</p></div>
        <div class="card"><h4>Conformidade</h4><p>Políticas de privacidade e LGPD disponíveis neste site.</p></div>
      </div>
    </div>
  </section>

  <section class="section" id="contato">
    <h3>Contato</h3>
    <ul class="meta-list">
      ${email ? `<li><strong>E-mail</strong> <a href="mailto:${email}">${email}</a></li>` : '<li><strong>E-mail</strong> Não informado</li>'}
      ${telefone ? `<li><strong>Telefone</strong> <a href="tel:${telefone.replace(/[^\d+]/g, '')}">${telefone}</a></li>` : '<li><strong>Telefone</strong> Não informado</li>'}
      ${endereco ? `<li><strong>Endereço</strong> ${endereco}</li>` : '<li><strong>Endereço</strong> Não informado</li>'}
      ${hostEsc ? `<li><strong>Website</strong> <a href="${hostEsc}" rel="noopener">${hostEsc}</a></li>` : ''}
      ${cnpjFmt ? `<li><strong>CNPJ</strong> ${cnpjFmt}</li>` : ''}
    </ul>
  </section>
${
  incluirTermos
    ? `
  <section class="section alt" id="termos">
    <div class="inner">
      <h3>Termos de Uso</h3>
      <p>Ao acessar este site, você concorda com estes termos. O conteúdo é de propriedade de ${nome} (${razao}).</p>
      <p style="margin-top:10px;color:var(--muted)">É proibida a reprodução total ou parcial sem autorização prévia. Podemos atualizar estes termos a qualquer momento, com publicação nesta página.</p>
      <p style="margin-top:10px;color:var(--muted)">O uso indevido das informações ou tentativas de acesso não autorizado são vedados.</p>
    </div>
  </section>`
    : ''
}
${
  incluirPrivacidade
    ? `
  <section class="section" id="privacidade">
    <h3>Política de Privacidade</h3>
    <p>${nome} trata dados pessoais de forma responsável, coletando apenas o necessário para atendimento e operação do site.</p>
    <p style="margin-top:10px;color:var(--muted)">Não vendemos dados pessoais. O compartilhamento ocorre apenas quando exigido por lei ou com base legal aplicável.</p>
    <p style="margin-top:10px;color:var(--muted)">Cookies e tecnologias similares podem ser usados para funcionamento e métricas${pixel ? ' (incluindo Meta Pixel, quando ativo)' : ''}.</p>
    ${email ? `<p style="margin-top:10px">Dúvidas: <a href="mailto:${email}">${email}</a></p>` : ''}
  </section>`
    : ''
}
${
  incluirLgpd
    ? `
  <section class="section alt" id="lgpd">
    <div class="inner">
      <h3>Conformidade LGPD</h3>
      <p>Em conformidade com a Lei nº 13.709/2018 (LGPD), garantimos direitos de acesso, correção, eliminação, portabilidade e informação sobre o tratamento de dados.</p>
      <p style="margin-top:10px;color:var(--muted)">Controlador: ${razao}${cnpjFmt ? ` — CNPJ ${cnpjFmt}` : ''}.</p>
      <p style="margin-top:10px;color:var(--muted)">Para exercer direitos ou contatar o encarregado de dados, use o canal de contato oficial desta página.</p>
    </div>
  </section>`
    : ''
}

  <footer class="footer">
    <p>&copy; ${year} ${nome}. Todos os direitos reservados.</p>
    ${cnpjFmt ? `<p style="margin-top:8px">CNPJ ${cnpjFmt}</p>` : ''}
    ${hostEsc ? `<p style="margin-top:8px"><a href="${hostEsc}">${hostEsc}</a></p>` : ''}
  </footer>
</body>
</html>`;

  const robotsTxt = `User-agent: *
Allow: /
${host ? `Sitemap: ${host.replace(/\/$/, '')}/sitemap.xml` : ''}
`.trim();

  const sitemapXml = host
    ? `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(host.replace(/\/$/, ''))}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>`
    : `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;

  return { html, robotsTxt, sitemapXml, checklist, scoreReady, missing };
}

export function empresaToTemplateInput(
  empresa: {
    nomeFantasia?: string | null;
    razaoSocial?: string | null;
    segmento?: string | null;
    cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    website?: string | null;
  },
  site: {
    nomeEmpresa?: string | null;
    segmento?: string | null;
    descricao?: string | null;
    dominio?: string | null;
    corPrimaria?: string | null;
    corSecundaria?: string | null;
    incluirTermos?: boolean | null;
    incluirPrivacidade?: boolean | null;
    incluirLgpd?: boolean | null;
    publishedUrl?: string | null;
  },
  extras?: { metaPixelId?: string | null; canonicalUrl?: string | null }
): SiteTemplateInput {
  return {
    nomeEmpresa: site.nomeEmpresa || empresa.nomeFantasia || empresa.razaoSocial || 'Empresa',
    razaoSocial: empresa.razaoSocial,
    segmento: site.segmento || empresa.segmento || 'Geral',
    descricao: site.descricao,
    dominio: site.dominio || undefined,
    cnpj: empresa.cnpj,
    email: empresa.email,
    telefone: empresa.telefone,
    endereco: empresa.endereco,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
    website: empresa.website,
    corPrimaria: site.corPrimaria || '#1877F2',
    corSecundaria: site.corSecundaria || '#42B72A',
    incluirTermos: site.incluirTermos ?? true,
    incluirPrivacidade: site.incluirPrivacidade ?? true,
    incluirLgpd: site.incluirLgpd ?? true,
    metaPixelId: extras?.metaPixelId,
    canonicalUrl: extras?.canonicalUrl || site.publishedUrl || undefined,
  };
}
