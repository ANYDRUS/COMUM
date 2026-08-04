export interface Comunidade {
  ID_COMUNIDADE: string | number;
  COD_COMUNIDADE?: string;
  NOM_COMUNIDADE: string;
  MUNICIPIO: string;
  UF?: string;
  LAT: number | string;
  LON: number | string;
  FAMILIAS_ESTIMADAS?: number;
  SITUACAO_URBANISTICA?: string;
  DATA_CADASTRO?: string;
}

export interface Evento {
  ID_EVENTO: string | number;
  ID_COMUNIDADE: string | number;
  ID_PJ?: string | number | null;
  NOM_EVENTO: string;
  TIPO_EVENTO: string;
  DATA_EVENTO: string;
  DES_EVENTO: string;
  STATUS_EVENTO?: string;
}

export interface Movimento {
  ID_MOVIMENTO: string | number;
  ID_EVENTO: string | number;
  NOM_MOV: string;
  TIPO_MOV: string;
  DATA_MOV: string;
  DESC_MOV?: string;
  RESPONSAVEL_MOV?: string;
}

export interface PJ {
  ID_PJ: string | number;
  NOM_PJ: string;
  CNPJ?: string;
  TIPO_ENTIDADE?: string; // ex: 'Órgão Público', 'ONG', 'Defensoria', 'Associação'
  CONTATO?: string;
}

export interface PF {
  ID_PF: string | number;
  ID_PJ?: string | number | null;
  NOM_PF: string;
  CARGO_FUNCAO?: string;
  EMAIL?: string;
  TELEFONE?: string;
}

export interface EventoProcessed extends Evento {
  pj?: PJ;
  movimentos: Movimento[];
  pfsEnvolvidas: PF[];
}

export interface ComunidadeProcessed extends Comunidade {
  eventos: EventoProcessed[];
}

export interface FullDataset {
  comunidades: Comunidade[];
  eventos: Evento[];
  movimentos: Movimento[];
  pjs: PJ[];
  pfs: PF[];
}

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  organization?: string;
  role?: 'admin' | 'viewer'; // 'admin' = Administrador, 'viewer' = Visualização simples
  isAuthenticated: boolean;
}

export interface ExtractedEntitiesDraft {
  id: string;
  sourceTextSnippet: string;
  createdAt: string;
  comunidades: Partial<Comunidade>[];
  eventos: Partial<Evento>[];
  movimentos: Partial<Movimento>[];
  pjs: Partial<PJ>[];
  pfs: Partial<PF>[];
  status: 'pending' | 'approved' | 'rejected';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: string;
  selectedCommunitiesCount?: number;
}
