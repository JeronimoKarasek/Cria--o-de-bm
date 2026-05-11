'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Key, Globe, Save, CheckCircle2, AlertTriangle,
  RefreshCw, Zap, Shield, Phone, FileText, BarChart3,
  ExternalLink, Copy, Eye, EyeOff, BookOpen, Webhook,
  Download, Loader2, XCircle, Server, Clock, Unplug,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

const apiEndpoints = [
  {
    categoria: 'Verificação de Empresa',
    cor: 'blue',
    icone: Shield,
    endpoints: [
      { metodo: 'GET', path: '/{business_id}?fields=verification_status,name', descricao: 'Status de verificação do negócio', notas: 'Retorna verification_status: not_verified, pending, verified' },
      { metodo: 'POST', path: '/{business_id}/verification', descricao: 'Iniciar verificação do negócio (manual via Business Suite)', notas: 'Não disponível via API. Processo manual no Meta Business Suite > Central de Segurança' },
    ],
  },
  {
    categoria: 'Portfólios e WABAs',
    cor: 'green',
    icone: Globe,
    endpoints: [
      { metodo: 'GET', path: '/{business_id}/owned_whatsapp_business_accounts', descricao: 'Listar WABAs do portfólio', notas: 'Retorna id, name, currency, timezone_id, message_template_namespace' },
      { metodo: 'GET', path: '/{waba_id}?fields=account_review_status', descricao: 'Status de revisão do WABA', notas: 'Retorna PENDING, APPROVED ou REJECTED' },
    ],
  },
  {
    categoria: 'Números de Telefone',
    cor: 'emerald',
    icone: Phone,
    endpoints: [
      { metodo: 'GET', path: '/{waba_id}/phone_numbers', descricao: 'Listar números vinculados ao WABA', notas: 'fields: display_phone_number, verified_name, quality_rating, status, messaging_limit_tier' },
      { metodo: 'POST', path: '/{phone_number_id}/request_code', descricao: 'Solicitar código de verificação (SMS/Voz)', notas: 'Body: { code_method: "SMS"|"VOICE", language: "pt_BR" }' },
      { metodo: 'POST', path: '/{phone_number_id}/verify_code', descricao: 'Verificar código OTP recebido', notas: 'Body: { code: "123456" }' },
      { metodo: 'POST', path: '/{phone_number_id}/register', descricao: 'Registrar número para Cloud API', notas: 'Body: { messaging_product: "whatsapp", pin: "6_DIGIT_PIN" }. Limite: 10 requests/72h' },
    ],
  },
  {
    categoria: 'Templates de Mensagem',
    cor: 'purple',
    icone: FileText,
    endpoints: [
      { metodo: 'GET', path: '/{waba_id}/message_templates', descricao: 'Listar templates de mensagem', notas: 'fields: name, status, category, language, quality_score' },
    ],
  },
  {
    categoria: 'Contas de Anúncio e Páginas',
    cor: 'orange',
    icone: BarChart3,
    endpoints: [
      { metodo: 'GET', path: '/{business_id}/owned_ad_accounts', descricao: 'Listar contas de anúncio', notas: 'fields: id, name, account_status, currency, amount_spent' },
      { metodo: 'GET', path: '/{business_id}/owned_pages', descricao: 'Listar páginas do portfólio', notas: 'fields: id, name, category, verification_status' },
    ],
  },
  {
    categoria: 'Envio de Mensagens',
    cor: 'cyan',
    icone: Zap,
    endpoints: [
      { metodo: 'POST', path: '/{phone_number_id}/messages', descricao: 'Enviar mensagem via Cloud API', notas: 'Body: { messaging_product: "whatsapp", to: "5511...", type: "template", template: {...} }' },
    ],
  },
];

const metodoColor: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

export function IntegracaoMetaContent() {
  const { data: session } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'guia'>('config');
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');

  const [form, setForm] = useState({
    appId: '', appSecret: '', accessToken: '', webhookToken: '',
    graphApiVersion: 'v21.0', descricao: '',
  });

  const fetchConfig = useCallback(() => {
    if (isAdmin) {
      Promise.all([
        fetch('/api/meta-api/config').then(r => r.json()).catch(() => null),
        fetch('/api/empresas').then(r => r.json()).catch(() => []),
      ]).then(([data, emps]) => {
        if (data) {
          setConfig(data);
          setForm({
            appId: data.appId ?? '',
            appSecret: '',
            accessToken: '',
            webhookToken: data.webhookToken ?? '',
            graphApiVersion: data.graphApiVersion ?? 'v21.0',
            descricao: data.descricao ?? '',
          });
        }
        setEmpresas(Array.isArray(emps) ? emps : []);
      }).catch(console.error).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    if (!form.appId) { toast.error('App ID é obrigatório'); return; }
    if (!form.accessToken && !config?.accessToken) { toast.error('Access Token é obrigatório para conexão real'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/meta-api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Configuração salva com sucesso!');
        const newConfig = await fetch('/api/meta-api/config').then(r => r.json());
        setConfig(newConfig);
        setTestResult(null);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao salvar');
      }
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: any = {};
      // If there's a new token being typed, test with it; otherwise test existing
      if (form.accessToken) {
        payload.accessToken = form.accessToken;
      }
      const res = await fetch('/api/meta-api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success('Conexão com a Meta API estabelecida com sucesso!');
      } else {
        toast.error(data.error ?? 'Falha na conexão');
      }
    } catch {
      toast.error('Erro ao testar conexão');
      setTestResult({ success: false, error: 'Erro de rede' });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedEmpresaId) {
      toast.error('Selecione uma empresa para vincular as contas importadas');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const payload: any = { empresaId: selectedEmpresaId };
      if (form.accessToken) payload.accessToken = form.accessToken;

      const res = await fetch('/api/meta-api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setImportResult(data);
      if (data.success) {
        toast.success(`Importação concluída! ${data.summary?.contas ?? 0} contas, ${data.summary?.numeros ?? 0} números importados`);
      } else {
        toast.error(data.error ?? 'Erro na importação');
      }
    } catch {
      toast.error('Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Integração Meta API</h1>
        <p className="text-muted-foreground mt-1">Configure credenciais reais, teste a conexão e importe dados da Meta</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {isAdmin && (
          <Button variant={activeTab === 'config' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('config')}>
            <Settings className="w-4 h-4 mr-2" /> Configuração & Conexão
          </Button>
        )}
        <Button variant={activeTab === 'guia' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('guia')}>
          <BookOpen className="w-4 h-4 mr-2" /> Guia de APIs
        </Button>
      </div>

      {activeTab === 'config' && isAdmin && (
        <div className="space-y-6">
          {/* Config Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" /> Credenciais da Meta API
              </CardTitle>
              <CardDescription>
                Configure as credenciais reais para conectar com a API Graph da Meta.
                {config && <Badge className="ml-2 bg-green-100 text-green-700" variant="secondary"><CheckCircle2 className="w-3 h-3 mr-1" /> Configurada</Badge>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>App ID *</Label>
                  <Input value={form.appId} onChange={(e: any) => setForm(p => ({ ...p, appId: e?.target?.value ?? '' }))} placeholder="Ex: 123456789012345" />
                  <p className="text-xs text-muted-foreground">Encontrado em developers.facebook.com &gt; Seu App</p>
                </div>
                <div className="space-y-2">
                  <Label>Versão da Graph API</Label>
                  <select value={form.graphApiVersion} onChange={(e: any) => setForm(p => ({ ...p, graphApiVersion: e?.target?.value ?? 'v21.0' }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="v21.0">v21.0 (Recomendada)</option>
                    <option value="v20.0">v20.0</option>
                    <option value="v19.0">v19.0</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>App Secret</Label>
                <div className="relative">
                  <Input type={showSecret ? 'text' : 'password'} value={form.appSecret} onChange={(e: any) => setForm(p => ({ ...p, appSecret: e?.target?.value ?? '' }))} placeholder={config?.appSecret ? `Manter atual (${config.appSecret})` : 'Opcional'} />
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Access Token (System User Token) *</Label>
                <div className="relative">
                  <Input type={showToken ? 'text' : 'password'} value={form.accessToken} onChange={(e: any) => setForm(p => ({ ...p, accessToken: e?.target?.value ?? '' }))} placeholder={config?.accessToken ? `Manter atual (${config.accessToken})` : 'Token permanente do System User'} />
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Use o token permanente do System User (não o token temporário de teste)</p>
              </div>
              <div className="space-y-2">
                <Label>Webhook Verify Token</Label>
                <Input value={form.webhookToken} onChange={(e: any) => setForm(p => ({ ...p, webhookToken: e?.target?.value ?? '' }))} placeholder="Token customizado para validação de webhooks" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e: any) => setForm(p => ({ ...p, descricao: e?.target?.value ?? '' }))} placeholder="Ex: Produção - App Principal" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Configuração</>}
                </Button>
                <Button variant="outline" onClick={handleTestConnection} disabled={testing || (!form.accessToken && !config?.accessToken)}>
                  {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</> : <><Unplug className="w-4 h-4 mr-2" /> Testar Conexão</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Result */}
          {testResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={testResult.success ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {testResult.success
                      ? <><CheckCircle2 className="w-5 h-5 text-green-600" /> Conexão Estabelecida</>
                      : <><XCircle className="w-5 h-5 text-red-600" /> Falha na Conexão</>
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {testResult.success ? (
                    <>
                      {/* Token Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-muted-foreground">Tipo do Token</p>
                          <p className="font-medium text-sm">{testResult.token?.type ?? 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-muted-foreground">App</p>
                          <p className="font-medium text-sm">{testResult.token?.appName ?? 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Expiração</p>
                          <p className="font-medium text-sm">
                            {testResult.token?.neverExpires ? 'Nunca expira ✅' : testResult.token?.expiresAt ? new Date(testResult.token.expiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Scopes */}
                      <div>
                        <p className="text-sm font-semibold mb-2">Permissões (Scopes)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(testResult.token?.scopes ?? []).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs font-mono bg-blue-50 text-blue-700">{s}</Badge>
                          ))}
                        </div>
                        {(testResult.missingScopes ?? []).length > 0 && (
                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Permissões recomendadas faltando:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(testResult.missingScopes ?? []).map((s: string) => (
                                <Badge key={s} variant="secondary" className="text-xs font-mono bg-amber-100 text-amber-800">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Identity */}
                      {testResult.me && (
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-muted-foreground">Identidade do Token</p>
                          <p className="font-medium">{testResult.me.name} <span className="text-xs text-muted-foreground font-mono">(ID: {testResult.me.id})</span></p>
                        </div>
                      )}

                      {/* Businesses Found */}
                      {(testResult.businesses ?? []).length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Server className="w-4 h-4" /> Business Portfolios Encontrados ({testResult.businesses.length})</p>
                          <div className="space-y-2">
                            {testResult.businesses.map((b: any) => (
                              <div key={b.id} className="p-3 bg-white rounded-lg border flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{b.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-mono text-muted-foreground">ID: {b.id}</span>
                                    <Badge variant="secondary" className={`text-xs ${
                                      b.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                                      b.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {b.verificationStatus === 'verified' ? 'Verificada' :
                                       b.verificationStatus === 'pending' ? 'Pendente' : 'Não Verificada'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-white rounded-lg border border-red-200">
                      <p className="text-sm text-red-700 font-medium">{testResult.error}</p>
                      {testResult.errorCode && <p className="text-xs text-red-500 mt-1">Código: {testResult.errorCode} ({testResult.errorType})</p>}
                      <p className="text-xs text-muted-foreground mt-2">Verifique se o Access Token está correto e não expirou.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Import Section */}
          {(testResult?.success || config?.accessToken) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" /> Importar Dados da Meta
                  </CardTitle>
                  <CardDescription>
                    Importe automaticamente todos os Business Portfolios, WABAs, números de telefone, contas de anúncio e páginas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-700">A importação irá buscar todos os dados acessíveis com o token configurado e salvar no sistema. Contas já importadas serão atualizadas.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Vincular a Empresa *</Label>
                    <select
                      value={selectedEmpresaId}
                      onChange={(e: any) => setSelectedEmpresaId(e?.target?.value ?? '')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecione a empresa...</option>
                      {empresas.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>{emp.nomeFantasia} ({emp.cnpj})</option>
                      ))}
                    </select>
                    {empresas.length === 0 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Cadastre uma empresa primeiro em Empresas &gt; Nova Empresa</p>
                    )}
                  </div>

                  <Button onClick={handleImport} disabled={importing || !selectedEmpresaId}>
                    {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : <><Download className="w-4 h-4 mr-2" /> Importar Tudo da Meta</>}
                  </Button>

                  {/* Import Result */}
                  {importResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {importResult.success ? (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="font-semibold text-green-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Importação Concluída!</p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                            <div className="text-center p-2 bg-white rounded border">
                              <p className="text-2xl font-bold font-mono text-blue-600">{importResult.summary?.contas ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Contas</p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <p className="text-2xl font-bold font-mono text-green-600">{importResult.summary?.wabas ?? 0}</p>
                              <p className="text-xs text-muted-foreground">WABAs</p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <p className="text-2xl font-bold font-mono text-emerald-600">{importResult.summary?.numeros ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Números</p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <p className="text-2xl font-bold font-mono text-orange-600">{importResult.summary?.adAccounts ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Ad Accounts</p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <p className="text-2xl font-bold font-mono text-purple-600">{importResult.summary?.pages ?? 0}</p>
                              <p className="text-xs text-muted-foreground">Páginas</p>
                            </div>
                          </div>

                          {/* Imported Items Details */}
                          {(importResult.data?.contas ?? []).length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-green-700 mb-1">Contas Importadas:</p>
                              {importResult.data.contas.map((c: any) => (
                                <p key={c.id} className="text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {c.name} (BM: {c.businessId})
                                </p>
                              ))}
                            </div>
                          )}

                          {(importResult.data?.numeros ?? []).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-green-700 mb-1">Números Encontrados:</p>
                              {importResult.data.numeros.map((n: any) => (
                                <p key={n.id} className="text-xs text-green-600 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {n.number} - {n.name ?? 'Sem nome'} (Qualidade: {n.quality ?? 'N/A'})
                                </p>
                              ))}
                            </div>
                          )}

                          {(importResult.data?.errors ?? []).length > 0 && (
                            <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                              <p className="text-xs font-semibold text-amber-700 mb-1">Avisos:</p>
                              {importResult.data.errors.map((e: string, i: number) => (
                                <p key={i} className="text-xs text-amber-600">⚠️ {e}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-sm text-red-700 font-medium">{importResult.error}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Start */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-blue-600" /> Como Começar</CardTitle>
              <CardDescription>Passo a passo para integrar com a Meta Business API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { step: '1', title: 'Criar App no Meta', desc: 'Acesse developers.facebook.com e crie um app tipo Business com WhatsApp habilitado.' },
                  { step: '2', title: 'Gerar System User Token', desc: 'Crie um System User com permissões whatsapp_business_management e business_management.' },
                  { step: '3', title: 'Configurar e Testar', desc: 'Cole o App ID e Access Token acima e clique em Testar Conexão.' },
                  { step: '4', title: 'Importar Dados', desc: 'Após conexão OK, importe automaticamente todas as contas e números.' },
                ].map((item) => (
                  <div key={item.step} className="p-4 bg-white rounded-lg border">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mb-3">{item.step}</div>
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'guia' && (
        <div className="space-y-6">
          {/* Important Notes */}
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-amber-800">Informações Importantes</p>
                  <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc ml-4">
                    <li>A criação do Business Portfolio (é manual via <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">business.facebook.com</a></li>
                    <li>Verificação de empresa leva até 14 dias úteis (Standard) ou 5min-48h (Partner-led/PLBV)</li>
                    <li>Novos portfólios são limitados a 2 números. Limite sobe para 20 após verificação</li>
                    <li>API base: <code className="bg-white px-1 rounded">https://graph.facebook.com/v21.0</code></li>
                    <li>Limite de registro: 10 requisições por número em janela de 72 horas</li>
                    <li>Autenticação 2FA: PIN de 6 dígitos obrigatório no registro de números</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions Required */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5" /> Permissões Necessárias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { perm: 'whatsapp_business_management', desc: 'Gerenciar WABAs, números e templates' },
                  { perm: 'whatsapp_business_messaging', desc: 'Enviar e receber mensagens' },
                  { perm: 'business_management', desc: 'Gerenciar portfólios e assets' },
                  { perm: 'pages_manage_ads', desc: 'Gerenciar anúncios em páginas' },
                  { perm: 'ads_management', desc: 'Criar e gerenciar campanhas' },
                  { perm: 'ads_read', desc: 'Ler dados de desempenho' },
                ].map((p) => (
                  <div key={p.perm} className="p-3 bg-muted/50 rounded-lg">
                    <code className="text-xs font-mono text-blue-600">{p.perm}</code>
                    <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* API Endpoints Reference */}
          {apiEndpoints.map((cat, catIdx) => {
            const CatIcon = cat.icone;
            return (
              <motion.div key={cat.categoria} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: catIdx * 0.05 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CatIcon className="w-5 h-5" /> {cat.categoria}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cat.endpoints.map((ep, epIdx) => (
                      <div key={epIdx} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <Badge className={`${metodoColor[ep.metodo] ?? ''} font-mono text-xs`} variant="secondary">
                            {ep.metodo}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <code className="text-sm font-mono break-all">{ep.path}</code>
                            <p className="text-sm text-muted-foreground mt-1">{ep.descricao}</p>
                            {ep.notas && (
                              <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded">{ep.notas}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Webhooks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Webhook className="w-5 h-5" /> Webhooks Disponíveis</CardTitle>
              <CardDescription>Eventos que você pode assinar para receber notificações em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { evento: 'messages', desc: 'Mensagens recebidas e status de entrega' },
                  { evento: 'message_template_quality_update', desc: 'Mudanças na qualidade dos templates' },
                  { evento: 'phone_number_quality_update', desc: 'Mudanças na qualidade do número' },
                  { evento: 'account_update', desc: 'Mudanças no status da conta' },
                  { evento: 'security', desc: 'Alertas de segurança e 2FA' },
                ].map((w) => (
                  <div key={w.evento} className="p-3 border rounded-lg">
                    <code className="text-xs font-mono text-purple-600">{w.evento}</code>
                    <p className="text-xs text-muted-foreground mt-1">{w.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* External Links */}
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-3">Links Úteis</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Meta for Developers', url: 'https://developers.facebook.com' },
                  { label: 'Graph API Explorer', url: 'https://developers.facebook.com/tools/explorer' },
                  { label: 'Business Suite', url: 'https://business.facebook.com' },
                  { label: 'WhatsApp Manager', url: 'https://business.facebook.com/wa/manage' },
                  { label: 'Status da API', url: 'https://metastatus.com/whatsapp-business-api' },
                  { label: 'Documentação WABA', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api' },
                ].map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors">
                    <ExternalLink className="w-3 h-3" /> {link.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
