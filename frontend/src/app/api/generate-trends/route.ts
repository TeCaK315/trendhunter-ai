import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Маппинг категорий на ниши для генерации
const categoryNiches: Record<string, string[]> = {
  'Technology': [
    'AI automation tools', 'no code app builder', 'workflow automation',
    'project management software', 'developer tools', 'API integration platform'
  ],
  'SaaS': [
    'CRM software', 'invoice automation', 'HR software', 'sales automation',
    'marketing automation', 'email automation', 'subscription management'
  ],
  'E-commerce': [
    'dropshipping automation', 'inventory management', 'product recommendation engine',
    'price tracking', 'ecommerce analytics', 'cart abandonment solution'
  ],
  'Mobile Apps': [
    'mobile app builder', 'app monetization', 'push notification service',
    'mobile analytics', 'app store optimization', 'cross-platform development'
  ],
  'EdTech': [
    'online learning platform', 'AI tutoring', 'language learning app',
    'skill assessment tool', 'course creation tool', 'student engagement platform'
  ],
  'HealthTech': [
    'mental health app', 'fitness tracking app', 'telemedicine platform',
    'health monitoring', 'medical scheduling', 'patient engagement'
  ],
  'AI/ML': [
    'AI chatbot platform', 'AI writing assistant', 'AI image generator',
    'AI voice assistant', 'AI code assistant', 'AI customer service', 'AI data analysis'
  ],
  'FinTech': [
    'cryptocurrency trading bot', 'personal finance app', 'investment platform',
    'payment processing', 'expense tracking', 'financial planning tool'
  ]
};

export async function POST(request: NextRequest) {
  // Если есть n8n webhook, используем его
  if (N8N_WEBHOOK_URL) {
    try {
      const body = await request.json().catch(() => ({}));
      const category = body.category || 'random';

      // Выбираем ниши в зависимости от категории
      let selectedNiches: string[];

      if (category === 'random' || !categoryNiches[category]) {
        // Случайная категория - берём по 1 нише из каждой категории
        const allCategories = Object.keys(categoryNiches);
        selectedNiches = allCategories.map(cat => {
          const niches = categoryNiches[cat];
          return niches[Math.floor(Math.random() * niches.length)];
        }).slice(0, 5);
      } else {
        // Конкретная категория - берём 5 случайных ниш из неё
        const niches = [...categoryNiches[category]];
        selectedNiches = niches.sort(() => Math.random() - 0.5).slice(0, 5);
      }

      const response = await fetch(`${N8N_WEBHOOK_URL}/generate-trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          niches: selectedNiches
        })
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ success: true, data });
      }
    } catch (error) {
      console.error('n8n webhook error:', error);
    }
  }

  // Без n8n webhook функция недоступна
  return NextResponse.json({
    success: false,
    error: 'Генерация трендов недоступна. Настройте N8N_WEBHOOK_URL в .env.local для автоматической генерации идей.',
    hint: 'Используйте раздел "Исследование ниш" для ручного анализа интересующих вас тем.'
  }, { status: 503 });
}
