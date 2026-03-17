/** A single action taken during a run (e.g. paused ad set, updated budget) */
export interface ReportAction {
  timestamp: string;
  action: string;
  targetId?: string;
  targetName?: string;
  details?: string;
}

/** Performance snapshot for a campaign, ad set, or ad */
export interface PerformanceSnapshot {
  id: string;
  name: string;
  spend?: number;
  impressions?: number;
  conversions?: number;
  roas?: number;
  cpa?: number;
  [key: string]: unknown;
}

/** In-memory report structure used by both agents */
export interface RunReport {
  clientName: string;
  agent: string;
  runAt: string;
  summary: {
    totalSpend?: number;
    actionsCount: number;
    errors?: string[];
  };
  actions: ReportAction[];
  performance?: PerformanceSnapshot[];
}
