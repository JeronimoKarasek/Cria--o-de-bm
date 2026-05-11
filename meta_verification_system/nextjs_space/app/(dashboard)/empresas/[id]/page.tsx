import { EmpresaDetail } from './_components/empresa-detail';

export default function EmpresaDetailPage({ params }: { params: { id: string } }) {
  return <EmpresaDetail id={params?.id ?? ''} />;
}
