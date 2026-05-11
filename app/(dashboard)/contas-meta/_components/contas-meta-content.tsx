'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Facebook, Plus, Shield, Activity, Search, AlertTriangle,
  XCircle, Ban, Clock, ChevronRight, ArrowLeft, History,
  FileText, Send, CheckCircle2, Edit, Trash2, Filter, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

const statusConfig: Record<string, { color: string; icon: any; label: string; bgCard: string }> = {
  ATIVA: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Ativa', bgCard: 'border-l-emerald-500' },
  DESATIVADA: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle, label: 'Desativada', bgCard: 'border-l-gray-400' },
  EM_REVISAO: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock, label: 'Em Revisão', bgCard: 'border-l-amber-500' },
  SUSPENSA: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, label: 'Suspensa', bgCard: 'border-l-orange-500' },
  CANCELADA: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban, label: 'Cancelada', bgCard: 'border-l-red-500' },
  RESTRITA: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertTriangle, label: 'Restrita', bgCard: 'border-l-rose-500' },
};

const allStatuses = ['TODOS', 'ATIVA', 'DESATIVADA', 'EM_REVISAO', 'SUSPENSA', 'CANCELADA', 'RESTRITA'];

export function ContasMetaContent() {
  const { data: session } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const [contas, setContas] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState({
    nome: '', metaBusinessId: '', adAccountId: '', tipo: 'Business Manager',
    empresaId: '', observacoes: '', wabaId: '', accessToken: '',
  });
  const [syncing, setSyncing] = useState<string | null>(null);

  const [statusForm, setStatusForm] = useState({
    novoStatus: '', motivoRestricao: '', motivoMudanca: '',
  });

  const [recursoForm, setRecursoForm] = useState({
    recursoDescricao: '',
  });
  const [showRecursoDialog, setShowRecursoDialog] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== 'TODOS') params.set('status', filterStatus);
    if (searchTerm) params.set('search', searchTerm);

    Promise.all([
      fetch(`/api/contas-meta?${params.toString()}`).then((r: any) => r?.json?.()),
      fetch('/api/empresas').then((r: any) => r?.json?.()),
    ]).then(([c, e]: any[]) => {
      setContas(Array.isArray(c) ? c : []);
      setEmpresas(Array.isArray(e) ? e : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filterStatus, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form?.nome || !form?.empresaId) {
      toast.error('Nome e empresa são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/contas-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Conta Meta criada com sucesso!');
        setShowCreate(false);
        setForm({ nome: '', metaBusinessId: '', adAccountId: '', tipo: 'Business Manager', empresaId: '', observacoes: '', wabaId: '', accessToken: '' });
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao criar conta');
      }
    } catch {
      toast.error('Erro ao criar conta');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedConta || !statusForm.novoStatus) return;

    const needsReason = ['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(statusForm.novoStatus);
    if (needsReason && !statusForm.motivoRestricao) {
      toast.error('Informe o motivo da mudança de status');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/contas-meta/${selectedConta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusForm.novoStatus,
          motivoRestricao: statusForm.motivoRestricao || null,
          motivoMudanca: statusForm.motivoMudanca || statusForm.motivoRestricao || null,
        }),
      });
      if (res.ok) {
        toast.success('Status atualizado com sucesso!');
        setShowStatusDialog(false);
        setStatusForm({ novoStatus: '', motivoRestricao: '', motivoMudanca: '' });
        setSelectedConta(null);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao atualizar');
      }
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendRecurso = async () => {
    if (!selectedConta || !recursoForm.recursoDescricao) {
      toast.error('Descreva o recurso enviado');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/contas-meta/${selectedConta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recursoEnviado: true,
          recursoDescricao: recursoForm.recursoDescricao,
        }),
      });
      if (res.ok) {
        toast.success('Recurso registrado com sucesso!');
        setShowRecursoDialog(false);
        setRecursoForm({ recursoDescricao: '' });
        fetchData();
      } else {
        toast.error('Erro ao registrar recurso');
      }
    } catch {
      toast.error('Erro ao registrar recurso');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (conta: any) => {
    if (!confirm(`Excluir conta "${conta.nome}"?`)) return;
    try {
      const res = await fetch(`/api/contas-meta/${conta.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Conta excluída!');
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir conta');
    }
  };

  const handleSync = async (conta: any, acao: string = 'tudo') => {
    setSyncing(conta.id);
    try {
      const res = await fetch('/api/meta-api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contaMetaId: conta.id, acao }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sincronização realizada com sucesso!');
        fetchData();
      } else {
        toast.error(data.error ?? 'Erro na sincronização');
      }
    } catch { toast.error('Erro na sincronização'); }
    finally { setSyncing(null); }
  };

  const openDetail = async (conta: any) => {
    try {
      const res = await fetch(`/api/contas-meta/${conta.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedConta(data);
        setShowDetail(true);
      }
    } catch {
      setSelectedConta(conta);
      setShowDetail(true);
    }
  };

  const ativas = (contas ?? []).filter((c: any) => c?.status === 'ATIVA').length;
  const problematicas = (contas ?? []).filter((c: any) => ['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(c?.status)).length;
  const emRevisao = (contas ?? []).filter((c: any) => c?.status === 'EM_REVISAO').length;

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return 'N/A'; }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Contas Meta Business</h1>
          <p className="text-muted-foreground mt-1">Gerencie contas, monitore restrições e acompanhe recursos</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Facebook className="w-5 h-5 text-blue-500" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold font-mono">{(contas ?? []).length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Shield className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Ativas</p><p className="text-2xl font-bold font-mono text-emerald-600">{ativas}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-muted-foreground">Problemáticas</p><p className="text-2xl font-bold font-mono text-red-600">{problematicas}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Activity className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Em Revisão</p><p className="text-2xl font-bold font-mono text-amber-600">{emRevisao}</p></div>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, ID ou empresa..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e?.target?.value ?? '')}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {allStatuses.map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className="text-xs"
            >
              {s === 'TODOS' ? 'Todos' : statusConfig[s]?.label ?? s}
            </Button>
          ))}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta Meta</DialogTitle>
            <DialogDescription>Cadastre uma nova conta do Meta Business Manager</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <select
                value={form?.empresaId ?? ''}
                onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), empresaId: e?.target?.value ?? '' }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {(empresas ?? []).map((emp: any) => (
                  <option key={emp?.id} value={emp?.id}>{emp?.nomeFantasia ?? ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input value={form?.nome ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), nome: e?.target?.value ?? '' }))} placeholder="Ex: BM - Minha Empresa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Business ID</Label>
                <Input value={form?.metaBusinessId ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), metaBusinessId: e?.target?.value ?? '' }))} placeholder="ID numérico" />
              </div>
              <div className="space-y-2">
                <Label>Ad Account ID</Label>
                <Input value={form?.adAccountId ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), adAccountId: e?.target?.value ?? '' }))} placeholder="act_..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={form?.tipo ?? 'Business Manager'}
                onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), tipo: e?.target?.value ?? '' }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Business Manager">Business Manager</option>
                <option value="Ad Account">Ad Account</option>
                <option value="Page">Página</option>
                <option value="WhatsApp Business">WhatsApp Business</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>WABA ID</Label>
              <Input value={form?.wabaId ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), wabaId: e?.target?.value ?? '' }))} placeholder="ID do WhatsApp Business Account" />
            </div>
            <div className="space-y-2">
              <Label>Access Token Individual</Label>
              <Input type="password" value={form?.accessToken ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), accessToken: e?.target?.value ?? '' }))} placeholder="Token específico desta conta (opcional)" />
              <p className="text-xs text-muted-foreground">Se vazio, usa o token global das configurações</p>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form?.observacoes ?? ''} onChange={(e: any) => setForm((prev: any) => ({ ...(prev ?? {}), observacoes: e?.target?.value ?? '' }))} placeholder="Anotações sobre esta conta..." rows={2} />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={creating}>
              {creating ? 'Criando...' : <><Facebook className="w-4 h-4 mr-2" /> Criar Conta</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Status da Conta</DialogTitle>
            <DialogDescription>{selectedConta?.nome ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Status Atual</p>
              <Badge className={statusConfig[selectedConta?.status]?.color ?? ''} variant="secondary">
                {statusConfig[selectedConta?.status]?.label ?? selectedConta?.status}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label>Novo Status *</Label>
              <select
                value={statusForm.novoStatus}
                onChange={(e: any) => setStatusForm((prev) => ({ ...prev, novoStatus: e?.target?.value ?? '' }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {Object.entries(statusConfig).filter(([k]) => k !== selectedConta?.status).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(statusForm.novoStatus) && (
              <div className="space-y-2">
                <Label className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Motivo da Restrição/Cancelamento *
                </Label>
                <Textarea
                  value={statusForm.motivoRestricao}
                  onChange={(e: any) => setStatusForm((prev) => ({ ...prev, motivoRestricao: e?.target?.value ?? '' }))}
                  placeholder="Descreva o motivo informado pela Meta...\n\nExemplos:\n- Violação de políticas de publicidade\n- Atividade incomum detectada\n- Documentação insuficiente\n- Conta comprometida"
                  rows={5}
                  className="border-red-200 focus:border-red-400"
                />
              </div>
            )}

            {statusForm.novoStatus === 'ATIVA' && ['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(selectedConta?.status) && (
              <div className="space-y-2">
                <Label>Motivo da Reativação</Label>
                <Textarea
                  value={statusForm.motivoMudanca}
                  onChange={(e: any) => setStatusForm((prev) => ({ ...prev, motivoMudanca: e?.target?.value ?? '' }))}
                  placeholder="Como a conta foi reativada? Recurso aceito, revisão concluída, etc."
                  rows={3}
                />
              </div>
            )}

            <Button onClick={handleStatusChange} className="w-full" disabled={updating}>
              {updating ? 'Atualizando...' : 'Confirmar Mudança'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appeal Dialog */}
      <Dialog open={showRecursoDialog} onOpenChange={setShowRecursoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Recurso Enviado</DialogTitle>
            <DialogDescription>Registre que um recurso/apelação foi enviado à Meta para {selectedConta?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-red-600 font-medium">Motivo da Restrição:</p>
              <p className="text-sm mt-1">{selectedConta?.motivoRestricao ?? 'Não informado'}</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição do Recurso *</Label>
              <Textarea
                value={recursoForm.recursoDescricao}
                onChange={(e: any) => setRecursoForm({ recursoDescricao: e?.target?.value ?? '' })}
                placeholder="Descreva o recurso enviado, argumentos utilizados, documentos anexados, etc."
                rows={5}
              />
            </div>
            <Button onClick={handleSendRecurso} className="w-full" disabled={updating}>
              {updating ? 'Registrando...' : <><Send className="w-4 h-4 mr-2" /> Registrar Recurso</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              {selectedConta?.nome ?? 'Detalhes da Conta'}
            </DialogTitle>
          </DialogHeader>
          {selectedConta && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="font-medium">{selectedConta?.empresa?.nomeFantasia ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedConta?.status]?.color ?? ''} variant="secondary">
                    {statusConfig[selectedConta?.status]?.label ?? selectedConta?.status}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Meta Business ID</p>
                  <p className="font-mono text-sm">{selectedConta?.metaBusinessId ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Ad Account ID</p>
                  <p className="font-mono text-sm">{selectedConta?.adAccountId ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">WABA ID</p>
                  <p className="font-mono text-sm">{selectedConta?.wabaId ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Verificação Meta</p>
                  <Badge variant="secondary" className={`text-xs ${
                    selectedConta?.verificacaoStatus === 'verified' ? 'bg-green-100 text-green-700' :
                    selectedConta?.verificacaoStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedConta?.verificacaoStatus === 'verified' ? '✅ Verificada' :
                     selectedConta?.verificacaoStatus === 'pending' ? '⏳ Pendente' :
                     selectedConta?.verificacaoStatus ?? 'Não Verificada'}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm">{selectedConta?.tipo ?? 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Token Individual</p>
                  <p className="text-sm">{selectedConta?.accessToken ? '✅ Configurado' : '❌ Usando global'}</p>
                </div>
              </div>

              {/* Restriction Details */}
              {['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(selectedConta?.status) && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-800 text-sm">Informações da Restrição</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Motivo</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{selectedConta?.motivoRestricao ?? 'Não informado'}</p>
                    </div>
                    {selectedConta?.dataRestricao && (
                      <div>
                        <p className="text-xs text-muted-foreground">Data da Restrição</p>
                        <p className="text-sm mt-1">{formatDate(selectedConta.dataRestricao)}</p>
                      </div>
                    )}

                    {/* Appeal Status */}
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Status do Recurso</p>
                      {selectedConta?.recursoEnviado ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Send className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">Recurso Enviado</span>
                            <span className="text-xs text-amber-600 ml-auto">{formatDate(selectedConta?.dataRecurso)}</span>
                          </div>
                          <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedConta?.recursoDescricao ?? ''}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Nenhum recurso enviado</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                              setShowDetail(false);
                              setShowRecursoDialog(true);
                            }}
                          >
                            <Send className="w-3.5 h-3.5 mr-1" /> Registrar Recurso
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Observations */}
              {selectedConta?.observacoes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedConta.observacoes}</p>
                </div>
              )}

              {/* Status History */}
              {(selectedConta?.historicoStatus ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <History className="w-4 h-4" /> Histórico de Status
                  </h4>
                  <div className="space-y-2">
                    {(selectedConta.historicoStatus ?? []).map((h: any, i: number) => (
                      <div key={h.id ?? i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={statusConfig[h.statusAnterior]?.color ?? 'bg-gray-100'} variant="secondary">
                              {statusConfig[h.statusAnterior]?.label ?? h.statusAnterior}
                            </Badge>
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            <Badge className={statusConfig[h.statusNovo]?.color ?? 'bg-gray-100'} variant="secondary">
                              {statusConfig[h.statusNovo]?.label ?? h.statusNovo}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">{formatDate(h.createdAt)}</span>
                          </div>
                          {h.motivo && <p className="text-muted-foreground mt-1 text-xs">{h.motivo}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDetail(false);
                    setStatusForm({ novoStatus: '', motivoRestricao: '', motivoMudanca: '' });
                    setShowStatusDialog(true);
                  }}
                >
                  <Edit className="w-3.5 h-3.5 mr-1" /> Alterar Status
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      setShowDetail(false);
                      handleDelete(selectedConta);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_: any, i: number) => (<div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />))}</div>
      ) : (contas ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Facebook className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhuma conta encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">{filterStatus !== 'TODOS' ? 'Tente mudar o filtro' : 'Adicione a primeira conta Meta'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {(contas ?? []).map((conta: any, index: number) => {
              const cfg = statusConfig[conta?.status] ?? statusConfig.ATIVA;
              const StatusIcon = cfg.icon;
              const isRestricted = ['CANCELADA', 'RESTRITA', 'SUSPENSA', 'DESATIVADA'].includes(conta?.status);

              return (
                <motion.div
                  key={conta?.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <Card
                    className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${cfg.bgCard}`}
                    onClick={() => openDetail(conta)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isRestricted ? 'bg-red-50' : 'bg-blue-50'}`}>
                            {isRestricted
                              ? <StatusIcon className="w-5 h-5 text-red-600" />
                              : <Facebook className="w-5 h-5 text-blue-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{conta?.nome ?? 'N/A'}</p>
                              <Badge className={cfg.color} variant="secondary">
                                {cfg.label}
                              </Badge>
                              {conta?.recursoEnviado && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="secondary">
                                  <Send className="w-3 h-3 mr-1" /> Recurso Enviado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              <span>{conta?.empresa?.nomeFantasia ?? ''}</span>
                              <span>•</span>
                              <span className="font-mono">BM: {conta?.metaBusinessId ?? 'N/A'}</span>
                              <span>•</span>
                              <span>{conta?.tipo ?? ''}</span>
                            </div>

                            {/* Show restriction reason inline */}
                            {isRestricted && conta?.motivoRestricao && (
                              <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                                <p className="text-xs text-red-700 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{conta.motivoRestricao}</span>
                                </p>
                                {conta?.dataRestricao && (
                                  <p className="text-[10px] text-red-500 mt-1 ml-5">Desde {formatDate(conta.dataRestricao)}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {conta?.metaBusinessId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={syncing === conta.id}
                              onClick={(e: any) => { e.stopPropagation(); handleSync(conta); }}
                              title="Sincronizar com Meta API"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncing === conta.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e: any) => {
                              e.stopPropagation();
                              setSelectedConta(conta);
                              setStatusForm({ novoStatus: '', motivoRestricao: '', motivoMudanca: '' });
                              setShowStatusDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
