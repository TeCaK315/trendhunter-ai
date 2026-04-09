// lib/competition/competitor-size.ts
// Size estimation: G2 reviews x 7, LinkedIn x 100
// Thresholds: micro(<500), small(<5000), medium(<50000), large(>=50000)

export type CompetitorSizeEstimate = 'micro' | 'small' | 'medium' | 'large';

export function estimateCompetitorSize(
  g2Reviews: number | null
): { estimate: CompetitorSizeEstimate; customers: number } {
  const customers = (g2Reviews ?? 0) * 7;
  const estimate: CompetitorSizeEstimate =
    customers < 500 ? 'micro' :
    customers < 5000 ? 'small' :
    customers < 50000 ? 'medium' : 'large';
  return { estimate, customers };
}
