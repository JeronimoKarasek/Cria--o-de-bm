'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, User, Building2, Clock, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const acaoColors: Record<string, string> = {
  CRIAR: 'bg-green-100 text-green-800',
  ATUALIZAR: 'bg-blue-100 text-blue-800',
  DELETAR: 'bg-red-100 text-red-800',
  UPLOAD: 'bg-purple-100 text-purple-800',
};

export function AuditoriaContent() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auditoria')
      .then((r: any) => r?.json?.())
      .then((d: any) => setLogs(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground mt-1">Hist\u00f3rico de a\u00e7\u00f5es realizadas no sistema</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_: any, i: number) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (logs ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum registro encontrado</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(logs ?? []).map((log: any, index: number) => (
                <motion.div
                  key={log?.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{log?.descricao ?? 'A\u00e7\u00e3o'}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <User className="w-3 h-3" />
                        <span>{log?.user?.name ?? 'Sistema'}</span>
                        {log?.empresa?.nomeFantasia && (
                          <>
                            <span>\u2022</span>
                            <Building2 className="w-3 h-3" />
                            <span>{log.empresa.nomeFantasia}</span>
                          </>
                        )}
                        <span>\u2022</span>
                        <span>{log?.entidade ?? ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={acaoColors?.[log?.acao] ?? 'bg-gray-100 text-gray-800'} variant="secondary">
                      {log?.acao ?? ''}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{log?.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
