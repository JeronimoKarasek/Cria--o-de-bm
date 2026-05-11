'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, CheckCircle, Clock, XCircle, Facebook,
  Globe, BarChart3, TrendingUp, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const DashboardCharts = dynamic(() => import('./dashboard-charts').then((m: any) => m.DashboardCharts), { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" /> }) as any;

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

function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <span className="font-mono">{count}</span>;
}

export function DashboardContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r: any) => r?.json?.())
      .then((d: any) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics ?? {};

  const cards = [
    { label: 'Total Empresas', value: metrics?.totalEmpresas ?? 0, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Aprovadas', value: metrics?.empresasAprovadas ?? 0, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Pendentes', value: metrics?.empresasPendentes ?? 0, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Contas Meta', value: metrics?.totalContas ?? 0, icon: Facebook, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Sites BMS', value: metrics?.totalSites ?? 0, icon: Globe, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Trust Score M\u00e9dio', value: metrics?.trustScoreMedio ?? 0, icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_: any, i: number) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Vis\u00e3o geral do sistema de verifica\u00e7\u00e3o</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(cards ?? []).map((card: any, index: number) => {
          const Icon = card?.icon;
          return (
            <motion.div
              key={card?.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{card?.label}</p>
                      <p className="text-3xl font-bold mt-1">
                        <AnimatedCounter target={card?.value ?? 0} />
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${card?.bg} flex items-center justify-center`}>
                      {Icon && <Icon className={`w-6 h-6 ${card?.color}`} />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <DashboardCharts
        scoreDistribution={data?.scoreDistribution ?? []}
        empresasPorSegmento={data?.empresasPorSegmento ?? []}
      />

      {/* Recent Empresas */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Empresas Recentes</CardTitle>
            <Link href="/empresas">
              <Button variant="ghost" size="sm">
                Ver todas <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.recentEmpresas ?? []).map((emp: any) => (
                <Link key={emp?.id} href={`/empresas/${emp?.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp?.nomeFantasia ?? 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{emp?.segmento ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-mono">Score: {emp?.trustScore ?? 0}</p>
                      </div>
                      <Badge className={statusColors?.[emp?.status] ?? 'bg-gray-100 text-gray-800'} variant="secondary">
                        {statusLabels?.[emp?.status] ?? emp?.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
              {(data?.recentEmpresas ?? []).length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Nenhuma empresa cadastrada</p>
                  <p className="text-sm text-muted-foreground">Comece cadastrando uma empresa ou importe seus dados da Meta API em <strong>Integração Meta</strong></p>
                  <div className="flex gap-2 justify-center">
                    <Link href="/empresas/nova"><Button size="sm">Cadastrar Empresa</Button></Link>
                    <Link href="/integracao-meta"><Button size="sm" variant="outline">Importar da Meta</Button></Link>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
