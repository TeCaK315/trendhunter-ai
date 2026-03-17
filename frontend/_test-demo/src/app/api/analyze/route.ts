import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUsageLimit, incrementUsage } from '@/lib/usage';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const SYSTEM_PROMPT = `You are an expert analyst. Analyze the given input and provide structured insights.\\n\\nContext: AI analyzes market data and generates strategic insights.\\n\\nGoal: Get instant AI market analysis with actionable insights\\n\\nOutput format: AI-powered market analysis report\\n\\nReturn a JSON object with: { "title": string, "executive_summary": string, "sections": [{ "heading": string, "content": string, "key_points": [string] }], "conclusion": string, "recommendations": [string] }\\n\\nIMPORTANT: Always respond with valid JSON matching the format above.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check usage limits
    const hasCapacity = await checkUsageLimit(user.id, 'analyses');
    if (!hasCapacity) {
      return NextResponse.json(
        { error: 'Usage limit reached. Please upgrade your plan.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const input = body.input || body.q || '';
    
    const missingFields: string[] = [];
    if (!body['query']) missingFields.push('query');
    if (!body['region']) missingFields.push('region');
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }
    
    const contentToAnalyze = input;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze the following input:\n\nquery: ${body['query']}\nregion: ${body['region']}` },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const resultText = completion.choices[0]?.message?.content || '{}';

    let analysis;
    try {
      analysis = JSON.parse(resultText);
    } catch {
      analysis = { summary: resultText };
    }

    // Increment usage
    await incrementUsage(user.id, 'analyses');

    // Store in DB
    await supabase.from('analyses').insert({
      user_id: user.id,
      input: typeof input === 'string' ? input : JSON.stringify(body),
      input_type: 'text',
      result: analysis,
      tokens_used: completion.usage?.total_tokens || 0,
      created_at: new Date().toISOString(),
    });

    // Update profile last analysis timestamp
    await supabase
      .from('profiles')
      .update({ last_analysis_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      analysis,
      output_format: 'report',
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
