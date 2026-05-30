'use client';

import { useState } from 'react';
import { Thermometer, Play, Pause, RotateCcw, TrendingUp, AlertTriangle } from 'lucide-react';

// --------------------------------------------------------------------------
// Estágios de warming com cores e descrições
// --------------------------------------------------------------------------
const WARMING_STAGES: Record<string, { label: string; color: string; bg: string }> = {
  COLD:           { label: '❄️ Frio',         color: 'text-slate-400',  bg: 'bg-slate-50' },
  WARMING_1_3:    { label: '🌡️ Dia 1-3',     color: 'text-blue-600',   bg: 'bg-blue-50' },
  WARMING_4_7:    { label: '🔥 Dia 4-7',     color: 'text-orange-600', bg: 'bg-orange-50' },
  WARMING_8_14:   { label: '📈 Dia 8-14',    color: 'text-amber-600',  bg: 'bg-amber-50' },
  WARMING_15_21:  { label: '🚀 Dia 15-21',   color: 'text-green-600',  bg: 'bg-green-50' },
  ACTIVE:         { label: '✅ Ativo',        color: 'text-emerald-600', bg: 'bg-emerald-50' },
  BLOCKED:        { label: '🚫 Bloqueado',   color: 'text-red-600',    bg: 'bg-red-50' },
  PAUSED:         { label: '⏸️ Pausado',     color: 'text-yellow-600', bg: 'bg-yellow-50' },
};

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------
interface WarmingPanelProps {
  numero: {
    id: string;
    numero: string;
    displayName?: string | null;
    warmingStage?: string;
    warmingDay?: number;
    warmingStartedAt?: string | null;
    dailyMsgCount?: number;
    dailyMsgLimit?: number;
    msgTotalSent?: number;
    qualityRating?: string;
    warmingNotes?: string | null;
  };
  onAction?: (action: string) => void;
}

// --------------------------------------------------------------------------
// Componente principal
// --------------------------------------------------------------------------
export default function WarmingPanel({ numero, onAction }: WarmingPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stage = WARMING_STAGES[numero.warmingStage ?? 'COLD'] ?? WARMING_STAGES.COLD;

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'reset') => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/numeros-whatsapp/${numero.id}/warming`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      onAction?.(action);
    } catch (e: any) {
      setError(e.message ?? 'Erro desconhecido');
    } finally {
      setLoading(null);
    }
  };

  const progressPercent = numero.dailyMsgLimit
    ? Math.min(100, Math.round(((numero.dailyMsgCount ?? 0) / numero.dailyMsgLimit) * 100))
    : 0;

  return (
    <div className={`rounded-lg border p-4 ${stage.bg}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-slate-500" />
          <span className="font-medium text-sm">Aquecimento</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${stage.color} bg-white/50`}>
            {stage.label}
          </span>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-1">
          {(!numero.warmingStage || numero.warmingStage === 'COLD') && (
            <button
              onClick={() => handleAction('start')}
              disabled={!!loading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {loading === 'start' ? '...' : 'Iniciar'}
            </button>
          )}
          {['WARMING_1_3', 'WARMING_4_7', 'WARMING_8_14', 'WARMING_15_21'].includes(numero.warmingStage ?? '') && (
            <button
              onClick={() => handleAction('pause')}
              disabled={!!loading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              <Pause className="h-3 w-3" />
              {loading === 'pause' ? '...' : 'Pausar'}
            </button>
          )}
          {numero.warmingStage === 'PAUSED' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={!!loading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {loading === 'resume' ? '...' : 'Retomar'}
            </button>
          )}
          {(numero.warmingStage && numero.warmingStage !== 'COLD') && (
            <button
              onClick={() => handleAction('reset')}
              disabled={!!loading}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-100 text-red-700 text-xs rounded">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          {error}
        </div>
      )}

      {/* Métricas */}
      {(numero.warmingStage && numero.warmingStage !== 'COLD') && (
        <div className="space-y-2">
          {/* Barra de progresso diário */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Mensagens Hoje</span>
              <span>{numero.dailyMsgCount ?? 0} / {numero.dailyMsgLimit ?? 0}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  progressPercent > 90 ? 'bg-red-500' : progressPercent > 70 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Grid de métricas */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white/50 rounded p-2">
              <div className="text-slate-400">Dia</div>
              <div className="font-bold">{numero.warmingDay ?? 0}/21</div>
            </div>
            <div className="bg-white/50 rounded p-2">
              <div className="text-slate-400">Total Enviadas</div>
              <div className="font-bold">{numero.msgTotalSent ?? 0}</div>
            </div>
            <div className="bg-white/50 rounded p-2">
              <div className="text-slate-400">Qualidade Meta</div>
              <div className={`font-bold ${
                numero.qualityRating === 'GREEN' ? 'text-green-600' :
                numero.qualityRating === 'YELLOW' ? 'text-amber-600' :
                numero.qualityRating === 'RED' ? 'text-red-600' : 'text-slate-400'
              }`}>
                {numero.qualityRating ?? '-'}
              </div>
            </div>
          </div>

          {/* Notas */}
          {numero.warmingNotes && (
            <div className="text-xs text-slate-500 italic">
              📝 {numero.warmingNotes}
            </div>
          )}

          {/* Alerta de aquecimento concluído */}
          {numero.warmingStage === 'ACTIVE' && (
            <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 rounded p-2">
              <TrendingUp className="h-3 w-3" />
              Aquecimento concluído — número liberado para disparo normal
            </div>
          )}
        </div>
      )}

      {/* Estado COLD (não iniciado) */}
      {(!numero.warmingStage || numero.warmingStage === 'COLD') && (
        <div className="text-xs text-slate-400 text-center py-2">
          Aquecimento não iniciado. Clique em "Iniciar" para começar o processo gradual.
        </div>
      )}
    </div>
  );
}
