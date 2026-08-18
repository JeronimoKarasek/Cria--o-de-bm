export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const sites = await prisma.siteVerificacao.findMany({
      orderBy: { createdAt: 'desc' },
      include: { empresa: { select: { nomeFantasia: true, cnpj: true } } },
    });

    return NextResponse.json(
      (sites ?? []).map((s: any) => ({
        ...(s ?? {}),
        createdAt: s?.createdAt?.toISOString?.() ?? '',
        updatedAt: s?.updatedAt?.toISOString?.() ?? '',
      }))
    );
  } catch (error: any) {
    console.error('List sites error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { empresaId, dominio, template, segmento, nomeEmpresa, descricao, corPrimaria, corSecundaria, incluirTermos, incluirPrivacidade, incluirLgpd } = body ?? {};

    if (!empresaId || !segmento || !nomeEmpresa) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Generate site content
    const conteudo = gerarConteudoSite({
      nomeEmpresa, segmento, descricao, dominio,
      incluirTermos: incluirTermos ?? true,
      incluirPrivacidade: incluirPrivacidade ?? true,
      incluirLgpd: incluirLgpd ?? true,
      corPrimaria: corPrimaria ?? '#1877F2',
      corSecundaria: corSecundaria ?? '#42B72A',
    });

    const site = await prisma.siteVerificacao.create({
      data: {
        empresaId,
        dominio: dominio ?? null,
        template: template ?? 'institucional',
        segmento,
        nomeEmpresa,
        descricao: descricao ?? null,
        corPrimaria: corPrimaria ?? '#1877F2',
        corSecundaria: corSecundaria ?? '#42B72A',
        incluirTermos: incluirTermos ?? true,
        incluirPrivacidade: incluirPrivacidade ?? true,
        incluirLgpd: incluirLgpd ?? true,
        conteudoGerado: conteudo,
        status: 'rascunho',
      },
    });

    await registrarAuditLog({
      acao: 'CRIAR',
      descricao: `Site BMS gerado para ${nomeEmpresa}`,
      entidade: 'SiteVerificacao',
      entidadeId: site?.id,
      userId: (session?.user as any)?.id,
      empresaId,
    });

    return NextResponse.json({
      ...(site ?? {}),
      createdAt: site?.createdAt?.toISOString?.() ?? '',
      updatedAt: site?.updatedAt?.toISOString?.() ?? '',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create site error:', error);
    return NextResponse.json({ error: 'Erro ao criar site' }, { status: 500 });
  }
}

function gerarConteudoSite(params: any): string {
  const { nomeEmpresa, segmento, descricao, dominio, incluirTermos, incluirPrivacidade, incluirLgpd, corPrimaria, corSecundaria } = params ?? {};
  const desc = descricao || `${nomeEmpresa} é uma empresa líder no segmento de ${segmento}, comprometida com a excelência e inovação.`;

  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nomeEmpresa ?? ''} - Site Oficial</title>
  <meta name="description" content="${desc}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #333; }
    .header { background: ${corPrimaria ?? '#1877F2'}; color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 24px; }
    .nav a { color: white; text-decoration: none; margin-left: 20px; font-size: 14px; }
    .hero { background: linear-gradient(135deg, ${corPrimaria ?? '#1877F2'}, ${corSecundaria ?? '#42B72A'}); color: white; padding: 80px 40px; text-align: center; }
    .hero h2 { font-size: 42px; margin-bottom: 16px; }
    .hero p { font-size: 18px; max-width: 600px; margin: 0 auto; opacity: 0.9; }
    .section { padding: 60px 40px; max-width: 1000px; margin: 0 auto; }
    .section h3 { font-size: 28px; margin-bottom: 20px; color: ${corPrimaria ?? '#1877F2'}; }
    .section p { line-height: 1.8; color: #555; margin-bottom: 16px; }
    .footer { background: #1a1a2e; color: #aaa; padding: 40px; text-align: center; font-size: 14px; }
    .footer a { color: ${corSecundaria ?? '#42B72A'}; text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <h1>${nomeEmpresa ?? ''}</h1>
    <nav class="nav">
      <a href="#sobre">Sobre</a>
      <a href="#contato">Contato</a>`;

  if (incluirTermos) html += `\n      <a href="#termos">Termos de Uso</a>`;
  if (incluirPrivacidade) html += `\n      <a href="#privacidade">Privacidade</a>`;

  html += `\n    </nav>\n  </header>

  <section class="hero">
    <h2>${nomeEmpresa ?? ''}</h2>
    <p>${desc}</p>
  </section>

  <section class="section" id="sobre">
    <h3>Sobre Nós</h3>
    <p>${desc}</p>
    <p>Atuamos no segmento de ${segmento ?? ''}, oferecendo soluções de alta qualidade para nossos clientes.</p>
  </section>

  <section class="section" id="contato">
    <h3>Contato</h3>
    <p>Entre em contato conosco para saber mais sobre nossos serviços.</p>
    ${dominio ? `<p>Website: <a href="https://${dominio}">${dominio}</a></p>` : ''}
  </section>`;

  if (incluirTermos) {
    html += `\n\n  <section class="section" id="termos">
    <h3>Termos de Uso</h3>
    <p>Ao acessar e utilizar este site, você concorda com os seguintes termos e condições. O conteúdo deste site é protegido por direitos autorais e de propriedade intelectual da ${nomeEmpresa ?? ''}.</p>
    <p>É proibida a reprodução total ou parcial do conteúdo sem autorização prévia. A ${nomeEmpresa ?? ''} reserva-se o direito de modificar estes termos a qualquer momento.</p>
  </section>`;
  }

  if (incluirPrivacidade) {
    html += `\n\n  <section class="section" id="privacidade">
    <h3>Política de Privacidade</h3>
    <p>A ${nomeEmpresa ?? ''} está comprometida com a proteção dos dados pessoais de seus clientes e visitantes. Coletamos apenas informações necessárias para a prestação de nossos serviços.</p>
    <p>Seus dados pessoais não serão compartilhados com terceiros sem seu consentimento expresso, exceto quando exigido por lei.</p>
  </section>`;
  }

  if (incluirLgpd) {
    html += `\n\n  <section class="section" id="lgpd">
    <h3>Conformidade LGPD</h3>
    <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), a ${nomeEmpresa ?? ''} garante os direitos de acesso, correção, exclusão e portabilidade dos dados pessoais.</p>
    <p>Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato com nosso Encarregado de Proteção de Dados.</p>
  </section>`;
  }

  html += `\n\n  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} ${nomeEmpresa ?? ''}. Todos os direitos reservados.</p>
    ${dominio ? `<p><a href="https://${dominio}">${dominio}</a></p>` : ''}
  </footer>
</body>
</html>`;

  return html;
}
