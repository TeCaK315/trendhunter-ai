/**
 * Design Analyzer Module
 *
 * Анализирует дизайн конкурентов и генерирует уникальную палитру.
 * Работает в фоновом режиме, результат используется при генерации MVP.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export interface CompetitorDesign {
  name: string;
  website: string;
  colors: string[];
  fonts: string[];
  layout_style: 'minimal' | 'dense' | 'spacious' | 'modern' | 'unknown';
  ui_patterns: string[];
  overall_style: string;
}

export interface GeneratedDesign {
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

export interface DesignAnalysisResult {
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

  return Array.from(colors).slice(0, 20);
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
    let url = website;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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

    // Extract inline styles
    const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    const inlineStyles = styleMatches.join('\n');
    const styleAttrMatches = html.match(/style="[^"]+"/gi) || [];
    const attrStyles = styleAttrMatches.join('\n');

    const allCSS = inlineStyles + '\n' + attrStyles + '\n' + html;

    const colors = extractColorsFromCSS(allCSS);
    const fonts = extractFontsFromCSS(allCSS);

    // Определяем стиль layout
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
    if (htmlLower.includes('card')) ui_patterns.push('cards');
    if (htmlLower.includes('modal') || htmlLower.includes('dialog')) ui_patterns.push('modals');
    if (htmlLower.includes('sidebar')) ui_patterns.push('sidebar');
    if (htmlLower.includes('table')) ui_patterns.push('tables');
    if (htmlLower.includes('chart') || htmlLower.includes('graph')) ui_patterns.push('charts');
    if (htmlLower.includes('form')) ui_patterns.push('forms');
    if (htmlLower.includes('navbar') || htmlLower.includes('navigation')) ui_patterns.push('navbar');

    return {
      name,
      website: url,
      colors,
      fonts,
      layout_style,
      ui_patterns,
      overall_style: `${layout_style} layout with ${colors.length} colors, ${fonts.length} custom fonts`,
    };

  } catch {
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
  const defaultDesign: GeneratedDesign = {
    color_palette: {
      primary: '#6d5cff',
      secondary: '#a78bfa',
      accent: '#34d399',
      background: '#09090b',
      text: '#fafafa',
    },
    typography: {
      headings: 'Satoshi',
      body: 'Inter',
      mono: 'JetBrains Mono',
    },
    unique_elements: [
      'Subtle noise/grain texture overlay',
      'Layered soft shadows instead of borders',
      'Micro-interaction hover states with spring easing',
      'Bento-style card grid layout',
      'Muted gradients with blur glow effects',
    ],
    design_rationale: 'Clean dark theme with muted tones and one vibrant accent — follows 2026 SaaS design language: minimal borders, generous spacing, layered depth via shadows',
  };

  if (!OPENAI_API_KEY || competitors.length === 0) {
    return defaultDesign;
  }

  try {
    const competitorColors = competitors.flatMap(c => c.colors).slice(0, 30);
    const competitorFonts = competitors.flatMap(c => c.fonts).slice(0, 15);

    const prompt = `You are a world-class product designer creating a visual identity for a new SaaS product in the "${query}" niche. The year is 2026.

COMPETITORS USE:
Colors: ${competitorColors.join(', ') || 'unknown'}
Fonts: ${competitorFonts.join(', ') || 'unknown'}
Styles: ${competitors.map(c => c.layout_style).join(', ')}

2026 DESIGN LANGUAGE (follow these trends):
- Dark mode first with rich, deep backgrounds (not flat #000 — use subtle blue/purple undertones like #09090b, #0c0a1d)
- Muted, desaturated primary colors — NOT oversaturated neon. Think refined: slate blues, muted violets, sage greens, warm ambers
- One vibrant accent color for CTAs and key actions — this is the only "loud" color
- Layered depth via soft box-shadows instead of hard borders
- Subtle noise/grain texture overlays for organic feel
- Generous whitespace and larger type scales
- Modern variable fonts from Google Fonts: Satoshi, General Sans, Cabinet Grotesk, Plus Jakarta Sans, Geist, Outfit, Sora
- Body font: Inter, DM Sans, or Geist for readability
- Mono: JetBrains Mono, Geist Mono, or Fira Code
- Micro-interactions with spring/ease-out timing
- Bento-style card grids
- Gradient glow effects (not gradient backgrounds — subtle glow behind elements)

YOUR TASK:
Create a UNIQUE color palette and typography that:
1. Visually DIFFERS from competitors (avoid their primary colors)
2. Follows 2026 design trends above
3. Feels premium, trustworthy, modern
4. Works in dark mode with proper contrast ratios (text on background must be WCAG AA)

Return JSON only:
{
  "color_palette": {
    "primary": "#hex — muted brand color (not oversaturated)",
    "secondary": "#hex — complementary muted tone",
    "accent": "#hex — one vibrant color for CTAs",
    "background": "#hex — deep dark background with subtle undertone",
    "text": "#hex — high-contrast text color"
  },
  "typography": {
    "headings": "Modern Google Font name for headings",
    "body": "Clean readable Google Font for body",
    "mono": "Monospace font"
  },
  "unique_elements": ["4-5 specific UI elements using 2026 design language"],
  "design_rationale": "1-2 sentences explaining the design direction"
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
      return defaultDesign;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

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

  } catch {
    return defaultDesign;
  }
}

/**
 * Главная функция анализа дизайна
 * Вызывается из market-occupation при наличии конкурентов с сайтами
 */
export async function analyzeDesign(
  query: string,
  competitors: Array<{ name: string; website?: string }>
): Promise<DesignAnalysisResult | null> {
  // Фильтруем конкурентов с сайтами
  const competitorsWithWebsites = competitors
    .filter(c => c.website)
    .slice(0, 5);

  if (competitorsWithWebsites.length === 0) {
    return null;
  }

  try {
    // Анализируем сайты параллельно
    const analysisPromises = competitorsWithWebsites.map(c =>
      analyzeCompetitorWebsite(c.name, c.website!)
    );

    const analysisResults = await Promise.all(analysisPromises);
    const validAnalysis = analysisResults.filter((r): r is CompetitorDesign => r !== null);

    if (validAnalysis.length === 0) {
      return null;
    }

    // Генерируем уникальный дизайн
    const generatedDesign = await generateUniqueDesign(query, validAnalysis);

    const differentiationScore = Math.min(10, 5 + validAnalysis.length);

    return {
      competitors_analyzed: validAnalysis,
      generated_design: generatedDesign,
      differentiation_score: differentiationScore,
      analyzed_at: new Date().toISOString(),
    };

  } catch {
    return null;
  }
}
