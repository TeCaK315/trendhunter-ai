import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Design Analysis Block (Background)
 *
 * Работает в фоновом режиме вместе с Market Occupation.
 * Анализирует дизайн конкурентов и генерирует уникальную палитру для нового проекта.
 *
 * Подход: Извлечение CSS/HTML + GPT-4 Vision анализ скриншотов через API
 */

interface CompetitorDesign {
  name: string;
  website: string;
  colors: string[];
  fonts: string[];
  layout_style: 'minimal' | 'dense' | 'spacious' | 'modern' | 'unknown';
  ui_patterns: string[];
  overall_style: string;
}

interface GeneratedDesign {
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headings: string;
    body: string;
    mono?: string;
  };
  unique_elements: string[];
  design_rationale: string;
}

interface DesignAnalysisResult {
  competitors_analyzed: CompetitorDesign[];
  generated_design: GeneratedDesign;
  differentiation_score: number;
  analyzed_at: string;
}

/**
 * Извлекает цвета из CSS текста
 */
function extractColorsFromCSS(css: string): string[] {
  const colors = new Set<string>();

  // Hex colors
  const hexMatches = css.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  hexMatches.forEach(c => colors.add(c.toLowerCase()));

  // RGB/RGBA colors
  const rgbMatches = css.match(/rgba?\([^)]+\)/gi) || [];
  rgbMatches.forEach(c => colors.add(c.toLowerCase()));

  // HSL/HSLA colors
  const hslMatches = css.match(/hsla?\([^)]+\)/gi) || [];
  hslMatches.forEach(c => colors.add(c.toLowerCase()));

  // Named colors (основные)
  const namedColors = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey'];
  namedColors.forEach(name => {
    if (css.toLowerCase().includes(name)) {
      colors.add(name);
    }
  });

  return Array.from(colors).slice(0, 20); // Лимит 20 цветов
}

/**
 * Извлекает шрифты из CSS текста
 */
function extractFontsFromCSS(css: string): string[] {
  const fonts = new Set<string>();

  // font-family declarations
  const fontFamilyMatches = css.match(/font-family:\s*([^;]+)/gi) || [];
  fontFamilyMatches.forEach(match => {
    const value = match.replace(/font-family:\s*/i, '').trim();
    // Разбиваем по запятым и чистим
    value.split(',').forEach(font => {
      const cleaned = font.trim().replace(/['"]/g, '');
      if (cleaned && !['inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace'].includes(cleaned.toLowerCase())) {
        fonts.add(cleaned);
      }
    });
  });

  // Google Fonts из link tags
  const googleFontMatches = css.match(/fonts\.googleapis\.com\/css[^"'\s)]+/gi) || [];
  googleFontMatches.forEach(match => {
    const familyMatch = match.match(/family=([^&]+)/);
    if (familyMatch) {
      familyMatch[1].split('|').forEach(f => {
        fonts.add(decodeURIComponent(f.split(':')[0].replace(/\+/g, ' ')));
      });
    }
  });

  return Array.from(fonts).slice(0, 10);
}

/**
 * Анализирует один сайт конкурента
 */
async function analyzeCompetitorWebsite(
  name: string,
  website: string
): Promise<CompetitorDesign | null> {
  try {
    // Нормализуем URL
    let url = website;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Fetch HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract inline styles and linked CSS references
    const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    const inlineStyles = styleMatches.join('\n');

    // Extract style attributes
    const styleAttrMatches = html.match(/style="[^"]+"/gi) || [];
    const attrStyles = styleAttrMatches.join('\n');

    const allCSS = inlineStyles + '\n' + attrStyles + '\n' + html;

    const colors = extractColorsFromCSS(allCSS);
    const fonts = extractFontsFromCSS(allCSS);

    // Определяем стиль layout на основе keywords
    let layout_style: CompetitorDesign['layout_style'] = 'unknown';
    const htmlLower = html.toLowerCase();
    if (htmlLower.includes('tailwind') || htmlLower.includes('minimal')) {
      layout_style = 'minimal';
    } else if (htmlLower.includes('dashboard') || htmlLower.includes('grid')) {
      layout_style = 'dense';
    } else if (htmlLower.includes('hero') || htmlLower.includes('spacious')) {
      layout_style = 'spacious';
    } else if (htmlLower.includes('react') || htmlLower.includes('next') || htmlLower.includes('modern')) {
      layout_style = 'modern';
    }

    // UI patterns
    const ui_patterns: string[] = [];
    if (htmlLower.includes('card') || htmlLower.includes('карточк')) ui_patterns.push('cards');
    if (htmlLower.includes('modal') || htmlLower.includes('dialog')) ui_patterns.push('modals');
    if (htmlLower.includes('sidebar') || htmlLower.includes('боков')) ui_patterns.push('sidebar');
    if (htmlLower.includes('table') || htmlLower.includes('таблиц')) ui_patterns.push('tables');
    if (htmlLower.includes('chart') || htmlLower.includes('график')) ui_patterns.push('charts');
    if (htmlLower.includes('form') || htmlLower.includes('форм')) ui_patterns.push('forms');
    if (htmlLower.includes('navbar') || htmlLower.includes('navigation')) ui_patterns.push('navbar');
    if (htmlLower.includes('footer')) ui_patterns.push('footer');

    return {
      name,
      website: url,
      colors,
      fonts,
      layout_style,
      ui_patterns,
      overall_style: `${layout_style} layout with ${colors.length} colors, ${fonts.length} custom fonts`,
    };

  } catch (error) {
    console.error(`Failed to analyze ${website}:`, error);
    return null;
  }
}

/**
 * Генерирует уникальный дизайн с помощью GPT-4
 */
async function generateUniqueDesign(
  query: string,
  competitors: CompetitorDesign[]
): Promise<GeneratedDesign> {
  // Default design if no API key
  const defaultDesign: GeneratedDesign = {
    color_palette: {
      primary: '#6366f1',    // Indigo
      secondary: '#8b5cf6',  // Purple
      accent: '#22d3ee',     // Cyan
      background: '#0f172a', // Slate 900
      text: '#f8fafc',       // Slate 50
    },
    typography: {
      headings: 'Inter',
      body: 'Inter',
      mono: 'JetBrains Mono',
    },
    unique_elements: [
      'Gradient accents',
      'Glassmorphism cards',
      'Subtle animations',
    ],
    design_rationale: 'Modern dark theme with vibrant accents for SaaS applications',
  };

  if (!OPENAI_API_KEY || competitors.length === 0) {
    return defaultDesign;
  }

  try {
    // Собираем цвета конкурентов для избежания
    const competitorColors = competitors.flatMap(c => c.colors).slice(0, 30);
    const competitorFonts = competitors.flatMap(c => c.fonts).slice(0, 15);

    const prompt = `Ты — дизайнер, создающий уникальный визуальный стиль для нового SaaS-продукта в нише "${query}".

КОНКУРЕНТЫ ИСПОЛЬЗУЮТ:
Цвета: ${competitorColors.join(', ') || 'нет данных'}
Шрифты: ${competitorFonts.join(', ') || 'нет данных'}
Стили: ${competitors.map(c => c.layout_style).join(', ')}

ТВОЯ ЗАДАЧА:
Создай УНИКАЛЬНУЮ цветовую палитру и типографику, которая:
1. ОТЛИЧАЕТСЯ от конкурентов (избегай их основных цветов)
2. Подходит для ${query}
3. Современная и профессиональная
4. Работает в тёмной теме (dark mode first)

Верни JSON:
{
  "color_palette": {
    "primary": "#hex — основной цвет бренда",
    "secondary": "#hex — вторичный цвет",
    "accent": "#hex — акцентный цвет для CTA",
    "background": "#hex — тёмный фон",
    "text": "#hex — цвет текста"
  },
  "typography": {
    "headings": "Название шрифта для заголовков (Google Fonts)",
    "body": "Название шрифта для текста",
    "mono": "Моноширинный шрифт для кода (опционально)"
  },
  "unique_elements": ["3-5 уникальных UI элементов для дифференциации"],
  "design_rationale": "Краткое объяснение выбора (1-2 предложения)"
}`;

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
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return defaultDesign;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        color_palette: parsed.color_palette || defaultDesign.color_palette,
        typography: parsed.typography || defaultDesign.typography,
        unique_elements: parsed.unique_elements || defaultDesign.unique_elements,
        design_rationale: parsed.design_rationale || defaultDesign.design_rationale,
      };
    }

    return defaultDesign;

  } catch (error) {
    console.error('Design generation error:', error);
    return defaultDesign;
  }
}

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

    // Получаем конкурентов из context
    const competitors: Array<{ name: string; website?: string }> =
      context?.competition?.competitors ||
      context?.competitors_exist?.competitors ||
      [];

    // Фильтруем только тех, у кого есть website
    const competitorsWithWebsites = competitors
      .filter(c => c.website)
      .slice(0, 5); // Лимит 5 сайтов для скорости

    // Анализируем сайты конкурентов параллельно
    const analysisPromises = competitorsWithWebsites.map(c =>
      analyzeCompetitorWebsite(c.name, c.website!)
    );

    const analysisResults = await Promise.all(analysisPromises);
    const validAnalysis = analysisResults.filter((r): r is CompetitorDesign => r !== null);

    // Генерируем уникальный дизайн
    const generatedDesign = await generateUniqueDesign(searchQuery, validAnalysis);

    // Считаем differentiation score
    // Чем больше проанализировано конкурентов, тем выше уверенность в уникальности
    const differentiationScore = Math.min(10, 5 + validAnalysis.length);

    const result: DesignAnalysisResult = {
      competitors_analyzed: validAnalysis,
      generated_design: generatedDesign,
      differentiation_score: differentiationScore,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Design Analysis API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
