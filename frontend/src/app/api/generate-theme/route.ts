import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface ThemeRequest {
  style: string;
  project_name: string;
  target_audience: string;
}

interface GeneratedTheme {
  name: string;
  cssVariables: Record<string, string>;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  tailwindConfig: Record<string, string>;
}

// Предустановленные темы
const presetThemes: Record<string, GeneratedTheme> = {
  'corporate': {
    name: 'Corporate Professional',
    cssVariables: {
      '--color-primary': '#2563eb',
      '--color-secondary': '#1e40af',
      '--color-accent': '#3b82f6',
      '--color-background': '#ffffff',
      '--color-surface': '#f8fafc',
      '--color-text': '#1e293b',
      '--color-text-muted': '#64748b',
    },
    preview: {
      primary: '#2563eb',
      secondary: '#1e40af',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#1e293b',
    },
    tailwindConfig: {
      primary: '#2563eb',
      secondary: '#1e40af',
      accent: '#3b82f6',
    },
  },
  'startup': {
    name: 'Startup Modern',
    cssVariables: {
      '--color-primary': '#8b5cf6',
      '--color-secondary': '#6366f1',
      '--color-accent': '#a855f7',
      '--color-background': '#fafafa',
      '--color-surface': '#ffffff',
      '--color-text': '#18181b',
      '--color-text-muted': '#71717a',
    },
    preview: {
      primary: '#8b5cf6',
      secondary: '#6366f1',
      accent: '#a855f7',
      background: '#fafafa',
      text: '#18181b',
    },
    tailwindConfig: {
      primary: '#8b5cf6',
      secondary: '#6366f1',
      accent: '#a855f7',
    },
  },
  'dark-tech': {
    name: 'Dark Tech',
    cssVariables: {
      '--color-primary': '#10b981',
      '--color-secondary': '#059669',
      '--color-accent': '#34d399',
      '--color-background': '#09090b',
      '--color-surface': '#18181b',
      '--color-text': '#fafafa',
      '--color-text-muted': '#a1a1aa',
    },
    preview: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
      background: '#09090b',
      text: '#fafafa',
    },
    tailwindConfig: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
    },
  },
  'minimal': {
    name: 'Minimal Clean',
    cssVariables: {
      '--color-primary': '#18181b',
      '--color-secondary': '#27272a',
      '--color-accent': '#71717a',
      '--color-background': '#ffffff',
      '--color-surface': '#fafafa',
      '--color-text': '#09090b',
      '--color-text-muted': '#52525b',
    },
    preview: {
      primary: '#18181b',
      secondary: '#27272a',
      accent: '#71717a',
      background: '#ffffff',
      text: '#09090b',
    },
    tailwindConfig: {
      primary: '#18181b',
      secondary: '#27272a',
      accent: '#71717a',
    },
  },
  'warm': {
    name: 'Warm & Friendly',
    cssVariables: {
      '--color-primary': '#f59e0b',
      '--color-secondary': '#d97706',
      '--color-accent': '#fbbf24',
      '--color-background': '#fffbeb',
      '--color-surface': '#fef3c7',
      '--color-text': '#451a03',
      '--color-text-muted': '#92400e',
    },
    preview: {
      primary: '#f59e0b',
      secondary: '#d97706',
      accent: '#fbbf24',
      background: '#fffbeb',
      text: '#451a03',
    },
    tailwindConfig: {
      primary: '#f59e0b',
      secondary: '#d97706',
      accent: '#fbbf24',
    },
  },
  'nature': {
    name: 'Nature Green',
    cssVariables: {
      '--color-primary': '#16a34a',
      '--color-secondary': '#15803d',
      '--color-accent': '#22c55e',
      '--color-background': '#f0fdf4',
      '--color-surface': '#dcfce7',
      '--color-text': '#14532d',
      '--color-text-muted': '#166534',
    },
    preview: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#22c55e',
      background: '#f0fdf4',
      text: '#14532d',
    },
    tailwindConfig: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#22c55e',
    },
  },
};

async function generateCustomTheme(input: ThemeRequest): Promise<GeneratedTheme> {
  const { style, project_name, target_audience } = input;

  // Проверяем, есть ли предустановленная тема
  const lowerStyle = style.toLowerCase();
  if (presetThemes[lowerStyle]) {
    return presetThemes[lowerStyle];
  }

  // Если нет API ключа, возвращаем дефолтную тему
  if (!OPENAI_API_KEY) {
    return presetThemes['startup'];
  }

  const prompt = `Ты эксперт по UI/UX дизайну. Создай цветовую тему для проекта.

ВХОДНЫЕ ДАННЫЕ:
- Название проекта: ${project_name}
- Описание стиля: ${style}
- Целевая аудитория: ${target_audience || 'общая'}

ЗАДАЧА:
Создай гармоничную цветовую схему на основе описания стиля.
Цвета должны быть доступными (WCAG 2.1 AA) и работать вместе.

Верни JSON (ТОЛЬКО JSON, без markdown):
{
  "name": "Название темы",
  "cssVariables": {
    "--color-primary": "#hex",
    "--color-secondary": "#hex",
    "--color-accent": "#hex",
    "--color-background": "#hex",
    "--color-surface": "#hex",
    "--color-text": "#hex",
    "--color-text-muted": "#hex"
  },
  "preview": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "tailwindConfig": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex"
  }
}`;

  try {
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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return presetThemes['startup'];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Theme generation error:', error);
  }

  return presetThemes['startup'];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { style, project_name, target_audience } = body;

    if (!style) {
      return NextResponse.json(
        { success: false, error: 'Style description is required' },
        { status: 400 }
      );
    }

    console.log(`Generating theme for "${project_name}" with style: ${style}`);

    const theme = await generateCustomTheme({
      style,
      project_name: project_name || 'MVP Project',
      target_audience: target_audience || '',
    });

    return NextResponse.json({
      success: true,
      theme,
      presets: Object.keys(presetThemes),
    });
  } catch (error) {
    console.error('Theme API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint для получения списка предустановленных тем
export async function GET() {
  return NextResponse.json({
    success: true,
    presets: Object.entries(presetThemes).map(([key, theme]) => ({
      id: key,
      name: theme.name,
      preview: theme.preview,
    })),
  });
}
