'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Plus,
  Eye,
  Code,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Shield,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const SEGMENTOS = [
  'Tecnologia', 'Marketing Digital', 'E-commerce', 'Alimentação',
  'Moda e Vestuário', 'Saúde', 'Educação', 'Finanças',
  'Imobiliário', 'Automotivo', 'Turismo', 'Entretenimento', 'Outro',
];

const TEMPLATES = [
  { id: 'institucional', label: 'Institucional', desc: 'Site corporativo completo' },
  { id: 'landing', label: 'Landing Page', desc: 'Página única de conversão' },
  { id: 'portfolio', label: 'Portfólio', desc: 'Vitrine de serviços' },
];

type ChecklistItem = { id: string; label: string; ok: boolean; weight: number };
type DryRunResult = {
  mode: string;
  siteId: string;
  statusAtual?: string;
  canonicalGuess?: string | null;
  publicAppUrl?: string | null;
  artifact?: {
    checklist?: ChecklistItem[];
    scoreReady?: number;
    missing?: string[];
    robotsTxt?: string;
    sitemapXml?: string;
    htmlLength?: number;
    html?: string;
  };
  trust?: {
    atual?: { total?: number };
    seRascunhoComSite?: { total?: number };
    sePublicado?: { total?: number };
    deltaPublicar?: number;
  };
  nextSteps?: string[];
  hostinger?: { configured?: boolean; live?: boolean; enabled?: boolean; note?: string };
};

export function SitesVerificacaoContent() {
  const [sites, setSites] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [form, setForm] = useState({
    empresaId: '',
    dominio: '',
    template: 'institucional',
    segmento: '',
    nomeEmpresa: '',
    descricao: '',
    corPrimaria: '#1877F2',
    corSecundaria: '#42B72A',
    incluirTermos: true,
    incluirPrivacidade: true,
    incluirLgpd: true,
    metaPixelId: '',
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sites-verificacao').then((r: any) => r?.json?.()),
      fetch('/api/empresas').then((r: any) => r?.json?.()),
    ])
      .then(([s, e]: any[]) => {
        setSites(Array.isArray(s) ? s : []);
        setEmpresas(Array.isArray(e) ? e : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEmpresaChange = (empresaId: string) => {
    const emp = (empresas ?? []).find((e: any) => e?.id === empresaId);
    setForm((prev: any) => ({
      ...(prev ?? {}),
      empresaId,
      nomeEmpresa: emp?.nomeFantasia ?? '',
      segmento: emp?.segmento ?? '',
      dominio: emp?.website?.replace(/^https?:\/\//, '') ?? prev?.dominio ?? '',
    }));
  };

  const handleCreate = async () => {
    if (!form?.empresaId || !form?.nomeEmpresa || !form?.segmento) {
      toast.error('Selecione uma empresa');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        ...form,
        metaPixelId: form.metaPixelId?.trim() || undefined,
      };
      const res = await fetch('/api/sites-verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const score = data?.artifact?.scoreReady;
        toast.success(
          score != null
            ? `Site BMS gerado (scoreReady ${score}/100)`
            : 'Site BMS gerado com sucesso!'
        );
        setShowCreate(false);
        fetchData();
        if (data?.artifact?.html) {
          setPreviewHtml(data.artifact.html);
        } else if (data?.conteudoGerado) {
          setPreviewHtml(data.conteudoGerado);
        }
      } else {
        toast.error(data?.error ?? 'Erro ao gerar site');
      }
    } catch {
      toast.error('Erro ao gerar site');
    } finally {
      setCreating(false);
    }
  };

  const runPublish = async (
    siteId: string,
    mode: 'dry-run' | 'local-mark' | 'publish-app' | 'free-sub' | 'dns-sub',
    extra?: Record<string, unknown>
  ) => {
    setBusyId(siteId);
    try {
      const res = await fetch(`/api/sites-verificacao/${siteId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          data?.hostinger && data.hostinger.live === false
            ? ' (ative FEATURE_HOSTINGER_LIVE no env)'
            : '';
        toast.error((data?.error ?? 'Falha no publish') + detail);
        return;
      }

      if (mode === 'dry-run') {
        setDryRun(data as DryRunResult);
        setDryRunOpen(true);
        if (data?.artifact?.html) setPreviewHtml(data.artifact.html);
        toast.success(
          `Dry-run OK — scoreReady ${data?.artifact?.scoreReady ?? '—'}/100 · Δtrust ${
            data?.trust?.deltaPublicar ?? 0
          }`
        );
      } else if (mode === 'publish-app') {
        toast.success(
          `Publicado no app · ${data?.publishedUrl || data?.publicPath || '/s/' + siteId} · trust ${
            data?.trust?.total ?? '—'
          }`
        );
        if (data?.publishedUrl) window.open(data.publishedUrl, '_blank');
        fetchData();
      } else if (mode === 'free-sub') {
        toast.success(
          `Free-sub ${data?.freeSubdomain ?? ''} · live ${data?.publishedUrl ?? ''} · trust ${
            data?.trust?.total ?? '—'
          }`
        );
        if (data?.publishedUrl) window.open(data.publishedUrl, '_blank');
        fetchData();
      } else if (mode === 'dns-sub') {
        toast.success(
          `DNS ${data?.fqdn ?? ''} → ${data?.cnameTarget ?? ''} · ${data?.publishedUrl ?? ''}`
        );
        if (data?.publishedUrl) window.open(data.publishedUrl, '_blank');
        fetchData();
      } else {
        toast.success(
          `Marcado como publicado (local) · trust ${data?.trust?.total ?? '—'}`
        );
        fetchData();
      }
    } catch {
      toast.error('Erro de rede no publish');
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = async (siteId: string) => {
    setBusyId(siteId);
    try {
      const res = await fetch('/api/sites-verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateOnly: true, siteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Falha ao regenerar');
        return;
      }
      toast.success(
        `HTML regenerado · scoreReady ${data?.artifact?.scoreReady ?? '—'}/100`
      );
      fetchData();
      const html = data?.site?.conteudoGerado || data?.artifact?.html;
      if (html) setPreviewHtml(html);
    } catch {
      toast.error('Erro ao regenerar');
    } finally {
      setBusyId(null);
    }
  };

  const downloadText = (filename: string, content: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Sites de Verificação BMS
          </h1>
          <p className="text-muted-foreground mt-1">
            Template Meta-ready · publish-app / free-sub / DNS · checklist de trust (E3)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Gerar Novo Site
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Site de Verificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <select
                value={form?.empresaId ?? ''}
                onChange={(e: any) => handleEmpresaChange(e?.target?.value ?? '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {(empresas ?? []).map((emp: any) => (
                  <option key={emp?.id} value={emp?.id}>
                    {emp?.nomeFantasia ?? ''} - {emp?.cnpj ?? ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-3 gap-2">
                {(TEMPLATES ?? []).map((t: any) => (
                  <button
                    key={t?.id}
                    type="button"
                    onClick={() =>
                      setForm((prev: any) => ({ ...(prev ?? {}), template: t?.id }))
                    }
                    className={`p-3 rounded-lg border text-center transition-all text-sm ${
                      form?.template === t?.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{t?.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t?.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Domínio</Label>
                <Input
                  value={form?.dominio ?? ''}
                  onChange={(e: any) =>
                    setForm((prev: any) => ({
                      ...(prev ?? {}),
                      dominio: e?.target?.value ?? '',
                    }))
                  }
                  placeholder="exemplo.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label>Segmento</Label>
                <select
                  value={form?.segmento ?? ''}
                  onChange={(e: any) =>
                    setForm((prev: any) => ({
                      ...(prev ?? {}),
                      segmento: e?.target?.value ?? '',
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {(SEGMENTOS ?? []).map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form?.corPrimaria ?? '#1877F2'}
                    onChange={(e: any) =>
                      setForm((prev: any) => ({
                        ...(prev ?? {}),
                        corPrimaria: e?.target?.value ?? '',
                      }))
                    }
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={form?.corPrimaria ?? ''}
                    onChange={(e: any) =>
                      setForm((prev: any) => ({
                        ...(prev ?? {}),
                        corPrimaria: e?.target?.value ?? '',
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form?.corSecundaria ?? '#42B72A'}
                    onChange={(e: any) =>
                      setForm((prev: any) => ({
                        ...(prev ?? {}),
                        corSecundaria: e?.target?.value ?? '',
                      }))
                    }
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={form?.corSecundaria ?? ''}
                    onChange={(e: any) =>
                      setForm((prev: any) => ({
                        ...(prev ?? {}),
                        corSecundaria: e?.target?.value ?? '',
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form?.descricao ?? ''}
                onChange={(e: any) =>
                  setForm((prev: any) => ({
                    ...(prev ?? {}),
                    descricao: e?.target?.value ?? '',
                  }))
                }
                rows={2}
                placeholder="Breve descrição da empresa (mín. ~40 chars para scoreReady)..."
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Pixel ID (opcional)</Label>
              <Input
                value={form?.metaPixelId ?? ''}
                onChange={(e: any) =>
                  setForm((prev: any) => ({
                    ...(prev ?? {}),
                    metaPixelId: e?.target?.value ?? '',
                  }))
                }
                placeholder="Somente números"
              />
            </div>
            <div className="space-y-2">
              <Label>Páginas Legais</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'incluirTermos', label: 'Termos de Uso' },
                  { key: 'incluirPrivacidade', label: 'Privacidade' },
                  { key: 'incluirLgpd', label: 'LGPD' },
                ].map((item: any) => (
                  <label key={item?.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form as any)?.[item?.key] ?? true}
                      onChange={(e: any) =>
                        setForm((prev: any) => ({
                          ...(prev ?? {}),
                          [item?.key]: e?.target?.checked,
                        }))
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm">{item?.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={creating}>
              {creating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Globe className="w-4 h-4 mr-2" />
              )}
              Gerar Site Meta-ready
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview do Site</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden" style={{ height: '70vh' }}>
            <iframe
              srcDoc={previewHtml ?? ''}
              className="w-full h-full"
              title="Preview"
              sandbox="allow-scripts"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dry-run Dialog */}
      <Dialog open={dryRunOpen} onOpenChange={setDryRunOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" /> Dry-run publish
            </DialogTitle>
          </DialogHeader>
          {dryRun && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">scoreReady</p>
                    <p className="text-2xl font-bold">
                      {dryRun.artifact?.scoreReady ?? '—'}
                      <span className="text-sm font-normal text-muted-foreground">/100</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Trust atual</p>
                    <p className="text-2xl font-bold">{dryRun.trust?.atual?.total ?? '—'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Se publicado</p>
                    <p className="text-2xl font-bold">
                      {dryRun.trust?.sePublicado?.total ?? '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Δ ao publicar</p>
                    <p className="text-2xl font-bold text-primary">
                      +{dryRun.trust?.deltaPublicar ?? 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {dryRun.canonicalGuess && (
                <p className="text-muted-foreground">
                  URL canônica estimada:{' '}
                  <span className="font-mono text-foreground">{dryRun.canonicalGuess}</span>
                </p>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2 font-medium">
                  <Shield className="w-4 h-4" /> Checklist footprint
                </div>
                <ul className="space-y-1.5">
                  {(dryRun.artifact?.checklist ?? []).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                    >
                      {item.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span className={item.ok ? '' : 'text-muted-foreground'}>
                        {item.label}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        +{item.weight}
                      </span>
                    </li>
                  ))}
                </ul>
                {(dryRun.artifact?.missing?.length ?? 0) > 0 && (
                  <p className="mt-2 text-amber-600 dark:text-amber-400">
                    Faltando: {(dryRun.artifact?.missing ?? []).join(', ')}
                  </p>
                )}
              </div>

              {(dryRun.nextSteps?.length ?? 0) > 0 && (
                <div>
                  <p className="font-medium mb-1">Próximos passos</p>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    {(dryRun.nextSteps ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {dryRun.hostinger?.note && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  {dryRun.hostinger.note}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {dryRun.artifact?.html && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewHtml(dryRun.artifact?.html ?? null)}
                  >
                    <Eye className="w-4 h-4 mr-1" /> Abrir preview
                  </Button>
                )}
                {dryRun.artifact?.html && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText(
                        `site-${dryRun.siteId}.html`,
                        dryRun.artifact?.html ?? '',
                        'text/html'
                      )
                    }
                  >
                    <Code className="w-4 h-4 mr-1" /> HTML
                  </Button>
                )}
                {dryRun.artifact?.robotsTxt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText('robots.txt', dryRun.artifact?.robotsTxt ?? '')
                    }
                  >
                    robots.txt
                  </Button>
                )}
                {dryRun.artifact?.sitemapXml && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText('sitemap.xml', dryRun.artifact?.sitemapXml ?? '', 'application/xml')
                    }
                  >
                    sitemap.xml
                  </Button>
                )}
                {dryRun.statusAtual !== 'publicado' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDryRunOpen(false);
                        runPublish(dryRun.siteId, 'publish-app');
                      }}
                    >
                      <Upload className="w-4 h-4 mr-1" /> Publicar no app
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDryRunOpen(false);
                        runPublish(dryRun.siteId, 'local-mark');
                      }}
                    >
                      Local-mark
                    </Button>
                    {dryRun.hostinger?.live && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setDryRunOpen(false);
                          runPublish(dryRun.siteId, 'free-sub');
                        }}
                      >
                        Free-sub Hostinger
                      </Button>
                    )}
                  </>
                )}
                {dryRun.publicAppUrl && (
                  <a
                    href={dryRun.publicAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-muted-foreground self-center"
                  >
                    URL app: {dryRun.publicAppUrl}
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sites List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_: any, i: number) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (sites ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum site gerado</p>
            <p className="text-muted-foreground mt-1">
              Gere um site de verificação BMS para suas empresas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(sites ?? []).map((site: any, index: number) => {
            const busy = busyId === site?.id;
            return (
              <motion.div
                key={site?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: `${site?.corPrimaria ?? '#1877F2'}20`,
                          }}
                        >
                          <Globe
                            className="w-5 h-5"
                            style={{ color: site?.corPrimaria ?? '#1877F2' }}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{site?.nomeEmpresa ?? 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            {site?.empresa?.nomeFantasia ?? ''}
                            {site?.empresa?.trustScore != null
                              ? ` · trust ${site.empresa.trustScore}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          site?.status === 'publicado' ? 'default' : 'secondary'
                        }
                      >
                        {site?.status ?? 'rascunho'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span>Template: {site?.template ?? ''}</span>
                      <span>•</span>
                      <span>{site?.segmento ?? ''}</span>
                      {site?.dominio && (
                        <>
                          <span>•</span>
                          <span>{site.dominio}</span>
                        </>
                      )}
                      {site?.publishedUrl && (
                        <>
                          <span>•</span>
                          <a
                            href={site.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            live
                          </a>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {site?.conteudoGerado && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewHtml(site.conteudoGerado)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Preview
                        </Button>
                      )}
                      {site?.conteudoGerado && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadText(
                              `site-${site?.nomeEmpresa ?? 'empresa'}.html`,
                              site.conteudoGerado,
                              'text/html'
                            )
                          }
                        >
                          <Code className="w-4 h-4 mr-1" /> HTML
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => runPublish(site.id, 'dry-run')}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <FlaskConical className="w-4 h-4 mr-1" />
                        )}
                        Dry-run
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => regenerate(site.id)}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" /> Regenerar
                      </Button>
                      {site?.status !== 'publicado' && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                'Publicar no app (URL pública /s/{id})? Trust será recalculado.'
                              )
                            ) {
                              runPublish(site.id, 'publish-app');
                            }
                          }}
                        >
                          <Upload className="w-4 h-4 mr-1" /> Publicar app
                        </Button>
                      )}
                      {site?.status === 'publicado' && site?.publishedUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(site.publishedUrl, '_blank')}
                        >
                          <Globe className="w-4 h-4 mr-1" /> Abrir live
                        </Button>
                      )}
                      {site?.status !== 'publicado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                'Gerar free-sub Hostinger + publicar no app? Requer FEATURE_HOSTINGER_LIVE=true.'
                              )
                            ) {
                              runPublish(site.id, 'free-sub');
                            }
                          }}
                        >
                          Free-sub
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
