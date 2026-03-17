import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleSearch } from '@/lib/data-fetchers';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Block 6: "Техническая реализуемость"
 *
 * Вопросы:
 * 1. Complexity Score (Low/Medium/High) — насколько сложно построить MVP
 * 2. Stack Recommendations — рекомендации по технологиям
 * 3. Regulatory Check — нужны ли лицензии/сертификации
 *
 * Данные: SerpAPI для анализа стеков конкурентов + GPT для оценки
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, context } = body;

    const searchQuery = query || context?.trend?.title;
    if (!searchQuery) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    let totalSerpApiCalls = 0;

    // Get competitor info from context
    const competitors: Array<{ name: string; website?: string }> =
      context?.competition?.competitors?.slice(0, 5) || [];
    const category = context?.trend?.category || 'Technology';

    // SerpAPI: search for tech stacks of competitors
    const [techStackResult, regulatoryResult] = await Promise.all([
      fetchGoogleSearch(`${searchQuery} tech stack built with technology`),
      fetchGoogleSearch(`${searchQuery} ${category} regulation compliance license requirements`),
    ]);

    totalSerpApiCalls += techStackResult.serpapi_calls_used;
    totalSerpApiCalls += regulatoryResult.serpapi_calls_used;

    // Default result
    let complexityScore = 5;
    let complexityLevel: 'low' | 'medium' | 'high' = 'medium';
    let complexityFactors: Array<{ factor: string; impact: number; description: string }> = [];
    let stackRecommendations: {
      frontend: string;
      backend: string;
      database: string;
      hosting: string;
      reasoning: string;
    } | null = null;
    let regulatoryChecks: Array<{
      regulation: string;
      applies: boolean;
      description: string;
      severity: 'info' | 'warning' | 'critical';
    }> = [];
    let mvpTimeline: { weeks: number; description: string } | null = null;

    // GPT: Comprehensive technical feasibility analysis
    if (OPENAI_API_KEY) {
      try {
        const techSnippets = techStackResult.data
          .slice(0, 5)
          .map(r => `- ${r.title}: ${r.snippet}`)
          .join('\n');

        const regulatorySnippets = regulatoryResult.data
          .slice(0, 5)
          .map(r => `- ${r.title}: ${r.snippet}`)
          .join('\n');

        const competitorsList = competitors.map(c => c.name).join(', ') || 'unknown';

        const prompt = `Analyze the technical feasibility of building an MVP in the niche: "${searchQuery}" (category: ${category}).

Competitors: ${competitorsList}

Tech stack search results:
${techSnippets || 'No data found'}

Regulatory search results:
${regulatorySnippets || 'No data found'}

Return JSON:
{
  "complexity_score": 5,
  "complexity_level": "medium",
  "complexity_factors": [
    {"factor": "Factor name", "impact": 2, "description": "Why this adds complexity"}
  ],
  "stack": {
    "frontend": "Next.js + Tailwind CSS",
    "backend": "Node.js / Python FastAPI",
    "database": "PostgreSQL / Supabase",
    "hosting": "Vercel / Railway",
    "reasoning": "Why this stack fits"
  },
  "regulatory": [
    {"regulation": "GDPR", "applies": true, "description": "User data handling requires compliance", "severity": "warning"}
  ],
  "mvp_timeline": {"weeks": 6, "description": "Brief timeline breakdown"}
}

Rules:
- complexity_score: 1-10 (1-3=simple landing/form, 4-6=SaaS with APIs, 7-10=ML/real-time/compliance)
- complexity_factors: 3-6 factors with impact 1-3 each
- stack: practical recommendations for a solo dev / small team
- regulatory: check GDPR, HIPAA, PCI DSS, financial regulations, industry-specific licenses
- severity: info=nice to know, warning=should address, critical=must have before launch
- mvp_timeline: realistic weeks for a solo developer`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1200,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            complexityScore = Math.min(10, Math.max(1, parsed.complexity_score || 5));
            complexityLevel = parsed.complexity_level || (complexityScore <= 3 ? 'low' : complexityScore <= 6 ? 'medium' : 'high');

            if (parsed.complexity_factors && Array.isArray(parsed.complexity_factors)) {
              complexityFactors = parsed.complexity_factors.map((f: { factor: string; impact: number; description: string }) => ({
                factor: f.factor,
                impact: Math.min(3, Math.max(1, f.impact || 1)),
                description: f.description || '',
              }));
            }

            if (parsed.stack) {
              stackRecommendations = {
                frontend: parsed.stack.frontend || 'N/A',
                backend: parsed.stack.backend || 'N/A',
                database: parsed.stack.database || 'N/A',
                hosting: parsed.stack.hosting || 'N/A',
                reasoning: parsed.stack.reasoning || '',
              };
            }

            if (parsed.regulatory && Array.isArray(parsed.regulatory)) {
              regulatoryChecks = parsed.regulatory.map((r: { regulation: string; applies: boolean; description: string; severity: string }) => ({
                regulation: r.regulation,
                applies: !!r.applies,
                description: r.description || '',
                severity: (['info', 'warning', 'critical'].includes(r.severity) ? r.severity : 'info') as 'info' | 'warning' | 'critical',
              }));
            }

            if (parsed.mvp_timeline) {
              mvpTimeline = {
                weeks: parsed.mvp_timeline.weeks || 8,
                description: parsed.mvp_timeline.description || '',
              };
            }
          }
        }
      } catch (e) {
        console.error('Tech feasibility GPT error:', e);
      }
    }

    // Verdict
    const verdictValue = Math.max(1, Math.min(10, 10 - complexityScore + 1));
    const criticalRegulations = regulatoryChecks.filter(r => r.applies && r.severity === 'critical').length;
    const verdictConfidence = OPENAI_API_KEY ? 65 : 20;

    const result = {
      complexity: {
        score: complexityScore,
        level: complexityLevel,
        factors: complexityFactors,
      },
      stack_recommendations: stackRecommendations,
      regulatory: {
        checks: regulatoryChecks,
        critical_count: criticalRegulations,
        has_blockers: criticalRegulations > 0,
      },
      mvp_timeline: mvpTimeline,
      verdict: {
        value: verdictValue,
        formula: '10 - complexity_score + 1',
        confidence: verdictConfidence,
      },
      data_metadata: {
        complexity: { data_type: 'ai_synthesis', source: 'GPT-4o-mini analysis' },
        stack: { data_type: 'ai_synthesis', source: 'Google Search + GPT analysis' },
        regulatory: { data_type: 'ai_synthesis', source: 'Google Search + GPT analysis' },
      },
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Tech Feasibility API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
