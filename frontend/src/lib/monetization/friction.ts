// lib/monetization/friction.ts — Friction calculation for Block 3

import type { BinarySignals, ContextObject, FrictionScore } from './schemas';

function safeLowercase(str: unknown): string {
  return typeof str === "string" ? str.toLowerCase().trim() : "";
}

export function calculateFrictionScore(
  signals: BinarySignals, ctx: ContextObject, isB2B: boolean,
): FrictionScore {
  let points = 0;

  if (signals.hasContactSales) points += isB2B ? 1 : 3;
  if (!signals.hasSelfService) points += isB2B ? 0 : 2;
  if (!signals.hasPublicPrices) points += isB2B ? 0 : 1;
  if (signals.hasEnterpriseMention) points += isB2B ? 1 : 2;
  if (signals.hasFreeTrial) points -= 1;

  const buyerStr = safeLowercase(ctx.actors?.economic_buyer);
  const financeKeywords = ["cfo", "chief financial", "procurement", "finance manager", "comptroller"];
  if (financeKeywords.some(kw => buyerStr.includes(kw))) {
    points += isB2B ? 1 : 2;
  }

  if (isB2B) points += 0.5;

  if (isB2B) {
    if (points <= 2) return "LOW";
    if (points <= 4) return "MEDIUM";
    return "HIGH";
  } else {
    if (points <= 1) return "LOW";
    if (points <= 2.5) return "MEDIUM";
    return "HIGH";
  }
}
