export interface FunnelStage {
  id:        string;
  tenantId:  string;
  name:      string;
  color:     string;
  position:  number;
  isWon:     boolean;
  isLost:    boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealContact {
  id:    string;
  name:  string | null;
  phone: string;
}

export interface DealStage {
  id:    string;
  name:  string;
  color: string;
}

export interface Deal {
  id:         string;
  tenantId:   string;
  stageId:    string;
  stage:      DealStage;
  contactId:  string | null;
  contact:    DealContact | null;
  title:      string;
  valueCents: number;
  notes:      string | null;
  closedAt:   string | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface CrmStats {
  pipelineValueCents: number;
  openCount:          number;
  byStage: Array<{
    stageId:    string;
    stageName:  string;
    stageColor: string;
    count:      number;
    valueCents: number;
  }>;
}

export interface ContactSearchResult {
  id:    string;
  name:  string | null;
  phone: string;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
