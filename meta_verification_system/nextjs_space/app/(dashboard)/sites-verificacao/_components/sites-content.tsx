'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Plus, Eye, Code, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const SEGMENTOS = [
  'Tecnologia', 'Marketing Digital', 'E-commerce', 'Alimenta\u00e7\u00e3o',
  'Moda e Vestu\u00e1rio', 'Sa\u00fade', 'Educa\u00e7\u00e3o', 'Finan\u00e7as',
  'Imobili\u00e1rio', 'Automotivo', 'Turismo', 'Entretenimento', 'Outro'
];

const TEMPLATES = [
  { id: 'institucional', label: 'Institucional', desc: 'Site corporativo completo' },
  { id: 'landing', label: 'Landing Page', desc: 'P\u00e1gina \u00fanica de convers\u00e3o' },
  { id: 'portfolio', label: 'Portf\u00f3lio', desc: 'Vitrine de servi\u00e7os' },
];

export function SitesVerificacaoContent() {
  const [sites, setSites] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    empresaId: '', dominio: '', template: 'institucional', segmento: '',
    nomeEmpresa: '', descricao: '', corPrimaria: '#1877F2', corSecundaria: '#42B72A',
    incluirTermos: true, incluirPrivacidade: true, incluirLgpd: true,
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sites-verificacao').then((r: any) => r?.json?.()),
      fetch('/api/empresas').then((r: any) => r?.json?.()),
    ]).then(([s, e]: any[]) => {
      setSites(Array.isArray(s) ? s : []);
      setEmpresas(Array.isArray(e) ? e : []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleEmpresaChange = (empresaId: string) => {
    const emp = (empresas ?? []).find((e: any) => e?.id === empresaId);
    setForm((prev: any) => ({
      ...(prev ?? {}),
      empresaId,
      nomeEmpresa: emp?.nomeFantasia ?? '',
      segmento: emp?.segmento ?? '',
    }));
  };

  const handleCreate = async () => {
    if (!form?.empresaId || !form?.nomeEmpresa || !form?.segmento) {
      toast.error('Selecione uma empresa');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/sites-verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Site BMS gerado com sucesso!');
        setShowCreate(false);
        fetchData();
      } else {
        toast.error(data?.error ?? 'Erro ao gerar site');
      }
    } catch {
      toast.error('Erro ao gerar site');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Sites de Verifica\u00e7\u00e3o BMS</h1>
          <p className="text-muted-foreground mt-1">Gere sites institucionais "Meta-ready" para suas empresas</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Gerar Novo Site</Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Site de Verifica\u00e7\u00e3o</DialogTitle>
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
                  <option key={emp?.id} value={emp?.id}>{emp?.nomeFantasia ?? ''} - {emp?.cnpj ?? ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-3 gap-2">
                {(TEMPLATES ?? []).map((t: any) => (
                  <button
                    key={t?.id}
                    onClick={() => setForm((prev: any) => ({ ...(prev ?? {}), template: t?.id }))}
                    className={`p-3 rounded-lg border text-center transition-all text-sm ${form?.template === t?.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    <p className="font-medium">{t?.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t?.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dom\u00ednio</Label>
                <Input value={form?.dominio ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), dominio: e?.target?.value ?? '' }))} placeholder="exemplo.com.br" />
              </div>
              <div className="space-y-2">
                <Label>Segmento</Label>
                <select
                  value={form?.segmento ?? ''}
                  onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), segmento: e?.target?.value ?? '' }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {(SEGMENTOS ?? []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Prim\u00e1ria</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form?.corPrimaria ?? '#1877F2'} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), corPrimaria: e?.target?.value ?? '' }))} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={form?.corPrimaria ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), corPrimaria: e?.target?.value ?? '' }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secund\u00e1ria</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form?.corSecundaria ?? '#42B72A'} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), corSecundaria: e?.target?.value ?? '' }))} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={form?.corSecundaria ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), corSecundaria: e?.target?.value ?? '' }))} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descri\u00e7\u00e3o</Label>
              <Textarea
                value={form?.descricao ?? ''}
                onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), descricao: e?.target?.value ?? '' }))}
                rows={2}
                placeholder="Breve descri\u00e7\u00e3o da empresa..."
              />
            </div>
            <div className="space-y-2">
              <Label>P\u00e1ginas Legais</Label>
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
                      onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), [item?.key]: e?.target?.checked }))}
                      className="rounded border-input"
                    />
                    <span className="text-sm">{item?.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full" loading={creating}>
              <Globe className="w-4 h-4 mr-2" /> Gerar Site
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
            <iframe srcDoc={previewHtml ?? ''} className="w-full h-full" title="Preview" sandbox="allow-scripts" />
          </div>
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
            <p className="text-muted-foreground mt-1">Gere um site de verifica\u00e7\u00e3o BMS para suas empresas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(sites ?? []).map((site: any, index: number) => (
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
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${site?.corPrimaria ?? '#1877F2'}20` }}>
                        <Globe className="w-5 h-5" style={{ color: site?.corPrimaria ?? '#1877F2' }} />
                      </div>
                      <div>
                        <p className="font-medium">{site?.nomeEmpresa ?? 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{site?.empresa?.nomeFantasia ?? ''}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{site?.status ?? 'rascunho'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>Template: {site?.template ?? ''}</span>
                    <span>\u2022</span>
                    <span>{site?.segmento ?? ''}</span>
                    {site?.dominio && <><span>\u2022</span><span>{site.dominio}</span></>}
                  </div>
                  <div className="flex gap-2">
                    {site?.conteudoGerado && (
                      <Button variant="outline" size="sm" onClick={() => setPreviewHtml(site.conteudoGerado)}>
                        <Eye className="w-4 h-4 mr-1" /> Preview
                      </Button>
                    )}
                    {site?.conteudoGerado && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([site.conteudoGerado], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `site-${site?.nomeEmpresa ?? 'empresa'}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Code className="w-4 h-4 mr-1" /> Baixar HTML
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
