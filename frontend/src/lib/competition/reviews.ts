// lib/competition/reviews.ts
// Reviews collection: G2 + Trustpilot + Capterra
// isJunk filter + 12 patterns

// ─── SerpAPI helper (same pattern as competition/route.ts) ───

async function fetchSerpAPI(
  engine: string,
  params: Record<string, string>,
  serpApiKey: string,
): Promise<any> {
  try {
    const urlParams = new URLSearchParams({
      engine,
      api_key: serpApiKey,
      ...params,
    });
    const res = await fetch(`https://serpapi.com/search?${urlParams}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Junk patterns — platform text, not user reviews ───

const JUNK_PATTERNS = [
  /g2 takes pride/i,
  /showing unbiased reviews/i,
  /learn more about the cost/i,
  /read verified reviews/i,
  /capterra is free/i,
  /find the best software/i,
  /compare verified reviews/i,
  /sponsored listing/i,
  /how would you rate your experience/i,
  /unsure of what to choose/i,
  /check capterra to compare/i,
  /write a review/i,
];

export function isJunk(text: string): boolean {
  return JUNK_PATTERNS.some(p => p.test(text)) || text.length < 40;
}

// ─── Fetch reviews from G2, Trustpilot, Capterra via SerpAPI ───

export async function fetchReviews(
  competitorName: string,
  serpApiKey: string
): Promise<{ text: string; source: string }[]> {
  const [g2Reviews, trustpilotReviews, capterraReviews] = await Promise.all([
    fetchSerpAPI(
      'google',
      {
        q: `site:g2.com "${competitorName}" "1 star" OR "2 stars" reviews problems`,
        gl: 'us',
        num: '10',
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      'google',
      {
        q: `site:trustpilot.com "${competitorName}" "1 star" OR "2 stars" OR terrible OR awful`,
        gl: 'us',
        num: '5',
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      'google',
      {
        q: `site:capterra.com "${competitorName}" reviews problems`,
        gl: 'us',
        num: '8',
      },
      serpApiKey,
    ),
  ]);

  const reviews: { text: string; source: string }[] = [];

  g2Reviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: 'g2' });
  });

  trustpilotReviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: 'trustpilot' });
  });

  capterraReviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: 'capterra' });
  });

  return reviews.slice(0, 15);
}
