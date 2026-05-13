// app/api/evidence/revenue-sizing-v2/route.ts
// Block 5 v2 — Economics (Revenue Range + Unit Economics)
// Reads data from Blocks 1, 2, 3, 4
//
// WAVE ORDER:
// Wave 1: Block 1 (Problem) + Block 2 (Demand) — parallel
// Wave 2: Block 4 (Competition) — waits for Wave 1
// Wave 3: Block 3 (Sellability) — waits for Block 4
// Wave 4: Block 5 (Economics) — waits for Blocks 2+3+4 ← THIS FILE
// Wave 5: Block 6 (Blind Spots) — waits for all 1-5
// Wave 6: Block 7 (AI Synthesis) — manual trigger

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';
import { runBlock5Pipeline, type Block5Input } from '@/lib/economics/Block5_Economics_FINAL';

const claude = new Anthropic();

// ─── Map block_context fields to Block5Input ───────────────

function mapBlock5Input(
  bc1: any,
  bc2: any,
  bc3: any,
  bc4: any,
): Block5Input {
  // Block 1: paying_ratio (normalize >1 → /100)
  const rawPaying = bc1?.paying_users_ratio ?? 0;
  const paying_ratio = rawPaying > 1 ? rawPaying / 100 : rawPaying;

  // Block 2: commercial intent, demand strength, search volume proxy
  const commercial_intent_ratio = bc2?.commercial_intent_ratio ?? 0;
  const demandScore = bc2?.demand_confidence_score ?? 0.5;
  const demand_strength = demandScore >= 0.7 ? 'STRONG' as const
    : demandScore >= 0.4 ? 'MEDIUM' as const
    : demandScore >= 0.2 ? 'LOW' as const
    : 'DECLINING' as const;
  const search_volume = bc2?.serp_ad_density ?? 0; // proxy

  // Block 3: monetization data
  const priceTier = bc3?.price_tier ?? 'budget';
  const priceMedianMap: Record<string, number> = {
    budget: 29, mid: 99, premium: 299, enterprise: 999,
  };
  const price_range_median = bc3?.entry_price_usd ?? priceMedianMap[priceTier] ?? 49;
  const friction_score = bc3?.friction_score ?? 'MEDIUM';
  const price_model = bc3?.billing_model ?? 'subscription';
  const monetization_quality = bc3?.monetization_quality ?? 'STABLE';
  const has_free_tier_competitors = bc3?.has_free_trial ?? bc3?.has_freemium ?? false;

  // Block 4: competition data
  const gapType = bc4?.gap_type ?? 'unknown';
  const entry_verdict = gapType === 'none' ? 'HARD' as const
    : gapType === 'execution' ? 'EXPERIMENT' as const
    : gapType === 'strategic' ? 'GO' as const
    : 'EXPERIMENT' as const;

  const competition_intensity = bc4?.competition_intensity ?? 'MEDIUM';
  const avg_switching_cost = bc4?.avg_switching_cost ?? 'MEDIUM';
  const top_competitor_g2_reviews = bc4?.top_competitor_g2_reviews ?? null;
  const top_competitor_size = bc4?.top_competitor_size ?? undefined;
  const substitute_strength = bc4?.substitute_strength ?? 'MEDIUM';

  // Gap map from Block 4
  const gap_map = (bc4?.gap_map || []).map((g: any) => ({
    pain: g.pain || '',
    status: g.status || 'unknown',
    paying_ratio: g.paying_ratio ?? 0,
  }));

  // Acquisition type inference
  const requiresSales = bc3?.requires_sales_contact ?? false;
  const hasFreemium = bc3?.has_freemium ?? false;
  let acquisition_type: 'SALES_LED' | 'PLG' | 'SEO_LED' = requiresSales
    ? 'SALES_LED'
    : hasFreemium ? 'PLG' : 'SEO_LED';

  // Market type from Block 4 or inferred from Block 1
  // Block 1 хранит контекст в block_context.context ('b2b'|'b2c'|'mixed')
  const market_type = bc4?.market_type ?? bc1?.context ?? bc1?.market_type ?? undefined;

  // P0: При B2C SALES_LED невозможен — клиент не общается с менеджером по продажам.
  // Принудительно переключаем на PLG (самообслуживание).
  const isB2C =
    typeof market_type === 'string' &&
    (market_type.toLowerCase() === 'b2c' || market_type.toUpperCase().includes('B2C'));
  if (isB2C && acquisition_type === 'SALES_LED') {
    console.log('[Block5] B2C market detected, overriding SALES_LED → PLG');
    acquisition_type = 'PLG';
  }

  // Sale cycle days estimation
  const sale_cycle_days = friction_score === 'HIGH' ? 30
    : friction_score === 'MEDIUM' ? 14
    : 7;

  // Open pain ratio from Block 4
  const open_pain_ratio = bc4?.open_pain_ratio ?? 0.3;

  return {
    paying_ratio,
    commercial_intent_ratio,
    search_volume,
    demand_strength,
    price_range_median,
    sale_cycle_days,
    monetization_quality,
    price_model,
    friction_score,
    market_type,
    entry_verdict,
    gap_map,
    competition_intensity,
    avg_switching_cost,
    open_pain_ratio,
    acquisition_type,
    substitute_strength,
    top_competitor_g2_reviews,
    top_competitor_size,
    has_free_tier_competitors,
  };
}

function diagnosisToColor(d: string): 'green' | 'yellow' | 'red' {
  if (d === 'GREEN') return 'green';
  if (d === 'YELLOW') return 'yellow';
  return 'red';
}

function diagnosisToScore(d: string): number {
  if (d === 'GREEN') return 8;
  if (d === 'YELLOW') return 5;
  return 2;
}

// ════════════════════════════════════════════════════════════════
// INTERPRETATION LAYER (Block 5)
// ════════════════════════════════════════════════════════════════
// Фоновая генерация человекочитаемой интерпретации блока.
// Кэш 24ч в block_interpretations. Не блокирует основной ответ.

async function generateEconomicsInterpretation(
  trendId: string,
  niche: string,
  diagnosis: string,
  result: Record<string, any>,
  supabase: ReturnType<typeof getServerSupabase>,
  anthropic: Anthropic,
): Promise<void> {
  // Кэш — пропускаем если интерпретация свежее 24ч
  // 5.4 — Кэш с проверкой значимого изменения чисел
  const { data: existing } = await supabase
    .from('block_interpretations')
    .select('id, generated_at, headline, key_facts')
    .eq('trend_id', trendId)
    .eq('block_id', 'economics')
    .maybeSingle();

  if (existing && (existing as any).generated_at) {
    const age = Date.now() - new Date((existing as any).generated_at).getTime();
    const isFresh = age < 24 * 60 * 60 * 1000;

    if (isFresh) {
      const cachedText = [
        (existing as any).headline ?? '',
        ...(Array.isArray((existing as any).key_facts) ? (existing as any).key_facts : []),
      ].join(' ').toLowerCase();

      const currentPLGMid: number | null = result?.cac_scenarios?.plg?.mid ?? null;
      const currentRevenueMid: number = result?.revenue_mid ?? 0;

      // 1. Старый experiment_budget $168K
      const budgetStale =
        cachedText.includes('168 000') || cachedText.includes('168000') || cachedText.includes('$168k');

      // 2. Старый CAC $144 при существенно другом текущем PLG
      const cacContainsOld144 =
        cachedText.includes('$144') || cachedText.includes('144 доллар') || cachedText.includes('144$');
      const cacStale =
        currentPLGMid !== null && Math.abs(currentPLGMid - 144) > 30 && cacContainsOld144;

      // 3. Старый sales CAC $6 000 при текущем дешёвом PLG
      const salesCACStale =
        (cachedText.includes('$6 000') ||
          cachedText.includes('$6,000') ||
          cachedText.includes('6 000 cac') ||
          cachedText.includes('6000 cac')) &&
        currentPLGMid !== null &&
        currentPLGMid < 500;

      // 4. Revenue кардинально отличается (ищем старые числа)
      const currentRevK = Math.round(currentRevenueMid / 1000);
      const revenueStale =
        currentRevK > 0 &&
        !cachedText.includes(String(currentRevK)) &&
        (cachedText.includes('992') ||
          cachedText.includes('932') ||
          cachedText.includes('248') ||
          cachedText.includes('450'));

      const isStale = budgetStale || cacStale || salesCACStale || revenueStale;
      if (!isStale) return;
      console.log(
        `[Block5 Interpretation] Stale numbers detected (budget=${budgetStale}, cac144=${cacContainsOld144}, salesCAC=${salesCACStale}, revenue=${revenueStale}) — regenerating`,
      );
    }
  }

  const revenueMid = result?.revenue_mid ?? 0;
  const revenueLow = result?.revenue_low ?? 0;
  const revenueHigh = result?.revenue_high ?? 0;
  const revenueConfidence = result?.revenue_confidence ?? 'LOW';
  const economicsConfidence = result?.economics_confidence ?? 'LOW';
  const isLowConfidence = revenueConfidence === 'LOW' || economicsConfidence === 'LOW';

  const cacScenarios = result?.cac_scenarios ?? {};
  const recommendedChannel = cacScenarios?.recommended ?? 'PLG';

  // Самый дешёвый канал
  const channelMids: Record<string, number> = {
    plg: cacScenarios?.plg?.mid ?? Infinity,
    community_led: cacScenarios?.community_led?.mid ?? Infinity,
    seo_led: cacScenarios?.seo_led?.mid ?? Infinity,
  };
  const cheapestEntry = Object.entries(channelMids).reduce<[string, number] | null>(
    (best, [k, v]) => (best == null || v < best[1] ? [k, v] : best),
    null,
  );
  const cheapestCacMid = cheapestEntry && Number.isFinite(cheapestEntry[1])
    ? cheapestEntry[1] : null;
  const cheapestCacName =
    cheapestEntry?.[0] === 'plg' ? 'через продукт (PLG)'
    : cheapestEntry?.[0] === 'community_led' ? 'через сообщество'
    : cheapestEntry?.[0] === 'seo_led' ? 'через SEO'
    : 'не определён';

  const salesLedMid = cacScenarios?.sales_led?.mid ?? null;
  const cacRatio = cheapestCacMid != null && salesLedMid != null && cheapestCacMid > 0
    ? Math.round(salesLedMid / cheapestCacMid)
    : null;

  const paybackMonths = result?.payback_months ?? null;
  const paybackStatus = result?.payback_status ?? 'ok';
  const monthsToFirstRevenue = result?.months_to_first_revenue ?? 1;
  const minValidClients = result?.min_valid_clients ?? 0;
  const mainEconomicRisk = result?.main_economic_risk ?? '';
  const revenueQuality = result?.revenue_quality ?? 'MEDIUM';
  const churnLevel = result?.churn_level ?? 'MEDIUM';
  const monthlyBurnEstimate = result?.monthly_burn_estimate ?? 0;
  const highEntryBarrier = result?.high_entry_barrier_flag ?? false;
  const cacSpreadFlag = result?.cac_spread_flag ?? false;

  // Реалистичный бюджет (floor $100 — не может быть 0)
  const minSignalBudget = cheapestCacMid != null && cheapestCacMid > 0
    ? Math.round(cheapestCacMid * 3)
    : Math.max(result?.experiment_budget ?? 0, 100);

  // 5.5 — Method agreement: расхождение методов расчёта
  const methodAgreement = result?.revenue_method_agreement ?? true;
  const methodAResult = result?.method_a_result ?? null;
  const methodBResult = result?.method_b_result ?? null;
  const methodsDisagree = !methodAgreement && methodAResult != null && methodBResult != null
    && Math.abs(methodAResult - methodBResult) > Math.min(methodAResult, methodBResult) * 0.5;

  const methodDisagreementNote = methodsDisagree
    ? `Два независимых метода расчёта дают разные результаты: $${Math.round(methodAResult / 1000)}K (по конкурентам) vs $${Math.round(methodBResult / 1000)}K (по спросу). Реальный потенциал неизвестен до первых продаж.`
    : null;

  // 5.1 — cumulative_timeline: траектория роста
  const cumulativeTimeline = result?.cumulative_timeline ?? {};
  const monthly24 = cumulativeTimeline?.month_24_monthly_revenue ?? null;
  const monthly36 = cumulativeTimeline?.month_36_monthly_revenue ?? null;
  const breakEvenClients = result?.break_even_clients ?? null;

  const timelineInsight = [
    monthsToFirstRevenue <= 1
      ? 'первые деньги — в первый месяц'
      : `первые деньги — через ${monthsToFirstRevenue} мес`,
    monthly24 ? `через 2 года: $${Math.round(monthly24 / 1000)}K/мес` : null,
    monthly36 ? `через 3 года: $${Math.round(monthly36 / 1000)}K/мес` : null,
  ].filter(Boolean).join(', ');

  const burnRate = result?.monthly_burn_estimate ?? 0;
  const month36VsBurn =
    monthly36 && burnRate > 0
      ? monthly36 >= burnRate * 3
        ? `на 3-м году выручка в ${Math.round(monthly36 / burnRate)}× превышает расходы`
        : monthly36 >= burnRate
        ? 'на 3-м году выручка покрывает расходы'
        : 'на 3-м году выручка ещё ниже расходов — нужен рост'
      : null;

  // 5.6 — фильтрация calculation_notes: расширенные источники market_type + шире фильтр
  const marketTypeStr = String(
    result?.market_type ??
    result?.accumulated_context?.market_type ??
    // Инференс из cac_scenarios если тип не определён
    (cacScenarios?.recommended === 'PLG' ? 'b2c' :
     cacScenarios?.recommended === 'SALES_LED' && (result?.revenue_mid ?? 0) > 500000 ? 'b2b' :
     'unknown'),
  ).toLowerCase();
  const isB2CContext = marketTypeStr === 'b2c' || marketTypeStr.includes('b2c') || marketTypeStr === 'mixed';
  const rawNotes: string[] = Array.isArray(result?.calculation_notes) ? result.calculation_notes : [];
  const filteredNotes = rawNotes.filter((note: string) => {
    if (!isB2CContext) return true; // B2B — оставляем всё
    const noteLower = note.toLowerCase();
    // Убираем enterprise-ориентированные заметки для B2C/mixed
    if (noteLower.includes('enterprise')) return false;
    if (noteLower.includes('прямые продажи') && !noteLower.includes('не рекомендуется')) return false;
    if (noteLower.includes('sales-led') && noteLower.includes('рынок')) return false;
    return true;
  });
  const notesForPrompt = filteredNotes.length > 0 ? filteredNotes.join('. ') : null;
  const marketTypeHuman = isB2CContext && marketTypeStr !== 'mixed'
    ? 'B2C — конечные пользователи, не корпорации'
    : marketTypeStr === 'mixed' ? 'Смешанный (B2B + B2C)'
    : marketTypeStr.includes('b2b') ? 'B2B — бизнес-клиенты'
    : 'не определён';

  // Перевод технических терминов
  const revenueQualityHuman =
    revenueQuality === 'HIGH' ? 'предсказуемая подписка — клиент платит каждый месяц'
    : revenueQuality === 'MEDIUM' ? 'частично повторяемая — есть подписка и разовые платежи'
    : 'разовые продажи — каждый клиент требует новых усилий';

  const churnHuman =
    churnLevel === 'LOW' ? 'клиенты уходят редко'
    : churnLevel === 'MEDIUM' ? 'средний отток — нужно работать над удержанием'
    : 'высокий отток — удержание будет главной проблемой';

  // Fix 2: LOW confidence при наличии реальных данных конкурентов = sufficient
  const hasCompetitorData = (result?.method_a_result ?? 0) > 0;
  const dataSufficiency: 'sufficient' | 'limited' =
    (isLowConfidence && hasCompetitorData) ? 'sufficient'
    : isLowConfidence ? 'limited'
    : 'sufficient';

  const systemPrompt = `Ты — аналитик экономики рынков для предпринимателей.
Пишешь на русском языке. Твои тексты читают люди которые думают
войти в новую нишу — они не технари, они бизнесмены.

ЖЁСТКИЕ ПРАВИЛА:
- Никогда не используй: revenue_confidence, economics_confidence,
  cac_scenarios, realization_rate, method_a_result, method_b_result,
  revenue_quality как код, churn_level как код, SALES_LED как аббревиатуру,
  PLG как аббревиатуру без объяснения, cac_spread_flag, leaky_bucket_flag,
  long_payback_flag, data_quality_score, revenue_method_agreement
- Никогда не пиши: "данных недостаточно", "LOW confidence",
  "revenue_confidence: LOW", точные числа revenue при LOW confidence
  (только диапазон)
- Тон: уверенный аналитик который хорошо знает этот рынок`;

  const userPrompt = `Проанализируй экономику входа в нишу: "${niche}"

ТЕХНИЧЕСКИЕ ДАННЫЕ (не используй эти термины в тексте):
- Диагноз: ${diagnosis}
- Тип рынка: ${marketTypeHuman}
- Надёжность расчёта: ${isLowConfidence ? 'ориентировочная — данных о ценах конкурентов немного' : 'надёжная'}
- Потенциал рынка: ${isLowConfidence
    ? `от $${Math.round(revenueLow / 1000)}K до $${Math.round(revenueHigh / 1000)}K в год (диапазон)`
    : `$${Math.round(revenueMid / 1000)}K в год`}
- Качество выручки: ${revenueQualityHuman}
- Отток клиентов: ${churnHuman}
- Самый дешёвый канал: ${cheapestCacMid != null ? `$${cheapestCacMid} на клиента ${cheapestCacName}` : 'не определён'}
- Для сравнения через прямые продажи: $${salesLedMid ?? 6000} на клиента
- Экономия при дешёвом канале: ${cacRatio != null ? `в ${cacRatio} раз` : 'не определена'}
${methodsDisagree ? `- РАСХОЖДЕНИЕ МЕТОДОВ РАСЧЁТА: $${Math.round((methodBResult ?? 0) / 1000)}K vs $${Math.round((methodAResult ?? 0) / 1000)}K — реальный потенциал неизвестен до первых продаж` : ''}
${methodDisagreementNote ? `\nСИГНАЛ НЕОПРЕДЕЛЁННОСТИ: ${methodDisagreementNote}` : ''}
- Динамика роста: ${timelineInsight}
${month36VsBurn ? `- Устойчивость: ${month36VsBurn}` : ''}
- Точка безубыточности: ${breakEvenClients ? `${breakEvenClients} клиентов` : 'не рассчитана'}
- Окупаемость одного клиента: ${paybackMonths ? `${paybackMonths} месяцев` : 'не рассчитана'} (${paybackStatus === 'ok' ? 'нормально' : paybackStatus === 'long' ? 'долго' : 'не окупается'})
- Бюджет на проверку гипотезы: от $${minSignalBudget.toLocaleString()} (${minValidClients} клиентов)
- Главный экономический риск: ${mainEconomicRisk || 'не определён'}
- Высокий порог входа: ${highEntryBarrier ? 'да — нужны серьёзные вложения до первой продажи' : 'нет — можно начать с небольшим бюджетом'}
- Ежемесячные расходы при работе: $${monthlyBurnEstimate.toLocaleString()}
${notesForPrompt ? `- Примечания расчёта: ${notesForPrompt}` : ''}

${dataSufficiency === 'limited' ? `ВАЖНО: Данных о ценах конкурентов немного. Расчёты ориентировочные. Используй знания о типичной экономике продуктов типа "${niche}". Формулируй честно но без технических оговорок.` : ''}

Ответь на три вопроса предпринимателя:
1. Сколько реально можно заработать — и какая траектория роста?
2. Сколько нужно вложить чтобы проверить гипотезу?
3. Какой главный экономический риск или ловушка?

Напиши анализ в формате JSON:

{
  "headline": "одно предложение-диагноз про экономику (максимум 12 слов)",
  "main_insight": "2-3 предложения. Потенциал заработка. Траектория роста по годам если данные есть. Главный риск.",
  "key_facts": [
    "факт 1: ${methodsDisagree ? `ОБЯЗАТЕЛЬНО про расхождение методов: $${Math.round((methodBResult ?? 0) / 1000)}K–$${Math.round((methodAResult ?? 0) / 1000)}K — объясни что это значит для предпринимателя` : 'потенциал выручки как реалистичный диапазон или траектория (не одно число)'}",
    "факт 2: сравнение CAC каналов — самый дешёвый vs самый дорогой с конкретными числами",
    "факт 3: временная шкала — когда первые деньги, что будет через 2-3 года при правильном канале (бери числа из динамики роста выше)"
  ],
  "decision_impact": "одно-два предложения: конкретная рекомендация — какой канал, какой бюджет, когда ждать устойчивой выручки. Используй числа из timeline."
}

ПРИМЕРЫ ХОРОШИХ ФАКТОВ (конкретные):
- "Потенциал рынка $500K–$3M в год — точнее скажут первые 10 клиентов"
- "Привлечение клиента через продукт стоит $144 — через продавцов в 40 раз дороже"
- "При правильном канале: первые деньги в месяц 1, через 2 года $14K/мес, через 3 года $21K/мес"

ПРИМЕРЫ ПЛОХИХ ФАКТОВ (ЗАПРЕЩЕНО):
- "Revenue: $932,530/год, Confidence: LOW" — нельзя при LOW
- "experiment_budget: $168,000" — нереалистичная цифра
- "Выручка растёт со временем" — без конкретных чисел по годам

Верни ТОЛЬКО валидный JSON, без markdown и без пояснений.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (response.content[0] as any)?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (
      !parsed.headline ||
      !parsed.main_insight ||
      !Array.isArray(parsed.key_facts) ||
      parsed.key_facts.length !== 3 ||
      !parsed.decision_impact
    ) {
      console.error('[Block5 Interpretation] Invalid structure:', parsed);
      return;
    }

    const { error: saveError } = await supabase
      .from('block_interpretations')
      .upsert(
        {
          trend_id: trendId,
          block_id: 'economics',
          headline: parsed.headline,
          main_insight: parsed.main_insight,
          key_facts: parsed.key_facts,
          decision_impact: parsed.decision_impact,
          model_used: 'claude-sonnet-4-6',
          data_sufficiency: dataSufficiency,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'trend_id,block_id' },
      );

    if (saveError) {
      console.error('[Block5 Interpretation] Save failed:', saveError);
      return;
    }
    console.log('[Block5 Interpretation] Generated for trend:', trendId);
  } catch (error) {
    console.error('[Block5 Interpretation] Failed:', error);
  }
}

// ─── MAIN ROUTE ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServerSupabase();
    const { trend_id, niche } = await req.json();
    if (!trend_id || !niche) return NextResponse.json({ error: 'trend_id и niche обязательны' }, { status: 400 });

    console.log(`[Block5v2] Starting for "${niche}"...`);

    // Load upstream data (Blocks 1, 2, 3, 4)
    const [b1Res, b2Res, b3Res, b4Res] = await Promise.all([
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 1).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 2).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 3).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 4).maybeSingle(),
    ]);

    const bc1 = b1Res.data?.block_context;
    const bc2 = b2Res.data?.block_context;
    const bc3 = b3Res.data?.block_context;
    const bc4 = b4Res.data?.block_context ?? null;

    console.log(`[Block5v2] Loaded blocks: B1=${!!bc1}, B2=${!!bc2}, B3=${!!bc3}, B4=${!!bc4}`);

    // Map to Block5Input and run pipeline
    const input = mapBlock5Input(bc1, bc2, bc3, bc4);
    const result = runBlock5Pipeline(input);

    console.log(`[Block5v2] Result: ${result.diagnosis} / confidence=${result.economics_confidence} / revenue_mid=${result.revenue_mid}`);

    // P0 5.2: реалистичный бюджет на проверку гипотезы — на основе самого дешёвого
    // канала привлечения. experiment_budget из pipeline считается через recommended channel
    // (может быть SALES_LED $6000 × 28 ≈ $168K — нереалистично для проверки).
    const cheapestCacMid = (() => {
      const cs = result.cac_scenarios || ({} as any);
      const candidates = [cs.plg?.mid, cs.community_led?.mid, cs.seo_led?.mid].filter(
        (v: any) => typeof v === 'number' && Number.isFinite(v) && v > 0,
      ) as number[];
      return candidates.length ? Math.min(...candidates) : null;
    })();
    // experiment_budget не может быть 0 если есть хоть какие-то CAC данные
    const pipelineBudget = Math.max(result.experiment_budget ?? 0, 100); // floor $100
    const minSignalBudget = cheapestCacMid != null && cheapestCacMid > 0
      ? Math.round(cheapestCacMid * 3)   // 3 клиента — первый сигнал
      : pipelineBudget;
    const standardExperimentBudget = cheapestCacMid != null && cheapestCacMid > 0
      ? Math.round(cheapestCacMid * 10)  // 10 клиентов — полный тест
      : Math.round(pipelineBudget * 3.3);

    // ── FIX 2A: B2C → PLG override на сохраняемом cac_scenarios.recommended ──
    // Без этого Блоки 6 и 7 читают block_context из БД и видят recommended: 'SALES_LED'
    // → генерируют инсайты с упоминанием $6000 CAC и $168K experiment budget.
    const marketTypeStr = String(input.market_type ?? '').toLowerCase();
    const isB2CMarket = marketTypeStr === 'b2c' || marketTypeStr.includes('b2c');
    if (isB2CMarket && result.cac_scenarios?.recommended === 'SALES_LED') {
      console.log('[Block5] B2C override on saved cac_scenarios.recommended: SALES_LED → PLG');
      result.cac_scenarios = { ...result.cac_scenarios, recommended: 'PLG' };
    }

    // ── FIX 2B: experiment_budget в block_context — реалистичный, не оригинальный $168K ──
    // Сохраняем оригинал в experiment_budget_original для совместимости/отладки.
    const originalExperimentBudget = result.experiment_budget;
    if (
      typeof minSignalBudget === 'number' &&
      Number.isFinite(minSignalBudget) &&
      minSignalBudget > 0 &&
      minSignalBudget < (originalExperimentBudget ?? Infinity)
    ) {
      result.experiment_budget = minSignalBudget;
    }

    // Save to block_results
    // Информативный score: варьируется внутри диагноза
    const computedEconScore = (() => {
      const diag = diagnosisToColor(result.diagnosis);
      let s = diag === 'green' ? 7 : diag === 'yellow' ? 4 : 2;
      if (result.payback_status === 'ok') s += 1.5;
      if (result.revenue_method_agreement) s += 1;
      if (!result.high_entry_barrier_flag) s += 0.5;
      if (!result.leaky_bucket_flag) s += 0.5;
      if ((result.break_even_clients ?? 999) <= 15) s += 0.5;
      if (result.payback_status === 'not_viable') s -= 2;
      if (result.leaky_bucket_flag) s -= 1;
      if (result.high_entry_barrier_flag) s -= 0.5;
      if (!result.revenue_method_agreement) s -= 0.5;
      if (result.revenue_confidence === 'LOW' && !result.revenue_method_agreement) s -= 0.5;
      return Math.max(1, Math.min(10, Math.round(s)));
    })();

    const { error: saveError } = await supabase.from('block_results').upsert({
      trend_id,
      user_id: user.id,
      block_number: 5,
      block_type: 'economics_v2',
      diagnosis: diagnosisToColor(result.diagnosis),
      score: computedEconScore,
      conflict_weight: result.diagnosis === 'RED' ? 3
        : result.diagnosis === 'YELLOW' ? 2 : 1,
      key_factors: [
        `Revenue: $${result.revenue_mid ? Math.round(result.revenue_mid).toLocaleString() : 'N/A'}/год`,
        `Качество: ${result.revenue_quality}`,
        `CAC mid: $${result.cac_scenarios.recommended ? Math.round(result.cac_scenarios[result.cac_scenarios.recommended === 'PLG' ? 'plg' : result.cac_scenarios.recommended === 'SEO_LED' ? 'seo_led' : result.cac_scenarios.recommended === 'COMMUNITY_LED' ? 'community_led' : 'sales_led']?.mid ?? 0) : 'N/A'}`,
        `Confidence: ${result.economics_confidence}`,
      ],
      key_metric: result.main_economic_risk,
      block_context: {
        revenue_low: result.revenue_low,
        revenue_mid: result.revenue_mid,
        revenue_high: result.revenue_high,
        monthly_revenue_low: result.monthly_revenue_low,
        monthly_revenue_mid: result.monthly_revenue_mid,
        monthly_revenue_high: result.monthly_revenue_high,
        revenue_confidence: result.revenue_confidence,
        revenue_quality: result.revenue_quality,
        churn_level: result.churn_level,
        cac_scenarios: result.cac_scenarios,
        cac_spread_flag: result.cac_spread_flag,
        months_to_first_revenue: result.months_to_first_revenue,
        experiment_budget: result.experiment_budget,           // уже реалистичный после FIX 2B
        experiment_budget_original: originalExperimentBudget,  // оригинал из pipeline (для отладки)
        // P0 5.2: реалистичные бюджеты на проверку гипотезы
        min_signal_budget: minSignalBudget,
        standard_experiment_budget: standardExperimentBudget,
        min_valid_clients: result.min_valid_clients,
        monthly_burn_estimate: result.monthly_burn_estimate,
        payback_months: result.payback_months,
        payback_status: result.payback_status,
        break_even_clients: result.break_even_clients,
        break_even_warning: result.break_even_warning,
        cumulative_timeline: result.cumulative_timeline,
        high_entry_barrier_flag: result.high_entry_barrier_flag,
        leaky_bucket_flag: result.leaky_bucket_flag,
        long_payback_flag: result.long_payback_flag,
        no_market_validation: result.no_market_validation,
        freemium_flag: result.freemium_flag,
        data_conflict_flag: result.data_conflict_flag,
        revenue_method_agreement: result.revenue_method_agreement,
        data_quality_score: result.data_quality_score,
        main_economic_risk: result.main_economic_risk,
        // 5.2 — Тип рынка из Блока 1, для downstream (Блоки 6, 7)
        market_type: input.market_type ?? undefined,
      },
      raw_data: result,
      intelligence_output: null,
      intelligence_updated_at: null,
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (saveError) console.error('[Block5v2] Supabase error:', saveError.message);

    // Map to format expected by EconomicsBlock.tsx
    const publicData = {
      diagnosis: diagnosisToColor(result.diagnosis),
      score: computedEconScore,
      key_metric: result.main_economic_risk,
      key_factors: [
        `Revenue: $${result.revenue_mid ? Math.round(result.revenue_mid).toLocaleString() : 'N/A'}/год`,
        `Качество: ${result.revenue_quality}`,
        `Confidence: ${result.economics_confidence}`,
        `Payback: ${result.payback_months ?? 'N/A'} мес`,
      ],
      confidence: result.economics_confidence.toLowerCase() as 'high' | 'medium' | 'low',
      data_quality_score: result.data_quality_score,
      revenue_range: {
        low: result.revenue_low,
        mid: result.revenue_mid,
        high: result.revenue_high,
      },
      monthly_revenue: {
        low: result.monthly_revenue_low,
        mid: result.monthly_revenue_mid,
        high: result.monthly_revenue_high,
      },
      months_to_first_revenue: result.months_to_first_revenue,
      cac_estimate: (() => {
        // Show the recommended CAC, but if it's extreme (>$1000), also provide the cheapest alternative
        const recKey = result.cac_scenarios.recommended === 'PLG' ? 'plg'
          : result.cac_scenarios.recommended === 'SEO_LED' ? 'seo_led'
          : result.cac_scenarios.recommended === 'COMMUNITY_LED' ? 'community_led'
          : 'sales_led';
        return result.cac_scenarios[recKey]?.mid ?? null;
      })(),
      cac_best: (() => {
        // Find cheapest available channel for UI display
        const channels = ['plg', 'community_led', 'seo_led', 'sales_led'] as const;
        let best: { mid: number; channel: string } | null = null;
        for (const ch of channels) {
          const s = result.cac_scenarios[ch];
          if (s && (!best || s.mid < best.mid)) best = { mid: s.mid, channel: ch };
        }
        return best;
      })(),
      cac_source: result.cac_scenarios.recommended || 'UNKNOWN',
      revenue_viability: result.diagnosis === 'GREEN' ? 'viable' as const
        : result.diagnosis === 'YELLOW' ? 'marginal' as const
        : 'not_viable' as const,
      methods: {
        method_1: result.method_a_result != null ? {
          competitor_customers: result.method_a_result,
          competitor_revenue_annual: result.method_a_result,
          market_share_percent: 2,
          reasoning: result.method_a_note || 'Method A: по конкурентам',
          data_source: 'g2_reviews',
        } : null,
        method_2: result.method_b_result != null ? {
          commercial_intent_ratio: input.commercial_intent_ratio,
          has_declining_signal: input.demand_strength === 'DECLINING',
          confidence_modifier: 'neutral' as const,
          reasoning: 'Method B: по поисковому спросу',
        } : null,
        method_3: result.months_to_first_revenue > 0 ? {
          sale_cycle_days: input.sale_cycle_days,
          months_to_first_revenue: result.months_to_first_revenue,
          reasoning: `Цикл продажи ${input.sale_cycle_days}д → ${result.months_to_first_revenue} мес до выручки`,
        } : null,
      },
      // P0: реалистичные бюджеты — оригинальный experiment_budget оставляем для Блока 7
      experiment_budget: result.experiment_budget,
      min_signal_budget: minSignalBudget,
      standard_experiment_budget: standardExperimentBudget,
      // P0: пробрасываем confidence и revenue range, чтобы UI мог скрыть revenue_mid при LOW
      revenue_low: result.revenue_low,
      revenue_mid: result.revenue_mid,
      revenue_high: result.revenue_high,
      revenue_confidence: result.revenue_confidence,
      economics_confidence: result.economics_confidence,
      cac_scenarios: result.cac_scenarios,
      payback_months: result.payback_months,
      payback_status: result.payback_status,
      min_valid_clients: result.min_valid_clients,
      // 5.1 — cumulative_timeline для UI Timeline секции
      cumulative_timeline: result.cumulative_timeline ?? null,
      // 5.5 — method agreement для UI
      revenue_method_agreement: result.revenue_method_agreement ?? null,
      method_a_result: result.method_a_result ?? null,
      method_b_result: result.method_b_result ?? null,
      // Pass through block_context for downstream
      block_context: {
        revenue_quality: result.revenue_quality,
        high_entry_barrier_flag: result.high_entry_barrier_flag,
        leaky_bucket_flag: result.leaky_bucket_flag,
        cac_spread_flag: result.cac_spread_flag,
        long_payback_flag: result.long_payback_flag,
        no_market_validation: result.no_market_validation,
        revenue_method_agreement: result.revenue_method_agreement,
      },
    };

    // ── Interpretation Layer (фоновая генерация, не блокирует ответ) ──
    generateEconomicsInterpretation(
      trend_id,
      niche,
      diagnosisToColor(result.diagnosis),
      result as unknown as Record<string, any>,
      supabase,
      claude,
    ).catch((err) =>
      console.error('[Block5 Interpretation] Background error:', err),
    );

    return NextResponse.json({ success: true, public: publicData });
  } catch (error: any) {
    console.error('[Block5v2] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
