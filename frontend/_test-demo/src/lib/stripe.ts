import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable');
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/** @deprecated Use getStripeServer() instead */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripeServer() as any)[prop];
  },
});

export const PLANS = [
  {
    "name": "Free",
    "price": 0,
    "features": [
      "5 analyses/month",
      "Basic reports"
    ],
    "limits": {}
  },
  {
    "name": "Pro",
    "price": 29,
    "features": [
      "100 analyses/month",
      "Advanced reports",
      "API access"
    ],
    "limits": {}
  },
  {
    "name": "Enterprise",
    "price": 99,
    "features": [
      "Unlimited",
      "Custom reports",
      "Team access"
    ],
    "limits": {}
  }
] as const;

export type PlanName = (typeof PLANS)[number]['name'];

export function getPlanByName(name: string) {
  return PLANS.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function getPlanLimit(planName: string, limitKey: string): number {
  const plan = getPlanByName(planName);
  if (!plan) return 0;
  const limit = plan.limits[limitKey as keyof typeof plan.limits];
  return typeof limit === 'number' ? limit : 0;
}
