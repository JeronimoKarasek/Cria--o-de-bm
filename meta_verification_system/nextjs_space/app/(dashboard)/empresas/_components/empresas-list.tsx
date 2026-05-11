'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Filter, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  EM_ANALISE: 'bg-blue-100 text-blue-800',
  APROVADA: 'bg-green-100 text-green-800',
  REJEITADA: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em An\u00e1lise',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
};
const statusOptions = ['TODOS', 'PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA'];

function formatCnpj(cnpj: string): string {
  const c = (cnpj ?? '').replace(/\D/g, '');
  if (c?.length !== 14) return cnpj ?? '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function ScoreBar({ score }: { score: number }) {
  const s = score ?? 0;
  const color = s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-blue-500' : s >= 40 ? 'bg-yellow-500' : s >= 20 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${s}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{s}</span>
    </div>
  );
}

export function EmpresasList() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const fetchEmpresas = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'TODOS') params.set('status', statusFilter);
    if (search) params.set('search', search);
    fetch(`/api/empresas?${params.toString()}`)
      .then((r: any) => r?.json?.())
      .then((d: any) => setEmpresas(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmpresas();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmpresas();
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as empresas cadastradas no sistema</p>
        </div>
        <Link href="/empresas/nova">
          <Button><Plus className="w-4 h-4 mr-2" /> Nova Empresa</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, raz\u00e3o social ou CNPJ..."
              value={search}
              onChange={(e: any) => setSearch(e?.target?.value ?? '')}
              className="pl-10"
            />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          {(statusOptions ?? []).map((s: string) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'TODOS' ? 'Todos' : statusLabels?.[s] ?? s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_: any, i: number) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (empresas ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma empresa encontrada</p>
            <p className="text-muted-foreground mt-1">Cadastre uma nova empresa para come\u00e7ar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(empresas ?? []).map((emp: any, index: number) => (
            <motion.div
              key={emp?.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/empresas/${emp?.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{emp?.nomeFantasia ?? 'N/A'}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{formatCnpj(emp?.cnpj ?? '')}</span>
                            <span>{emp?.segmento ?? ''}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden md:block">
                          <ScoreBar score={emp?.trustScore ?? 0} />
                        </div>
                        <Badge className={statusColors?.[emp?.status] ?? ''} variant="secondary">
                          {statusLabels?.[emp?.status] ?? emp?.status}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
