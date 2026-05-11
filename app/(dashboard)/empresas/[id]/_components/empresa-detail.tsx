'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2, ArrowLeft, Edit, Trash2, Upload, FileText,
  Globe, Facebook, BarChart3, CheckCircle, Clock, XCircle,
  AlertTriangle, Save, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

const statusColors: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  EM_ANALISE: 'bg-blue-100 text-blue-800',
  APROVADA: 'bg-green-100 text-green-800',
  REJEITADA: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = {
  PENDENTE: 'Pendente', EM_ANALISE: 'Em An\u00e1lise', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada',
};
const statusIcons: Record<string, any> = {
  PENDENTE: Clock, EM_ANALISE: AlertTriangle, APROVADA: CheckCircle, REJEITADA: XCircle,
};

function formatCnpj(cnpj: string): string {
  const c = (cnpj ?? '').replace(/\D/g, '');
  if (c?.length !== 14) return cnpj ?? '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function TrustScoreGauge({ score }: { score: number }) {
  const s = score ?? 0;
  const color = s >= 80 ? '#22c55e' : s >= 60 ? '#3b82f6' : s >= 40 ? '#f59e0b' : s >= 20 ? '#f97316' : '#ef4444';
  const label = s >= 80 ? 'Excelente' : s >= 60 ? 'Bom' : s >= 40 ? 'Regular' : s >= 20 ? 'Baixo' : 'Cr\u00edtico';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${s * 2.51} 251`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold font-mono">{s}</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-2" style={{ color }}>{label}</span>
    </div>
  );
}

export function EmpresaDetail({ id }: { id: string }) {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const fetchEmpresa = useCallback(() => {
    setLoading(true);
    fetch(`/api/empresas/${id}`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setEmpresa(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchEmpresa(); }, [fetchEmpresa]);

  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/empresas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Status atualizado para ${statusLabels?.[newStatus] ?? newStatus}`);
        fetchEmpresa();
      }
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Deseja realmente excluir esta empresa?')) return;
    try {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Empresa exclu\u00edda');
        router.replace('/empresas');
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  // Upload document handler
  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      // Get presigned URL
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
      });
      const { uploadUrl, cloud_storage_path } = await presignRes.json();

      // Upload to S3
      const headers: Record<string, string> = { 'Content-Type': file.type };
      const urlParams = new URL(uploadUrl);
      const signedHeaders = urlParams?.searchParams?.get?.('X-Amz-SignedHeaders') ?? '';
      if (signedHeaders?.includes?.('content-disposition')) {
        headers['Content-Disposition'] = 'attachment';
      }
      await fetch(uploadUrl, { method: 'PUT', headers, body: file });

      // Save document record
      const docRes = await fetch(`/api/empresas/${id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome: file.name, cloudStoragePath: cloud_storage_path, isPublic: false }),
      });
      if (docRes.ok) {
        toast.success('Documento enviado com sucesso!');
        fetchEmpresa();
      }
    } catch {
      toast.error('Erro ao enviar documento');
    }
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  if (!empresa || empresa?.error) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Empresa n\u00e3o encontrada</p>
        <Link href="/empresas"><Button variant="outline" className="mt-4">Voltar</Button></Link>
      </div>
    );
  }

  const StatusIcon = statusIcons?.[empresa?.status] ?? Clock;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/empresas"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{empresa?.nomeFantasia ?? 'N/A'}</h1>
            <p className="text-muted-foreground font-mono text-sm">{formatCnpj(empresa?.cnpj ?? '')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors?.[empresa?.status] ?? ''} text-sm px-3 py-1`} variant="secondary">
            <StatusIcon className="w-4 h-4 mr-1" />
            {statusLabels?.[empresa?.status] ?? empresa?.status}
          </Badge>
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium mr-2">Alterar status:</span>
              {['PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA'].map((s: string) => (
                <Button
                  key={s}
                  variant={empresa?.status === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStatus(s)}
                  disabled={empresa?.status === s || statusLoading}
                >
                  {statusLabels?.[s] ?? s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="info" className="space-y-4">
            <TabsList>
              <TabsTrigger value="info">Informa\u00e7\u00f5es</TabsTrigger>
              <TabsTrigger value="docs">Documentos ({(empresa?.documentos ?? []).length})</TabsTrigger>
              <TabsTrigger value="meta">Contas Meta ({(empresa?.contasMeta ?? []).length})</TabsTrigger>
              <TabsTrigger value="sites">Sites ({(empresa?.sitesVerificacao ?? []).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground text-xs">Raz\u00e3o Social</Label><p className="font-medium">{empresa?.razaoSocial ?? 'N/A'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Nome Fantasia</Label><p className="font-medium">{empresa?.nomeFantasia ?? 'N/A'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Segmento</Label><p className="font-medium">{empresa?.segmento ?? 'N/A'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Email</Label><p className="font-medium">{empresa?.email ?? 'N/A'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Telefone</Label><p className="font-medium">{empresa?.telefone ?? 'N\u00e3o informado'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Website</Label><p className="font-medium">{empresa?.website || 'N\u00e3o informado'}</p></div>
                  </div>
                  {(empresa?.endereco || empresa?.cidade) && (
                    <div className="border-t border-border pt-4">
                      <Label className="text-muted-foreground text-xs">Endere\u00e7o</Label>
                      <p className="font-medium">
                        {[empresa?.endereco, empresa?.cidade, empresa?.estado, empresa?.cep].filter(Boolean).join(', ') || 'N\u00e3o informado'}
                      </p>
                    </div>
                  )}
                  <div className="border-t border-border pt-4">
                    <Label className="text-muted-foreground text-xs">Criado por</Label>
                    <p className="font-medium">{empresa?.criadoPor?.name ?? 'N/A'} ({empresa?.criadoPor?.email ?? ''})</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Documentos</CardTitle>
                  <label>
                    <input type="file" className="hidden" onChange={(e: any) => handleUploadDoc(e, 'OUTRO')} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                    <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> Enviar Documento</span></Button>
                  </label>
                </CardHeader>
                <CardContent>
                  {(empresa?.documentos ?? []).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum documento enviado</p>
                  ) : (
                    <div className="space-y-2">
                      {(empresa?.documentos ?? []).map((doc: any) => (
                        <div key={doc?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">{doc?.nome ?? 'Documento'}</p>
                              <p className="text-xs text-muted-foreground">{doc?.tipo ?? ''}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className={doc?.status === 'APROVADO' ? 'bg-green-100 text-green-800' : doc?.status === 'REJEITADO' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                            {doc?.status ?? 'PENDENTE'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meta">
              <Card>
                <CardContent className="p-5">
                  {(empresa?.contasMeta ?? []).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma conta Meta vinculada</p>
                  ) : (
                    <div className="space-y-2">
                      {(empresa?.contasMeta ?? []).map((conta: any) => (
                        <div key={conta?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Facebook className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium">{conta?.nome ?? 'Conta'}</p>
                              <p className="text-xs text-muted-foreground font-mono">BM: {conta?.metaBusinessId ?? 'N/A'}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className={conta?.status === 'ATIVA' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {conta?.status ?? ''}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sites">
              <Card>
                <CardContent className="p-5">
                  {(empresa?.sitesVerificacao ?? []).length === 0 ? (
                    <div className="text-center py-8">
                      <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum site de verifica\u00e7\u00e3o gerado</p>
                      <Link href={`/sites-verificacao?empresaId=${id}`}>
                        <Button className="mt-3" size="sm">Gerar Site BMS</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(empresa?.sitesVerificacao ?? []).map((site: any) => (
                        <div key={site?.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-purple-600" />
                            <div>
                              <p className="text-sm font-medium">{site?.dominio ?? 'Sem dom\u00ednio'}</p>
                              <p className="text-xs text-muted-foreground">Template: {site?.template ?? 'institucional'}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{site?.status ?? 'rascunho'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Trust Score */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Trust Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <TrustScoreGauge score={empresa?.trustScore ?? 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hist\u00f3rico de Score</CardTitle>
            </CardHeader>
            <CardContent>
              {(empresa?.trustScoreHistorico ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem hist\u00f3rico</p>
              ) : (
                <div className="space-y-2">
                  {(empresa?.trustScoreHistorico ?? []).slice(0, 5).map((h: any) => (
                    <div key={h?.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {h?.createdAt ? new Date(h.createdAt).toLocaleDateString('pt-BR') : ''}
                      </span>
                      <span className="font-mono font-medium">{h?.score ?? 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
