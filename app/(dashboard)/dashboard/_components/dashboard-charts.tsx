'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const BAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'];
const PIE_COLORS = ['#60B5FF', '#FF9149', '#FF9898', '#FF90BB', '#80D8C3', '#A19AD3', '#72BF78', '#FF6363'];

export function DashboardCharts({
  scoreDistribution,
  empresasPorSegmento,
}: {
  scoreDistribution: any[];
  empresasPorSegmento: any[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Distribui\u00e7\u00e3o de Trust Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <XAxis
                  dataKey="range"
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Faixa', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
                />
                <YAxis
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Qtd', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Empresas" radius={[4, 4, 0, 0]}>
                  {(scoreDistribution ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={BAR_COLORS?.[i] ?? '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Empresas por Segmento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={empresasPorSegmento ?? []}
                  cx="50%"
                  cy="55%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="segmento"
                >
                  {(empresasPorSegmento ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS?.[i % PIE_COLORS.length] ?? '#3b82f6'} />
                  ))}
                </Pie>
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
