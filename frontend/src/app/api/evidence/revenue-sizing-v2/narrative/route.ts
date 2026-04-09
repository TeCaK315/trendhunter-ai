// /api/evidence/revenue-sizing-v2/narrative — Intelligence Layer для Block 5
// Sonnet интерпретирует экономику ниши на языке предпринимателя
// GET ?trend_id=xxx&force=true — читает block_results, кэширует результат

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import { selectEconomicsNarrativeMode } from '@/lib/economics/Block5_Economics_FINAL'

const claude = new Anthropic()

// ── translateMetrics — переводит технические значения на человеческий язык ──
// Claude получает уже переведённые фразы и только соединяет их в текст.
// Защита от галлюцинаций: Claude не может добавить то чего нет в данных.

function translateMetrics(data: Record<string, any>): Record<string, string> {
  const t: Record<string, string> = {}

  t.revenue_quality_human =
    data.revenue_quality === 'HIGH'   ? 'повторяемая выручка — клиенты платят каждый месяц автоматически' :
    data.revenue_quality === 'MEDIUM' ? 'частично повторяемая выручка — есть подписка, но есть и разовые платежи' :
                                        'разовая выручка — каждую продажу нужно совершать заново'

  t.churn_human =
    data.churn_level === 'LOW'    ? 'клиенты уходят редко — продукт создаёт зависимость' :
    data.churn_level === 'MEDIUM' ? 'клиенты уходят умеренно — средний уровень удержания' :
                                    'клиенты уходят часто — удержание будет главной проблемой'

  const conf = (data.economics_confidence || data.revenue_confidence || '').toUpperCase()
  t.confidence_human =
    conf === 'HIGH'   ? 'данные надёжные — расчёт можно использовать для решений' :
    conf === 'MEDIUM' ? 'данные частично надёжные — цифры ориентировочные' :
                        'данных мало — цифры предварительные, нужна проверка на реальных сделках'

  t.entry_barrier_human = data.high_entry_barrier_flag
    ? 'высокий порог входа — нужны серьёзные вложения до первой продажи'
    : 'порог входа умеренный — можно начать с небольшим бюджетом'

  if (data.payback_months != null) {
    t.payback_human =
      data.payback_status === 'ok'   ? `один клиент окупается за ${data.payback_months} месяцев — это хороший показатель` :
      data.payback_status === 'long' ? `один клиент окупается за ${data.payback_months} месяцев — это долго, нужно следить за удержанием` :
                                       'клиент не окупается при текущих ценах — юнит-экономика не сходится'
  } else {
    t.payback_human = 'окупаемость не рассчитана — недостаточно данных по ценам'
  }

  t.leaky_bucket_human = data.leaky_bucket_flag
    ? 'есть риск "дырявого ведра" — клиенты будут уходить к бесплатным аналогам'
    : 'риска массового оттока к бесплатным аналогам нет'

  const scenarios = data.cac_scenarios || {}
  const rec = (scenarios.recommended || '').toLowerCase()
  const cacMid = scenarios[rec]?.mid
  t.cac_human = cacMid
    ? `привлечение одного клиента через ${scenarios.recommended} обойдётся примерно в $${cacMid}`
    : 'стоимость привлечения клиента не рассчитана'

  if (data.experiment_budget && data.min_valid_clients) {
    t.budget_human = `для проверки гипотезы нужно привлечь ${data.min_valid_clients} клиентов — это обойдётся примерно в $${data.experiment_budget.toLocaleString()}`
  } else {
    t.budget_human = 'бюджет на проверку гипотезы не рассчитан'
  }

  t.freemium_human = data.freemium_flag
    ? 'ниша заражена бесплатными продуктами — монетизация под давлением'
    : 'бесплатных конкурентов нет или они не доминируют'

  t.methods_human = data.revenue_method_agreement
    ? 'два метода расчёта выручки дали похожие результаты — цифрам можно доверять'
    : 'два метода расчёта разошлись — цифры ориентировочные'

  return t
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const trendId = req.nextUrl.searchParams.get('trend_id')
    if (!trendId) return NextResponse.json({ error: 'trend_id required' }, { status: 400 })

    const forceRefresh = req.nextUrl.searchParams.get('force') === 'true'
    const supabase = getServerSupabase()

    const { data: blockResult, error: blockError } = await supabase
      .from('block_results')
      .select('id, block_context, intelligence_output, raw_data')
      .eq('trend_id', trendId)
      .eq('user_id', user.id)
      .eq('block_number', 5)
      .single()

    if (blockError || !blockResult) {
      return NextResponse.json({ error: 'Block 5 not found' }, { status: 404 })
    }

    // Check cache (skip if force=true)
    if (!forceRefresh && blockResult.intelligence_output) {
      return NextResponse.json({ cached: true, data: blockResult.intelligence_output })
    }

    const bc = blockResult.block_context || {}
    const rd = blockResult.raw_data || {}
    const blockData = { ...rd, ...bc }

    // Get niche name
    const { data: trend } = await supabase
      .from('saved_trends')
      .select('title')
      .eq('id', trendId)
      .maybeSingle()

    const nicheName = trend?.title || bc.niche || 'unknown'

    // Narrative mode
    const diagnosis = (blockData.diagnosis || 'YELLOW').toUpperCase()
    const conf = (blockData.economics_confidence || blockData.revenue_confidence || 'MEDIUM').toUpperCase()
    const narrativeMode = selectEconomicsNarrativeMode(diagnosis as any, conf as any)

    // Translate metrics to human language
    const translated = translateMetrics(blockData)

    // Build prompt with pre-translated terms
    const prompt = `
Ты — экономический аналитик. Пишешь для предпринимателей простым языком.
Язык: русский. Выводи ТОЛЬКО валидный JSON без markdown и без \`\`\`json.

ЖЁСТКОЕ ПРАВИЛО: используй ТОЛЬКО факты из ВХОДНЫХ ДАННЫХ.
Не добавляй ничего от себя. Не придумывай цифры. Не делай выводов
которых нет в данных. Если данных нет — скажи что данных нет.

ВХОДНЫЕ ДАННЫЕ — ЦИФРЫ:
- ниша: ${nicheName}
- диагноз: ${diagnosis}
- выручка реалистичная: $${blockData.revenue_mid?.toLocaleString() ?? 'нет данных'} в год
- выручка минимальная: $${blockData.revenue_low?.toLocaleString() ?? 'нет данных'} в год
- выручка максимальная: $${blockData.revenue_high?.toLocaleString() ?? 'нет данных'} в год
- месяцев до первых денег: ${blockData.months_to_first_revenue ?? 0}
- клиентов до безубыточности: ${blockData.break_even_clients ?? 'нет данных'}
- главный риск: ${blockData.main_economic_risk ?? 'не определён'}
- режим нарратива: ${narrativeMode}

ВХОДНЫЕ ДАННЫЕ — УЖЕ ПЕРЕВЕДЁННЫЕ НА ЧЕЛОВЕЧЕСКИЙ ЯЗЫК:
- качество выручки: ${translated.revenue_quality_human}
- отток клиентов: ${translated.churn_human}
- надёжность данных: ${translated.confidence_human}
- порог входа: ${translated.entry_barrier_human}
- окупаемость клиента: ${translated.payback_human}
- риск оттока к бесплатным: ${translated.leaky_bucket_human}
- стоимость привлечения: ${translated.cac_human}
- бюджет на проверку: ${translated.budget_human}
- бесплатные конкуренты: ${translated.freemium_human}
- согласованность методов: ${translated.methods_human}

РЕЖИМ НАПИСАНИЯ: ${narrativeMode}

HIGH_CONFIDENCE_GREEN:
  Начни с конкретной цифры и инсайта. Тон уверенный.
  Заверши: "Путь к деньгам здесь есть — вопрос в скорости входа."

MEDIUM_CONFIDENCE:
  Начни: "Экономика ${nicheName}..."
  Тон взвешенный, честный.
  Заверши: "Деньги возможны — при правильном выборе модели входа."

LOW_CONFIDENCE_RED:
  ПЕРВОЕ ПРЕДЛОЖЕНИЕ = оговорка о данных.
  Начни: "Данных по ${nicheName} достаточно только для оценочного вывода..."
  Заверши: "Перед входом стоит проверить экономику на реальных сделках."

ВЫВОД — ТОЛЬКО JSON:
{
  "narrative_economics": "4-6 предложений. Связный текст используя переведённые термины выше. Никаких технических аббревиатур.",
  "revenue_quality_explanation": "1-2 предложения. Объясни качество выручки применительно к этой нише.",
  "experiment_budget_explanation": "2-3 предложения. Объясни бюджет на проверку — зачем эти клиенты, что они дадут.",
  "payback_explanation": "1-2 предложения про окупаемость. Или null если данных нет.",
  "bridge_to_strategy": "1 предложение. Мостик в Стратегию — что делать дальше исходя из этой экономики."
}
`.trim()

    console.log(`[Block5 Intelligence] Generating for "${nicheName}" (mode: ${narrativeMode})...`)

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'Выводи ТОЛЬКО валидный JSON без markdown и без ```json',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()

    let intelligenceOutput: any
    try {
      intelligenceOutput = JSON.parse(clean)
    } catch {
      console.error('[Block5 Intelligence] JSON parse failed, raw:', clean.slice(0, 200))
      return NextResponse.json({ error: 'parse_failed', raw: clean.slice(0, 500) })
    }

    intelligenceOutput.cached_at = new Date().toISOString()
    intelligenceOutput.narrative_mode = narrativeMode

    await supabase
      .from('block_results')
      .update({ intelligence_output: intelligenceOutput, intelligence_updated_at: new Date().toISOString() })
      .eq('id', blockResult.id)

    console.log(`[Block5 Intelligence] Generated for "${nicheName}" (mode: ${narrativeMode})`)

    return NextResponse.json({ cached: false, data: intelligenceOutput })
  } catch (error: any) {
    console.error('[Block5 Intelligence] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
