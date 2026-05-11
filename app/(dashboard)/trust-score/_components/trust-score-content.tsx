'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Building2, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const TrustScoreCharts = dynamic(() => import('./trust-score-charts').then((m: any) => m.TrustScoreCharts), { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" /> }) as any;

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}
function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Regular';
  if (score >= 20) return 'Baixo';
  return 'Cr\u00edtico';
}

export function TrustScoreContent() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/empresas')
      .then((r: any) => r?.json?.())
      .then((d: any) => setEmpresas(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avgScore = (empresas ?? []).length > 0
    ? Math.round((empresas ?? []).reduce((sum: number, e: any) => sum + (e?.trustScore ?? 0), 0) / (empresas?.length ?? 1))
    : 0;

  const excellent = (empresas ?? []).filter((e: any) => (e?.trustScore ?? 0) >= 80).length;
  const good = (empresas ?? []).filter((e: any) => (e?.trustScore ?? 0) >= 60 && (e?.trustScore ?? 0) < 80).length;
  const critical = (empresas ?? []).filter((e: any) => (e?.trustScore ?? 0) < 40).length;

  const sorted = [...(empresas ?? [])].sort((a: any, b: any) => (b?.trustScore ?? 0) - (a?.trustScore ?? 0));

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Trust Score</h1>
        <p className="text-muted-foreground mt-1">Avalia\u00e7\u00e3o de prontid\u00e3o das empresas para verifica\u00e7\u00e3o Meta</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Score M\u00e9dio', value: avgScore, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Excelentes', value: excellent, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Bons', value: good, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Cr\u00edticos', value: critical, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((card: any, i: number) => {
          const Icon = card?.icon;
          return (
            <motion.div key={card?.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${card?.bg} flex items-center justify-center`}>
                    {Icon && <Icon className={`w-5 h-5 ${card?.color}`} />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card?.label}</p>
                    <p className="text-2xl font-bold font-mono">{card?.value ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <TrustScoreCharts empresas={empresas} />

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ranking de Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(sorted ?? []).map((emp: any, index: number) => (
              <motion.div
                key={emp?.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/empresas/${emp?.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-muted-foreground w-8">#{index + 1}</span>
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp?.nomeFantasia ?? 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{emp?.segmento ?? ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${emp?.trustScore ?? 0}%`, background: getScoreColor(emp?.trustScore ?? 0) }} />
                      </div>
                      <span className="text-sm font-mono font-bold" style={{ color: getScoreColor(emp?.trustScore ?? 0) }}>{emp?.trustScore ?? 0}</span>
                      <Badge variant="secondary" className="text-xs" style={{ color: getScoreColor(emp?.trustScore ?? 0) }}>
                        {getScoreLabel(emp?.trustScore ?? 0)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
