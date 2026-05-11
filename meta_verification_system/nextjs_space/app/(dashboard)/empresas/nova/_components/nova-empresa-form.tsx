'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { toast } from 'sonner';

const SEGMENTOS = [
  'Tecnologia', 'Marketing Digital', 'E-commerce', 'Alimenta\u00e7\u00e3o',
  'Moda e Vestu\u00e1rio', 'Sa\u00fade', 'Educa\u00e7\u00e3o', 'Finan\u00e7as',
  'Imobili\u00e1rio', 'Automotivo', 'Turismo', 'Entretenimento', 'Outro'
];

export function NovaEmpresaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: '', nomeFantasia: '', cnpj: '', segmento: '',
    email: '', telefone: '', website: '', endereco: '',
    cidade: '', estado: '', cep: '', observacoes: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao criar empresa');
        return;
      }
      toast.success('Empresa cadastrada com sucesso!');
      router.replace(`/empresas/${data?.id}`);
    } catch {
      toast.error('Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/empresas">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Nova Empresa</h1>
          <p className="text-muted-foreground mt-1">Cadastre uma nova empresa no sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Raz\u00e3o Social *</Label>
                <Input value={form?.razaoSocial ?? ''} onChange={(e: any) => updateField('razaoSocial', e?.target?.value ?? '')} required />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia *</Label>
                <Input value={form?.nomeFantasia ?? ''} onChange={(e: any) => updateField('nomeFantasia', e?.target?.value ?? '')} required />
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input value={form?.cnpj ?? ''} onChange={(e: any) => updateField('cnpj', e?.target?.value ?? '')} placeholder="00.000.000/0000-00" required />
              </div>
              <div className="space-y-2">
                <Label>Segmento *</Label>
                <select
                  value={form?.segmento ?? ''}
                  onChange={(e: any) => updateField('segmento', e?.target?.value ?? '')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecione...</option>
                  {(SEGMENTOS ?? []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form?.email ?? ''} onChange={(e: any) => updateField('email', e?.target?.value ?? '')} required />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form?.telefone ?? ''} onChange={(e: any) => updateField('telefone', e?.target?.value ?? '')} placeholder="(00) 0000-0000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Website</Label>
                <Input value={form?.website ?? ''} onChange={(e: any) => updateField('website', e?.target?.value ?? '')} placeholder="https://" />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-medium mb-3">Endere\u00e7o</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endere\u00e7o</Label>
                  <Input value={form?.endereco ?? ''} onChange={(e: any) => updateField('endereco', e?.target?.value ?? '')} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form?.cidade ?? ''} onChange={(e: any) => updateField('cidade', e?.target?.value ?? '')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={form?.estado ?? ''} onChange={(e: any) => updateField('estado', e?.target?.value ?? '')} maxLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={form?.cep ?? ''} onChange={(e: any) => updateField('cep', e?.target?.value ?? '')} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observa\u00e7\u00f5es</Label>
              <Textarea value={form?.observacoes ?? ''} onChange={(e: any) => updateField('observacoes', e?.target?.value ?? '')} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Link href="/empresas"><Button variant="outline">Cancelar</Button></Link>
          <Button type="submit" loading={loading}><Save className="w-4 h-4 mr-2" /> Cadastrar Empresa</Button>
        </div>
      </form>
    </div>
  );
}
