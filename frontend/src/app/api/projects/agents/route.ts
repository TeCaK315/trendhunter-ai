import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface GenerateAgentsRequest {
  project_name: string;
  trend_title: string;
  trend_category: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: string;
  solution_type?: string;
}

interface ProjectAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  system_prompt: string;
  expertise: string[];
  recommended_tasks: string[];
}

// POST /api/projects/agents - Generate specialized agents for a project
export async function POST(request: NextRequest) {
  try {
    const body: GenerateAgentsRequest = await request.json();

    if (!body.project_name || !body.trend_title || !body.main_pain) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse target audience if it's a string
    let targetAudience = body.target_audience;
    if (typeof targetAudience === 'string') {
      try {
        targetAudience = JSON.parse(targetAudience);
      } catch {
        // Keep as string if parsing fails
      }
    }

    // Generate specialized agent prompts using AI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по созданию AI-агентов для стартапов. Твоя задача - создать 4 специализированных агента для конкретного проекта.

Каждый агент должен быть ЭКСПЕРТОМ, который знает:
- Последние тренды и инструменты 2024-2025
- Лучшие практики в своей области
- Конкретные решения для данного проекта

Верни JSON массив из 4 агентов в формате:
{
  "agents": [
    {
      "id": "developer",
      "name": "Developer",
      "role": "Senior Full-Stack Developer",
      "icon": "👨‍💻",
      "color": "green",
      "system_prompt": "Детальный промпт для агента с учётом специфики проекта...",
      "expertise": ["React", "Next.js", "TypeScript", "..."],
      "recommended_tasks": ["Создать MVP архитектуру", "Настроить базу данных", "..."]
    },
    // ... ещё 3 агента: marketing, sales, designer
  ]
}

ВАЖНО:
- system_prompt должен быть 500+ слов с конкретными инструкциями
- expertise должен содержать 5-8 актуальных технологий/инструментов
- recommended_tasks должен содержать 4-6 конкретных задач для этого проекта`
          },
          {
            role: 'user',
            content: `Создай 4 специализированных агента для проекта:

**Название проекта:** ${body.project_name}
**Тренд:** ${body.trend_title}
**Категория:** ${body.trend_category}
**Главная боль:** ${body.main_pain}
**Ключевые проблемы:** ${body.key_pain_points.join(', ')}
**Целевая аудитория:** ${typeof targetAudience === 'object' ? JSON.stringify(targetAudience) : targetAudience}
**Тип решения:** ${body.solution_type || 'web_app'}

Создай агентов: Developer, Marketing, Sales, Designer - каждый со специфичными знаниями для ЭТОГО проекта.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error');
      return NextResponse.json(
        { success: false, error: 'Failed to generate agents' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let agents: ProjectAgent[] = [];
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"agents"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        agents = parsed.agents || [];
      }
    } catch (parseError) {
      console.error('Failed to parse agents JSON:', parseError);
      // Return default agents if parsing fails
      agents = getDefaultAgents(body);
    }

    return NextResponse.json({
      success: true,
      agents
    });

  } catch (error) {
    console.error('Generate agents error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Default agents if AI generation fails
function getDefaultAgents(body: GenerateAgentsRequest): ProjectAgent[] {
  const projectContext = `для проекта "${body.project_name}" в области "${body.trend_category}", решающего проблему: ${body.main_pain}`;

  return [
    {
      id: 'developer',
      name: 'Developer',
      role: 'Senior Full-Stack Developer',
      icon: '👨‍💻',
      color: 'green',
      system_prompt: `Ты Senior Full-Stack Developer ${projectContext}. Ты эксперт в современных технологиях 2024-2025: Next.js 15, React 19, TypeScript, Tailwind CSS, PostgreSQL, Supabase. Твоя задача - создавать код и архитектуру для MVP.`,
      expertise: ['Next.js 15', 'React 19', 'TypeScript', 'PostgreSQL', 'Supabase', 'Vercel'],
      recommended_tasks: [
        'Создать архитектуру MVP',
        'Настроить базу данных',
        'Реализовать основные API',
        'Написать frontend компоненты'
      ]
    },
    {
      id: 'marketing',
      name: 'Marketing',
      role: 'Chief Marketing Officer',
      icon: '📣',
      color: 'pink',
      system_prompt: `Ты CMO ${projectContext}. Ты эксперт в digital marketing 2024-2025: AI-маркетинг, short-form видео, community-led growth, Product Hunt запуски. Твоя задача - привлечь первых 1000 пользователей.`,
      expertise: ['Growth Hacking', 'Content Marketing', 'SEO 2025', 'Product Hunt', 'Social Media'],
      recommended_tasks: [
        'Создать маркетинг-стратегию',
        'Написать контент-план',
        'Подготовить запуск на Product Hunt',
        'Настроить email-воронку'
      ]
    },
    {
      id: 'sales',
      name: 'Sales',
      role: 'VP of Sales',
      icon: '💰',
      color: 'yellow',
      system_prompt: `Ты VP Sales ${projectContext}. Ты эксперт в продажах 2024-2025: PLG, AI-персонализация, usage-based pricing. Твоя задача - создать модель монетизации и воронку продаж.`,
      expertise: ['Pricing Strategy', 'Sales Funnel', 'B2B Sales', 'SaaS Metrics', 'CRM'],
      recommended_tasks: [
        'Разработать модель ценообразования',
        'Создать sales pitch',
        'Настроить воронку продаж',
        'Определить ICP'
      ]
    },
    {
      id: 'designer',
      name: 'Designer',
      role: 'Lead UX/UI Designer',
      icon: '🎨',
      color: 'purple',
      system_prompt: `Ты Lead Designer ${projectContext}. Ты эксперт в UX/UI 2024-2025: AI-first interfaces, bento grids, micro-interactions, Figma Dev Mode. Твоя задача - создать интуитивный и красивый продукт.`,
      expertise: ['UX Design', 'UI Design', 'Figma', 'Design Systems', 'Motion Design'],
      recommended_tasks: [
        'Создать user flow',
        'Разработать wireframes',
        'Спроектировать UI компоненты',
        'Определить дизайн-систему'
      ]
    }
  ];
}
