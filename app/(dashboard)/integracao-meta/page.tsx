import { Suspense } from 'react';
import { IntegracaoMetaContent } from './_components/integracao-meta-content';

export default function IntegracaoMetaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando integração Meta…</div>}>
      <IntegracaoMetaContent />
    </Suspense>
  );
}
