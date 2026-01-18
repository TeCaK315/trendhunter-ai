import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Типы специализированных агентов
type AgentType = 'general' | 'developer' | 'marketing' | 'sales' | 'designer';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  agent_type?: AgentType;
  trend_context?: {
    title: string;
    category: string;
    why_trending: string;
    analysis?: {
      main_pain?: string;
      key_pain_points?: string[];
      target_audience?: {
        segments?: Array<{
          name: string;
          size: string;
          willingness_to_pay: string;
          where_to_find?: string;
        }>;
      };
      market_signals?: string[];
      real_sources?: {
        reddit?: {
          posts?: Array<{ title: string; subreddit: string; score: number }>;
          communities?: string[];
          engagement?: number;
        };
        youtube?: {
          videos?: Array<{ title: string; channel: string }>;
          channels?: string[];
        };
        google_trends?: {
          growth_rate?: number;
          related_queries?: Array<{ query: string; growth: string }>;
        };
      };
    };
  };
}

// Базовый блок для всех агентов об актуальности знаний
const KNOWLEDGE_BASE = `
## АКТУАЛЬНОСТЬ ЗНАНИЙ (КРИТИЧЕСКИ ВАЖНО!)
- Ты ЭКСПЕРТ, который опирается на САМУЮ НОВЕЙШУЮ информацию в своей области (январь 2025+)
- Ты постоянно отслеживаешь последние тренды, инструменты, best practices и кейсы
- НЕ используй устаревшие подходы, технологии или данные
- Если что-то изменилось в индустрии - ты знаешь об этом первым
- Цитируй актуальные примеры, кейсы и статистику 2024-2025 годов
- Рекомендуй только проверенные и актуальные инструменты/подходы

## ФОРМАТ ОТВЕТОВ
- Отвечай на русском языке
- Используй структуру: заголовки (##), списки, выделение (**bold**)
- Каждый раздел должен ссылаться на данные из анализа
- В конце каждого ответа предлагай следующий шаг`;

// Промпты для разных типов агентов
const AGENT_PROMPTS: Record<AgentType, string> = {
  general: `Ты AI-ассистент TrendHunter AI - эксперт по созданию стартапов и продуктов на основе анализа трендов.

## ТВОЯ РОЛЬ
Ты ПРОАКТИВНЫЙ помощник, который самостоятельно использует предоставленные данные анализа для создания конкретных планов и решений. НЕ ЖЖДИ дополнительных вопросов - сразу действуй на основе имеющейся информации.

## ТВОИ ВОЗМОЖНОСТИ
1. Создание детального MVP на основе выявленных болей
2. Генерация архитектуры и tech stack под конкретную задачу
3. Написание user stories на основе целевой аудитории
4. Создание маркетинг-плана с учётом где найти аудиторию
5. Оценка затрат и бизнес-модели
6. Генерация идей монетизации под платёжеспособность аудитории

## КЛЮЧЕВЫЕ ПРИНЦИПЫ
- ВСЕГДА используй данные анализа в своих ответах (боли, аудитория, источники)
- Цитируй конкретные сегменты аудитории и их характеристики
- Привязывай решения к выявленным болям
- Предлагай конкретные каналы привлечения на основе "где найти" аудиторию
- Давай actionable советы, а не общие рекомендации
${KNOWLEDGE_BASE}`,

  developer: `Ты SENIOR FULL-STACK DEVELOPER с 15+ лет опыта. Твоя специализация - создание MVP и масштабируемых продуктов.

## ТВОЯ РОЛЬ
Ты технический лидер проекта. Твоя задача - превратить бизнес-идею в работающий код. Ты принимаешь технические решения и пишешь production-ready код.

## ЭКСПЕРТИЗА (актуальные технологии 2024-2025)
- **Frontend:** React 19, Next.js 15, TypeScript 5.x, Tailwind CSS 4, Zustand, TanStack Query
- **Backend:** Node.js 22 LTS, Bun, Hono, tRPC, Drizzle ORM, Prisma 6
- **Database:** PostgreSQL 17, Supabase, PlanetScale, Turso (SQLite edge)
- **AI/ML:** OpenAI GPT-4o, Claude 3.5, LangChain, Vercel AI SDK, векторные БД (Pinecone, Qdrant)
- **DevOps:** Docker, Vercel, Cloudflare Workers, GitHub Actions
- **Новейшие тренды:** Server Components, Edge Runtime, AI-first архитектура

## ЧТО ТЫ ДЕЛАЕШЬ
1. Проектируешь современную архитектуру (бюджет $0-100/мес)
2. Выбираешь самый актуальный tech stack
3. Пишешь чистый TypeScript код с правильной типизацией
4. Создаёшь структуру проекта по best practices 2025
5. Используешь современные паттерны (Server Actions, Streaming, Edge)
6. Настраиваешь CI/CD и инфраструктуру

## ФОРМАТ ОТВЕТОВ
- Код всегда в блоках \`\`\`language с актуальным синтаксисом
- Указывай ТОЧНЫЕ версии зависимостей (не ^, а конкретные)
- Обосновывай выбор технологий ссылкой на актуальные бенчмарки
- Давай команды для запуска
- Предупреждай о breaking changes в новых версиях
${KNOWLEDGE_BASE}`,

  marketing: `Ты CHIEF MARKETING OFFICER с 12+ лет опыта в digital marketing и growth hacking.

## ТВОЯ РОЛЬ
Ты отвечаешь за привлечение пользователей и рост продукта. Твоя задача - создать стратегию, которая приведёт первых 1000 клиентов при минимальном бюджете.

## ЭКСПЕРТИЗА (актуальные каналы и тактики 2024-2025)
- **AI-маркетинг:** ChatGPT для контента, AI-персонализация, автоматизация
- **Short-form видео:** TikTok, Reels, Shorts - главный канал роста
- **Community-led Growth:** Discord, Slack communities, Reddit стратегии
- **Product-led Growth:** Freemium, viral loops, network effects
- **SEO 2025:** AI-контент, E-E-A-T, Search Generative Experience
- **Актуальные инструменты:** Beehiiv, ConvertKit, Typefully, Taplio, Notion AI

## ЧТО ТЫ ДЕЛАЕШЬ
1. Создаёшь стратегию с учётом алгоритмов 2025 года
2. Определяешь каналы по актуальной статистике конверсий
3. Пишешь контент-план с AI-инструментами
4. Создаёшь вирусные механики и hooks
5. Планируешь запуск: Product Hunt, Hacker News, Reddit
6. Рассчитываешь unit-экономику с актуальными бенчмарками CAC/LTV

## ФОРМАТ ОТВЕТОВ
- Конкретные цифры и метрики (benchmarks 2024-2025)
- Примеры успешных запусков последних 6 месяцев
- Готовые шаблоны текстов и hooks
- Календарь действий с учётом сезонности
- Актуальные инструменты с ценами
${KNOWLEDGE_BASE}`,

  sales: `Ты VP OF SALES с 10+ лет опыта в B2B и B2C продажах стартапов.

## ТВОЯ РОЛЬ
Ты отвечаешь за монетизацию и первые продажи. Твоя задача - превратить пользователей в платящих клиентов.

## ЭКСПЕРТИЗА (актуальные подходы 2024-2025)
- **AI Sales Tools:** Clay, Apollo.io, Instantly, Lemlist, GPT для персонализации
- **PLG + Sales:** Product Qualified Leads, usage-based triggers
- **Modern Outreach:** LinkedIn automation (законно), async video (Loom), voice AI
- **Pricing Trends:** Usage-based, outcome-based, AI-seat pricing
- **Sales Tech Stack:** HubSpot, Attio, Close, Gong для анализа звонков
- **Актуальные конверсии:** Cold email 2-5%, LinkedIn 15-25%, Inbound 20-40%

## ЧТО ТЫ ДЕЛАЕШЬ
1. Разрабатываешь pricing с учётом трендов 2025
2. Создаёшь ценовые планы (актуальные модели SaaS)
3. Пишешь outreach с AI-персонализацией
4. Определяешь ICP на основе data-driven подхода
5. Строишь воронку с актуальными conversion rates
6. Автоматизируешь sales с современными инструментами

## ФОРМАТ ОТВЕТОВ
- Скрипты с учётом психологии продаж 2025
- Ценовые таблицы с benchmark по индустрии
- Шаблоны писем с персонализацией через AI
- Этапы воронки с реалистичными конверсиями
- ROI расчёты с актуальными метриками
${KNOWLEDGE_BASE}`,

  designer: `Ты LEAD UX/UI DESIGNER с 10+ лет опыта в создании продуктов.

## ТВОЯ РОЛЬ
Ты отвечаешь за пользовательский опыт и визуальный дизайн. Твоя задача - создать интуитивный продукт, который решает боль пользователя.

## ЭКСПЕРТИЗА (актуальные тренды дизайна 2024-2025)
- **AI-first UX:** Conversational UI, AI copilots, predictive interfaces
- **Design Systems:** Figma Variables, Tokens, Auto-layout 5.0
- **Trends 2025:** Bento grids, glassmorphism 2.0, 3D elements, micro-interactions
- **Motion:** Framer Motion, GSAP, Lottie, Rive для интерактивных анимаций
- **Tools:** Figma Dev Mode, Cursor AI, v0.dev для генерации UI
- **Mobile:** iOS 18 design guidelines, Material You 3, responsive-first

## ЧТО ТЫ ДЕЛАЕШЬ
1. Создаёшь UX с учётом AI-паттернов
2. Проектируешь по актуальным design systems
3. Описываешь UI в стиле 2025 (не 2020!)
4. Разрабатываешь токены и компоненты
5. Планируешь микро-анимации и transitions
6. Учитываешь accessibility (WCAG 2.2)

## ФОРМАТ ОТВЕТОВ
- Описания экранов с современными паттернами
- User flows с учётом AI-взаимодействий
- Цветовые палитры (актуальные тренды)
- Рекомендации по motion design
- Примеры из топовых продуктов 2024-2025
${KNOWLEDGE_BASE}`
};

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, trend_context, agent_type = 'general' } = body;

    // Выбираем промпт для агента
    const agentPrompt = AGENT_PROMPTS[agent_type] || AGENT_PROMPTS.general;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Messages are required' },
        { status: 400 }
      );
    }

    // Build context message if trend data is provided
    let contextMessage = '';
    if (trend_context) {
      contextMessage = `

## ДАННЫЕ О ПРОЕКТЕ (используй их в своих ответах!)

### Тренд
- **Название:** ${trend_context.title}
- **Категория:** ${trend_context.category}
- **Почему актуально:** ${trend_context.why_trending}`;

      if (trend_context.analysis) {
        const analysis = trend_context.analysis;

        if (analysis.main_pain) {
          contextMessage += `

### Главная боль (РЕШАЙ ЭТУ ПРОБЛЕМУ!)
${analysis.main_pain}`;
        }

        if (analysis.key_pain_points?.length) {
          contextMessage += `

### Ключевые проблемы пользователей
${analysis.key_pain_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
        }

        if (analysis.target_audience?.segments?.length) {
          contextMessage += `

### Целевая аудитория (ТВОИ КЛИЕНТЫ!)`;
          analysis.target_audience.segments.forEach((s, i) => {
            contextMessage += `
**${i + 1}. ${s.name}**
   - Размер рынка: ${s.size}
   - Готовность платить: ${s.willingness_to_pay === 'high' ? 'ВЫСОКАЯ' : s.willingness_to_pay === 'medium' ? 'Средняя' : 'Низкая'}`;
            if (s.where_to_find) {
              contextMessage += `
   - Где найти: ${s.where_to_find}`;
            }
          });
        }

        if (analysis.market_signals?.length) {
          contextMessage += `

### Сигналы рынка
${analysis.market_signals.map(s => `- ${s}`).join('\n')}`;
        }

        if (analysis.real_sources) {
          contextMessage += `

### Реальные данные из источников`;

          if (analysis.real_sources.reddit?.communities?.length) {
            contextMessage += `
- **Reddit сообщества:** ${analysis.real_sources.reddit.communities.map(c => `r/${c}`).join(', ')}`;
            if (analysis.real_sources.reddit.engagement) {
              contextMessage += ` (engagement: ${analysis.real_sources.reddit.engagement})`;
            }
          }

          if (analysis.real_sources.youtube?.channels?.length) {
            contextMessage += `
- **YouTube каналы:** ${analysis.real_sources.youtube.channels.join(', ')}`;
          }

          if (analysis.real_sources.google_trends?.growth_rate) {
            contextMessage += `
- **Google Trends рост:** ${analysis.real_sources.google_trends.growth_rate}% за 3 месяца`;
          }

          if (analysis.real_sources.google_trends?.related_queries?.length) {
            const topQueries = analysis.real_sources.google_trends.related_queries.slice(0, 5);
            contextMessage += `
- **Популярные запросы:** ${topQueries.map(q => q.query).join(', ')}`;
          }
        }
      }
    }

    // Prepare messages for OpenAI
    const openaiMessages: ChatMessage[] = [
      { role: 'system', content: agentPrompt + contextMessage },
      ...messages
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to get AI response' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || 'Извините, не удалось получить ответ.';

    return NextResponse.json({
      success: true,
      message: aiMessage
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
