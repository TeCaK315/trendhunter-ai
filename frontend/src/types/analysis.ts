// Shared types for the 6-block analysis system + AI Synthesis

export type ConflictType =
  | "existential"
  | "operational"
  | "manageable"
  | "none";

export interface BlockOutput {
  block_number: number;
  block_type: string;
  diagnosis: "green" | "yellow" | "red";
  score: number;
  conflict_weight: number;
  key_factors: string[];
  key_metric: string;
  block_context: Record<string, unknown>;
}

export interface Conflict {
  weight: number;
  type: ConflictType;
  pair: string;
  mechanism: string;
  blocks_involved: number[];
}

// Skeptic output — two modes depending on whether real conflicts exist
export interface SkepticOutput {
  // Mode 1: Conflict analysis (when real conflicts found)
  points?: Array<{
    conflict_pair: string;
    mechanism: string;
    severity: "existential" | "operational" | "manageable";
  }>;
  // Mode 2: Blind Spot Detector (when no conflicts)
  blind_spots?: Array<{
    category: "regulatory" | "technological" | "cultural";
    risk: string;
    timeline: string;
  }>;
}

export interface OptimistOutput {
  neutralizations: Array<{
    addresses_conflict: string;
    condition: string;
    type:
      | "pricing_model"
      | "strategic_gap"
      | "pivot"
      | "partnership"
      | "sequencing";
  }>;
}

export interface ArbitratorOutput {
  verdict_type: "go_if" | "no_go_until" | "experiment_if";
  verdict_condition: string;
  verdict_reasoning: string;
  priority_actions: Array<{
    order: number;
    action: string;
    timeline: string;
    addresses: string;
  }>;
  confidence: number;
  confidence_factors?: string[];
}
