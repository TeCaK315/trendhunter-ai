import { NextRequest, NextResponse } from 'next/server';
import { researchNiche, isAIConfigured } from '@/lib/ai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';

interface NicheResearchRequest {
  niche: string;
  description: string;
  targetAudience?: string;
  existingProblems?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`analysis:${clientIP}`, RATE_LIMITS.analysis);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: NicheResearchRequest = await request.json();

    if (!body.niche || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Ниша и описание обязательны' },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { success: false, error: 'API ключ не настроен. Добавьте OPENAI_API_KEY в Environment Variables.' },
        { status: 500 }
      );
    }

    const result = await researchNiche(
      body.niche,
      body.description,
      body.targetAudience,
      body.existingProblems
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Ошибка AI анализа' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: result.data,
      niche: body.niche,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Niche research error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
