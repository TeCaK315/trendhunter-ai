import { NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function POST() {
  // Если есть n8n webhook, используем его
  if (N8N_WEBHOOK_URL) {
    try {
      const response = await fetch(`${N8N_WEBHOOK_URL}/generate-trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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
