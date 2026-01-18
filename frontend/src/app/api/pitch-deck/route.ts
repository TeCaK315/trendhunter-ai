import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface Slide {
  number: number;
  title: string;
  type: 'title' | 'problem' | 'solution' | 'market' | 'product' | 'business-model' | 'traction' | 'competition' | 'team' | 'financials' | 'ask';
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
}

interface PitchDeck {
  title: string;
  tagline: string;
  slides: Slide[];
  sources: Array<{ name: string; url: string }>;
  generated_at: string;
  export_formats: {
    google_slides_template: string;
    figma_template: string;
    canva_template: string;
  };
}

interface TrendData {
  title: string;
  category?: string;
  why_trending?: string;
  key_pain_points?: string[];
  target_audience?: string;
  opportunities?: string[];
  competitors?: Array<{ name: string; description?: string }>;
  market_size?: string;
}

// Get current date info for realistic timelines
function getCurrentDateInfo(): { year: number; quarter: string; nextQuarter: string; yearPlusOne: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const nextQuarterIndex = quarter % 4;

  return {
    year,
    quarter: `Q${quarter}`,
    nextQuarter: quarters[nextQuarterIndex],
    yearPlusOne: year + 1,
  };
}

// Generate pitch deck using AI
async function generatePitchDeck(trendData: TrendData): Promise<Slide[]> {
  if (!OPENAI_API_KEY) {
    return getTemplateDeck(trendData);
  }

  const dateInfo = getCurrentDateInfo();

  try {
    const prompt = `Create a 10-slide investor pitch deck for a startup based on this trend:

Trend: ${trendData.title}
Category: ${trendData.category || 'Technology'}
Why Trending: ${trendData.why_trending || 'Growing market demand'}
Pain Points: ${(trendData.key_pain_points || ['User frustration', 'Lack of solutions']).join(', ')}
Target Audience: ${trendData.target_audience || 'Tech-savvy professionals'}
Market Opportunity: ${(trendData.opportunities || ['Large addressable market']).join(', ')}
Competitors: ${(trendData.competitors || []).map(c => c.name).join(', ') || 'Few direct competitors'}

IMPORTANT DATE CONTEXT:
- Current date: ${dateInfo.quarter} ${dateInfo.year}
- Use ONLY future dates for milestones (${dateInfo.nextQuarter} ${dateInfo.year} and beyond)
- Never mention 2024 or any past dates
- Example milestones: "MVP launch ${dateInfo.nextQuarter} ${dateInfo.year}", "Series A target Q2 ${dateInfo.yearPlusOne}"

Generate exactly 10 slides in JSON format:
[
  {
    "number": 1,
    "title": "Slide Title",
    "type": "title|problem|solution|market|product|business-model|traction|competition|team|ask",
    "content": ["Bullet 1", "Bullet 2", "Bullet 3"],
    "speaker_notes": "What to say during this slide",
    "visual_suggestion": "What visual/chart to include"
  }
]

Follow this structure:
1. Title slide - Company name, tagline, contact
2. Problem - The pain point you're solving
3. Solution - Your unique approach
4. Market Size - TAM, SAM, SOM with numbers
5. Product - Key features and demo
6. Business Model - How you make money
7. Traction - Metrics, users, revenue (or planned milestones with FUTURE dates)
8. Competition - Your positioning vs others
9. Team - Why you're the right team
10. The Ask - How much you're raising, use of funds, runway to next milestone

Make it compelling for investors. Use specific numbers where possible. ALL dates must be ${dateInfo.year} or later.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      return getTemplateDeck(trendData);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const slides = JSON.parse(jsonMatch[0]);
      return slides.map((slide: Slide, index: number) => ({
        ...slide,
        number: index + 1,
      }));
    }
  } catch (error) {
    console.error('AI pitch deck generation error:', error);
  }

  return getTemplateDeck(trendData);
}

// Get template deck when AI is not available
function getTemplateDeck(trendData: TrendData): Slide[] {
  const companyName = generateCompanyName(trendData.title);
  const dateInfo = getCurrentDateInfo();

  return [
    {
      number: 1,
      title: companyName,
      type: 'title',
      content: [
        `Solving ${trendData.title.toLowerCase()} for ${trendData.target_audience || 'modern businesses'}`,
        'Seed Round - $1.5M',
        'contact@startup.com',
      ],
      speaker_notes: 'Introduce yourself and the company. Set the stage for the problem.',
      visual_suggestion: 'Company logo centered, gradient background',
    },
    {
      number: 2,
      title: 'The Problem',
      type: 'problem',
      content: trendData.key_pain_points || [
        'Current solutions are fragmented and inefficient',
        'Users waste 10+ hours per week on manual tasks',
        'Existing tools cost $500+/month with poor UX',
      ],
      speaker_notes: 'Make the audience feel the pain. Use specific examples and statistics.',
      visual_suggestion: 'Frustrated user illustration or before/after comparison',
    },
    {
      number: 3,
      title: 'Our Solution',
      type: 'solution',
      content: [
        `AI-powered ${trendData.title.toLowerCase()} platform`,
        '10x faster than existing solutions',
        'Simple, intuitive interface anyone can use',
      ],
      speaker_notes: 'Show the magic moment. Demo if possible.',
      visual_suggestion: 'Product screenshot or demo GIF',
    },
    {
      number: 4,
      title: 'Market Opportunity',
      type: 'market',
      content: [
        'TAM: $50B global market',
        'SAM: $5B in target segment',
        'SOM: $500M achievable in 5 years',
        `Growing ${trendData.why_trending || '30%+ YoY'}`,
      ],
      speaker_notes: 'Explain your market sizing methodology. Bottom-up is more credible.',
      visual_suggestion: 'TAM/SAM/SOM concentric circles chart',
    },
    {
      number: 5,
      title: 'Product',
      type: 'product',
      content: [
        'Core Feature 1: Automated workflows',
        'Core Feature 2: AI-powered insights',
        'Core Feature 3: Seamless integrations',
        `Mobile app launching ${dateInfo.nextQuarter} ${dateInfo.year}`,
      ],
      speaker_notes: 'Walk through the product. Focus on unique differentiators.',
      visual_suggestion: 'Product screenshots, feature highlights',
    },
    {
      number: 6,
      title: 'Business Model',
      type: 'business-model',
      content: [
        'SaaS subscription: $49-199/month',
        'Enterprise: Custom pricing from $1000/month',
        'Average contract value: $2,400/year',
        'Net revenue retention: 120%+',
      ],
      speaker_notes: 'Explain pricing tiers and upsell path.',
      visual_suggestion: 'Pricing table or revenue model diagram',
    },
    {
      number: 7,
      title: 'Traction',
      type: 'traction',
      content: [
        '1,000+ beta users',
        '$50K MRR (growing 20% MoM)',
        '4.8/5 average rating',
        `Target: 10K users by Q3 ${dateInfo.year}`,
      ],
      speaker_notes: 'Show momentum. More is always better here.',
      visual_suggestion: 'Growth chart, customer logos',
    },
    {
      number: 8,
      title: 'Competition',
      type: 'competition',
      content: [
        `vs ${(trendData.competitors?.[0]?.name) || 'Competitor A'}: We're 5x faster`,
        `vs ${(trendData.competitors?.[1]?.name) || 'Competitor B'}: We're 3x cheaper`,
        'Our unfair advantage: Proprietary AI model',
        'Built by domain experts with 10+ years experience',
      ],
      speaker_notes: 'Acknowledge competition but show clear differentiation.',
      visual_suggestion: '2x2 competitive matrix or comparison table',
    },
    {
      number: 9,
      title: 'Team',
      type: 'team',
      content: [
        'CEO: 10+ years in industry, ex-Google',
        'CTO: AI/ML expert, PhD Stanford',
        'Advisors: Industry veterans from [Top Company]',
        'Team of 5 engineers, 2 designers',
      ],
      speaker_notes: 'Highlight relevant experience and why you can execute.',
      visual_suggestion: 'Team photos with credentials',
    },
    {
      number: 10,
      title: 'The Ask',
      type: 'ask',
      content: [
        'Raising: $1.5M Seed Round',
        '40% - Product development',
        '35% - Sales & Marketing',
        '25% - Operations',
        `18-month runway to Series A (Q2 ${dateInfo.yearPlusOne})`,
      ],
      speaker_notes: 'Be specific about use of funds. Show path to next milestone.',
      visual_suggestion: 'Pie chart of fund allocation, milestone timeline',
    },
  ];
}

function generateCompanyName(trend: string): string {
  // Generate a startup-like name from the trend
  const suffixes = ['AI', 'Labs', 'HQ', 'Hub', 'io', 'ly', 'ify'];
  const words = trend.split(' ').slice(0, 2);
  const baseName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${baseName}${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trend, trend_data } = body;

    if (!trend && !trend_data) {
      return NextResponse.json(
        { success: false, error: 'Trend or trend_data is required' },
        { status: 400 }
      );
    }

    // Build trend data object
    const trendData: TrendData = trend_data || {
      title: trend,
      category: 'Technology',
    };

    // Generate the pitch deck
    const slides = await generatePitchDeck(trendData);

    const companyName = slides[0]?.title || generateCompanyName(trendData.title);
    const tagline = slides[0]?.content?.[0] || `The future of ${trendData.title.toLowerCase()}`;

    const result: PitchDeck = {
      title: companyName,
      tagline,
      slides,
      sources: [
        {
          name: 'Pitch Deck Template Best Practices',
          url: 'https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck',
        },
        {
          name: 'Sequoia Pitch Deck Guide',
          url: 'https://www.sequoiacap.com/article/writing-a-business-plan/',
        },
        {
          name: 'Pitch Deck Examples',
          url: 'https://www.cbinsights.com/research/billion-dollar-startup-pitch-decks/',
        },
      ],
      generated_at: new Date().toISOString(),
      export_formats: {
        google_slides_template: 'https://slidesgo.com/theme/formal-pitch-deck',
        figma_template: 'https://www.figma.com/community/search?resource_type=mixed&sort_by=relevancy&query=pitch+deck',
        canva_template: 'https://www.canva.com/presentations/templates/pitch-deck/',
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Pitch deck API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trend = searchParams.get('trend');

  if (!trend) {
    return NextResponse.json(
      { success: false, error: 'Trend parameter is required' },
      { status: 400 }
    );
  }

  // Redirect to POST handler
  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trend }),
  });

  return POST(postRequest as NextRequest);
}
