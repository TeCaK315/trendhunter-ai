// lib/monetization/liveness.ts — Liveness check for Block 3

import type { LivenessLevel, LivenessResult, Block2Input, SerpApiClient } from './schemas';

const GENERIC_TECH_KEYWORDS = new Set([
  "developer", "engineer", "programmer", "consultant",
  "designer", "manager", "analyst", "architect", "specialist",
]);

export async function checkLiveness(params: {
  directCompetitors: Block2Input["competitors_found"];
  serpAdDensity: number;
  payingRatio: number;
  nicheInput: string;
  serpApi: SerpApiClient;
  isB2B: boolean;
}): Promise<LivenessResult> {
  const signals: string[] = [];
  let score = 0;

  if (params.serpAdDensity > 0.3) { score += 0.3; signals.push("high_ad_density"); }
  else if (params.serpAdDensity > 0.1) { score += 0.15; signals.push("moderate_ad_density"); }

  if (params.payingRatio > 0.3) { score += 0.3; signals.push("high_paying_ratio"); }
  else if (params.payingRatio > 0.1) { score += 0.15; signals.push("moderate_paying_ratio"); }

  if (params.directCompetitors.length >= 3) { score += 0.2; signals.push("multiple_competitors"); }
  else if (params.directCompetitors.length > 0) { score += 0.1; signals.push("some_competitors"); }

  try {
    const jobSearch = await params.serpApi.search(
      `hire "${params.nicheInput}" specialist OR "${params.nicheInput}" job opening`
    );
    const isGeneric = Array.from(GENERIC_TECH_KEYWORDS).some(term =>
      params.nicheInput.toLowerCase().includes(term)
    );
    if ((jobSearch.organic_results?.length ?? 0) > 5 && !isGeneric) {
      score += 0.15;
      signals.push("job_postings_present");
    }
  } catch { /* non-critical */ }

  if (params.isB2B && params.directCompetitors.length > 0) {
    score = Math.min(score + 0.1, 1.0);
    signals.push("b2b_market_modifier");
  }

  const level: LivenessLevel =
    score >= 0.7 ? "STRONG" :
    score >= 0.4 ? "PRESENT" :
    score >= 0.15 ? "WEAK" : "NONE";

  return { level, strengthScore: Math.min(score, 1.0), signals };
}
