'use client';

import { useState, useEffect } from 'react';
import { Thermometer, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import WarmingPanel from '@/components/warming-panel';

interface WarmingSummary {
  total: number;
  active: number;
  blocked: number;
  inWarming: number;
  byStage: Record<string, number>;
}

interface NumeroWarming {
  id: string;
  numero: string;
  displayName?: string | null;
  warmingStage: string;
  warmingDay: number;
  warmingStartedAt: string | null;
  dailyMsgCount: number;
  dailyMsgLimit: number;
  msgTotalSent: number;
  qualityRating: string;
  warmingNotes: string | null;
  empresa: { nomeFantasia: string };
}

export default function WarmingDashboard() {
  const [summary, setSummary] = useState<WarmingSummary | null>(null);
  const [numeros, setNumeros] = useState<NumeroWarming[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, numRes] = await Promise.all([
        fetch('/api/warming/summary'),
        fetch(`/api/numeros-whatsapp?includeWarming=true`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (numRes.ok) setNumeros(await numRes.json());
    } catch (e) {
      console.error('Warming dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = filter === 'all'
    ? numeros
    : numeros.filter(n => n.warmingStage === filter);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Thermometer className="h-6 w-6 text-orange-500" />
          Aquecimento de Números
        </h2>
        <button
          onClick={fetchData}
          className="text-sm text-blue-600 hover:underline"
        >
          Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-slate-500">Total</div>
            <div className="text-2xl font-bold">{summary.total}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <div className="text-sm text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Ativos
            </div>
            <div className="text-2xl font-bold text-emerald-800">{summary.active}</div>
          </div>
          <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
            <div className="text-sm text-orange-700 flex items-center gap-1">
              <Clock className="h-4 w-4" /> Em Aquecimento
            </div>
            <div className="text-2xl font-bold text-orange-800">{summary.inWarming}</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-700 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Bloqueados
            </div>
            <div className="text-2xl font-bold text-red-800">{summary.blocked}</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all',          label: 'Todos' },
          { key: 'WARMING_1_3',  label: 'Dia 1-3' },
          { key: 'WARMING_4_7',  label: 'Dia 4-7' },
          { key: 'WARMING_8_14', label: 'Dia 8-14' },
          { key: 'WARMING_15_21',label: 'Dia 15-21' },
          { key: 'ACTIVE',       label: 'Ativos' },
          { key: 'BLOCKED',      label: 'Bloqueados' },
          { key: 'PAUSED',       label: 'Pausados' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-sm rounded-full border ${
              filter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de números com painel de warming */}
      <div className="space-y-4">
        {filtered.map(numero => (
          <WarmingPanel
            key={numero.id}
            numero={numero}
            onAction={fetchData}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            Nenhum número encontrado neste estágio.
          </div>
        )}
      </div>
    </div>
  );
}
