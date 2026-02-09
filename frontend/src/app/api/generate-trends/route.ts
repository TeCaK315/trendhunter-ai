import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Маппинг категорий UI → категории scan-trends
const CATEGORY_MAP: Record<string, string[]> = {
  'Technology': ['Technology'],
  'SaaS': ['SaaS'],
  'E-commerce': ['E-commerce'],
  'Mobile Apps': ['Technology'],
  'EdTech': ['EdTech'],
  'HealthTech': ['HealthTech'],
  'AI/ML': ['AI & ML'],
  'AI & ML': ['AI & ML'],
  'FinTech': ['FinTech'],
  'Business': ['SaaS', 'Technology'],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const category = body.category || 'random';

    // Определяем категории для сканирования
    const scanCategories = category === 'random'
      ? undefined // scan-trends will use all categories
      : CATEGORY_MAP[category] || [category];

    // Variant A: используем scan-trends (Google Trends Rising Queries)
    try {
      const baseUrl = request.nextUrl.origin;
      const scanResponse = await fetch(`${baseUrl}/api/scan-trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: scanCategories,
          maxNichesPerCategory: category === 'random' ? 3 : 5,
          maxEnrich: 20,
        }),
      });

      if (scanResponse.ok) {
        const result = await scanResponse.json();
        if (result.success && result.newTrendsCount > 0) {
          return NextResponse.json({
            success: true,
            data: {
              message: `Обнаружено ${result.newTrendsCount} новых трендов из Google Trends`,
              newTrends: result.newTrendsCount,
              totalScanned: result.totalScanned,
              serpApiCalls: result.serpApiCallsUsed,
              duration: `${(result.scanDurationMs / 1000).toFixed(1)}s`,
              source: 'google_trends_rising_queries',
            },
          });
        }
      }
    } catch (error) {
      console.error('scan-trends error:', error);
    }

    // Fallback: n8n webhook (если настроен)
    if (N8N_WEBHOOK_URL) {
      try {
        const response = await fetch(`${N8N_WEBHOOK_URL}/generate-trends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({ success: true, data });
        }
      } catch (error) {
        console.error('n8n webhook error:', error);
      }
    }

    // Если ничего не найдено
    return NextResponse.json({
      success: false,
      error: 'Не найдено новых растущих трендов. Попробуйте позже или выберите другую категорию.',
      hint: 'Сканирование Google Trends ищет реально растущие поисковые запросы. Результаты обновляются ежедневно.',
    }, { status: 404 });
  } catch (error) {
    console.error('generate-trends error:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка при генерации трендов',
    }, { status: 500 });
  }
}
