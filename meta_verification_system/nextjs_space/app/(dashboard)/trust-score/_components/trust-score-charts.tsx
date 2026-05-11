'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'];

export function TrustScoreCharts({ empresas }: { empresas: any[] }) {
  const chartData = (empresas ?? [])
    .sort((a: any, b: any) => (b?.trustScore ?? 0) - (a?.trustScore ?? 0))
    .slice(0, 10)
    .map((e: any) => ({
      name: (e?.nomeFantasia ?? 'N/A').length > 12 ? (e?.nomeFantasia ?? '').slice(0, 12) + '...' : (e?.nomeFantasia ?? 'N/A'),
      score: e?.trustScore ?? 0,
    }));

  const getBarColor = (score: number): string => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Trust Score por Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <XAxis
                dataKey="name"
                tickLine={false}
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10 }}
                domain={[0, 100]}
                label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="score" name="Trust Score" radius={[4, 4, 0, 0]}>
                {(chartData ?? []).map((entry: any, i: number) => (
                  <Cell key={i} fill={getBarColor(entry?.score ?? 0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
