// Tipos de domínio expostos ao front
export type StatusEmpresa = 'PENDENTE' | 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';

export type StatusContaMeta =
  | 'ATIVA'
  | 'DESATIVADA'
  | 'EM_REVISAO'
  | 'SUSPENSA'
  | 'CANCELADA'
  | 'RESTRITA';

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  segmento: string;
  email: string;
  telefone?: string | null;
  website?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  status: StatusEmpresa;
  trustScore: number;
  observacoes?: string | null;
  createdAt: string;
  updatedAt: string;
}
