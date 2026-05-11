'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Plus, Shield, AlertTriangle, MessageCircle, RefreshCw,
  ChevronRight, Trash2, Send, CheckCircle2, Clock, XCircle,
  Signal, Zap, Hash, Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  PENDENTE: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'Pendente' },
  VERIFICADO: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle2, label: 'Verificado' },
  REGISTRADO: { color: 'bg-emerald-100 text-emerald-700', icon: Shield, label: 'Registrado' },
  CONNECTED: { color: 'bg-green-100 text-green-700', icon: Signal, label: 'Conectado' },
  OFFLINE: { color: 'bg-gray-100 text-gray-600', icon: XCircle, label: 'Offline' },
  FLAGGED: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Sinalizado' },
  RATE_LIMITED: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, label: 'Limite Atingido' },
  DISABLED: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Desabilitado' },
  BANNED: { color: 'bg-red-200 text-red-800', icon: XCircle, label: 'Banido' },
};

const qualityConfig: Record<string, { color: string; label: string }> = {
  GREEN: { color: 'bg-green-100 text-green-700', label: 'Alta' },
  YELLOW: { color: 'bg-yellow-100 text-yellow-700', label: 'Média' },
  RED: { color: 'bg-red-100 text-red-700', label: 'Baixa' },
  NA: { color: 'bg-gray-100 text-gray-600', label: 'N/A' },
};

export function NumerosWhatsappContent() {
  const { data: session } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const [numeros, setNumeros] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAction, setShowAction] = useState(false);
  const [selectedNumero, setSelectedNumero] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    numero: '', displayName: '', contaMetaId: '', empresaId: '', pin2fa: '',
  });
  const [actionForm, setActionForm] = useState({ codigo: '', pin: '', metodo: 'SMS' as 'SMS' | 'VOICE' });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/numeros-whatsapp').then(r => r.json()),
      fetch('/api/contas-meta').then(r => r.json()),
      fetch('/api/empresas').then(r => r.json()),
    ]).then(([n, c, e]) => {
      setNumeros(Array.isArray(n) ? n : []);
      setContas(Array.isArray(c) ? c : []);
      setEmpresas(Array.isArray(e) ? e : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.numero || !form.contaMetaId || !form.empresaId) {
      toast.error('Número, conta Meta e empresa são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/numeros-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Número cadastrado com sucesso!');
        setShowCreate(false);
        setForm({ numero: '', displayName: '', contaMetaId: '', empresaId: '', pin2fa: '' });
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao cadastrar');
      }
    } catch { toast.error('Erro ao cadastrar número'); }
    finally { setCreating(false); }
  };

  const handleAction = async (acao: string) => {
    if (!selectedNumero) return;
    setActionLoading(true);
    try {
      const body: any = { acao };
      if (acao === 'verificar_codigo') body.codigo = actionForm.codigo;
      if (acao === 'solicitar_codigo') body.metodo = actionForm.metodo;
      if (acao === 'registrar') body.pin = actionForm.pin || selectedNumero?.pin2fa || '000000';

      const res = await fetch(`/api/numeros-whatsapp/${selectedNumero.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          acao === 'solicitar_codigo' ? 'Código enviado!' :
          acao === 'verificar_codigo' ? 'Número verificado!' :
          acao === 'registrar' ? 'Número registrado na Cloud API!' : 'Ação concluída!'
        );
        fetchData();
      } else {
        toast.error(data.error ?? 'Erro na ação');
      }
    } catch { toast.error('Erro ao executar ação'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async (num: any) => {
    if (!confirm(`Excluir o número ${num.numero}?`)) return;
    try {
      const res = await fetch(`/api/numeros-whatsapp/${num.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Número excluído!'); fetchData(); }
      else { toast.error('Erro ao excluir'); }
    } catch { toast.error('Erro ao excluir'); }
  };

  const conectados = numeros.filter(n => ['CONNECTED', 'REGISTRADO'].includes(n.status)).length;
  const pendentes = numeros.filter(n => n.status === 'PENDENTE').length;
  const problemas = numeros.filter(n => ['FLAGGED', 'RATE_LIMITED', 'DISABLED', 'BANNED'].includes(n.status)).length;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Números WhatsApp</h1>
          <p className="text-muted-foreground mt-1">Gerencie números, verificação e registro na Cloud API</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-2" /> Atualizar</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Novo Número</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Phone className="w-5 h-5 text-blue-500" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold font-mono">{numeros.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Signal className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-xs text-muted-foreground">Conectados</p><p className="text-2xl font-bold font-mono text-green-600">{conectados}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold font-mono text-amber-600">{pendentes}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-muted-foreground">Problemas</p><p className="text-2xl font-bold font-mono text-red-600">{problemas}</p></div>
        </CardContent></Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Número WhatsApp</DialogTitle>
            <DialogDescription>Cadastre um número para vincular à Cloud API</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <select value={form.empresaId} onChange={(e: any) => setForm(p => ({ ...p, empresaId: e?.target?.value ?? '' }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {empresas.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.nomeFantasia}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Conta Meta *</Label>
              <select value={form.contaMetaId} onChange={(e: any) => setForm(p => ({ ...p, contaMetaId: e?.target?.value ?? '' }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {contas.filter((c: any) => !form.empresaId || c.empresaId === form.empresaId).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Número de Telefone *</Label>
              <Input value={form.numero} onChange={(e: any) => setForm(p => ({ ...p, numero: e?.target?.value ?? '' }))} placeholder="+55 11 99999-9999" />
              <p className="text-xs text-muted-foreground">Com código do país e DDD</p>
            </div>
            <div className="space-y-2">
              <Label>Nome de Exibição</Label>
              <Input value={form.displayName} onChange={(e: any) => setForm(p => ({ ...p, displayName: e?.target?.value ?? '' }))} placeholder="Nome que aparecerá no WhatsApp" />
            </div>
            <div className="space-y-2">
              <Label>PIN 2FA (6 dígitos)</Label>
              <Input value={form.pin2fa} onChange={(e: any) => setForm(p => ({ ...p, pin2fa: e?.target?.value ?? '' }))} placeholder="123456" maxLength={6} />
              <p className="text-xs text-muted-foreground">Necessário para registro na Cloud API</p>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={creating}>
              {creating ? 'Cadastrando...' : <><Phone className="w-4 h-4 mr-2" /> Cadastrar Número</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={showAction} onOpenChange={setShowAction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ações do Número</DialogTitle>
            <DialogDescription>{selectedNumero?.numero} - {selectedNumero?.displayName}</DialogDescription>
          </DialogHeader>
          {selectedNumero && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status Atual</span>
                  <Badge className={statusConfig[selectedNumero.status]?.color ?? ''} variant="secondary">
                    {statusConfig[selectedNumero.status]?.label ?? selectedNumero.status}
                  </Badge>
                </div>
                {selectedNumero.qualityRating && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Qualidade</span>
                    <Badge className={qualityConfig[selectedNumero.qualityRating]?.color ?? ''} variant="secondary">
                      {qualityConfig[selectedNumero.qualityRating]?.label ?? 'N/A'}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Step 1: Request Code */}
              <div className="border rounded-lg p-3">
                <p className="font-semibold text-sm flex items-center gap-2"><Hash className="w-4 h-4" /> 1. Solicitar Código de Verificação</p>
                <p className="text-xs text-muted-foreground mt-1">Enviar OTP via SMS ou chamada de voz</p>
                <div className="flex gap-2 mt-2">
                  <select value={actionForm.metodo} onChange={(e: any) => setActionForm(p => ({ ...p, metodo: e?.target?.value }))} className="flex h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="SMS">SMS</option>
                    <option value="VOICE">Chamada de Voz</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={() => handleAction('solicitar_codigo')} disabled={actionLoading}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Enviar Código
                  </Button>
                </div>
              </div>

              {/* Step 2: Verify Code */}
              <div className="border rounded-lg p-3">
                <p className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 2. Verificar Código</p>
                <p className="text-xs text-muted-foreground mt-1">Insira o código recebido</p>
                <div className="flex gap-2 mt-2">
                  <Input value={actionForm.codigo} onChange={(e: any) => setActionForm(p => ({ ...p, codigo: e?.target?.value ?? '' }))} placeholder="Código de 6 dígitos" className="h-8 text-sm" maxLength={6} />
                  <Button size="sm" variant="outline" onClick={() => handleAction('verificar_codigo')} disabled={actionLoading || !actionForm.codigo}>
                    Verificar
                  </Button>
                </div>
              </div>

              {/* Step 3: Register */}
              <div className="border rounded-lg p-3">
                <p className="font-semibold text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> 3. Registrar na Cloud API</p>
                <p className="text-xs text-muted-foreground mt-1">Registrar o número para uso com a WhatsApp Cloud API</p>
                <div className="flex gap-2 mt-2">
                  <Input value={actionForm.pin} onChange={(e: any) => setActionForm(p => ({ ...p, pin: e?.target?.value ?? '' }))} placeholder={selectedNumero.pin2fa ? `PIN salvo: ***${selectedNumero.pin2fa.slice(-2)}` : 'PIN 2FA (6 dígitos)'} className="h-8 text-sm" maxLength={6} />
                  <Button size="sm" onClick={() => handleAction('registrar')} disabled={actionLoading}>
                    <Zap className="w-3.5 h-3.5 mr-1" /> Registrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : numeros.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum número cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione um número para começar</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {numeros.map((num: any, idx: number) => {
              const sCfg = statusConfig[num.status] ?? statusConfig.PENDENTE;
              const StatusIcon = sCfg.icon;
              const qCfg = qualityConfig[num.qualityRating] ?? qualityConfig.NA;

              return (
                <motion.div key={num.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} layout>
                  <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                            <Phone className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-mono font-medium">{num.numero}</p>
                              <Badge className={sCfg.color} variant="secondary">{sCfg.label}</Badge>
                              <Badge className={qCfg.color} variant="secondary">Qualidade: {qCfg.label}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              {num.displayName && <span>{num.displayName}</span>}
                              <span>•</span>
                              <span>{num.contaMeta?.nome ?? 'N/A'}</span>
                              <span>•</span>
                              <span>{num.empresa?.nomeFantasia ?? ''}</span>
                              {num.limiteMsg && <><span>•</span><span>Limite: {num.limiteMsg}/dia</span></>}
                              {num.phoneNumberId && <><span>•</span><span className="font-mono">ID: {num.phoneNumberId}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setSelectedNumero(num); setActionForm({ codigo: '', pin: '', metodo: 'SMS' }); setShowAction(true); }}>
                            <Zap className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(num)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
