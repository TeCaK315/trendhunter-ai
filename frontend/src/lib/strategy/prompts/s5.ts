/**
 * TrendHunter AI — Промпт S5: Путь к деньгам v4
 * src/lib/strategy/prompts/s5.ts
 *
 * Изменения v4:
 * - S5 становится "ГОТОВЫМ ВТОРНИКОМ" с ценовым якорем
 * - price_anchor_for_conversation: что сказать клиенту о цене (DeepSeek)
 * - ready_assets: timeline calculator, kill switch card, pricing card
 * - Inline tagging в cac_explanation
 * - bridge_from_s3
 * - first_action_today остаётся — буквально одно предложение отправить сегодня
 * - CAC рыночный vs реальный (из v3 сохранено)
 * - Цена всегда число (из v3 сохранено)
 */

import { buildActiveConstraintsPrompt, type Constraint } from '../constraints/index'
import type { StrategyContext } from '../block0'

export const BARRIER_TIMELINE_MULTIPLIERS: Record<string, number> = {
  NETWORK_EFFECT: 1.3,
  DATA_MOAT:      1.2,
  WORKFLOW_LOCK:  1.0,
  SWITCHING_COST: 1.0,
  SPEED:          0.85,
}

export function computeKillSwitchDate(
  currentDate: string,
  experimentDays: number
): string {
  const date = new Date(currentDate)
  date.setDate(date.getDate() + experimentDays)
  return date.toISOString().split('T')[0]
}

export function buildS5Prompt(params: {
  dataJson: string
  context: StrategyContext
  constraints: Constraint[]
  barrierType: string
}): string {
  const { dataJson, context, constraints, barrierType } = params

  const activeConstraints = buildActiveConstraintsPrompt(constraints)
  const isExperiment = context.strategy_mode === 'experiment_mode'
  const isLimited    = context.data_sufficiency === 'LIMITED'

  const killSwitchDate = computeKillSwitchDate(
    context.current_date,
    context.kill_switch.experiment_days
  )

  const multiplier = BARRIER_TIMELINE_MULTIPLIERS[barrierType] ?? 1.0
  const multiplierNote = multiplier > 1
    ? `${barrierType} замедляет (×${multiplier}) — требует накопления`
    : multiplier < 1
      ? `${barrierType} ускоряет (×${multiplier}) — скорость = сигнал`
      : `${barrierType} — стандартный таймлайн`

  return `
${activeConstraints ? activeConstraints + '\n\n' : ''}
ЧАСТЬ 1 — РОЛЬ И ПРИНЦИП

Ты финансовый аналитик. Готовый вторник до уровня "какую сумму назвать клиенту".

S5 даёт пользователю:
- Чёткий timeline с датами
- Цена ВСЕГДА число (никогда null)
- CAC объяснён: рыночный vs реальный через канал
- Дата kill switch = дата решения (не провала)
- first_action_today — буквально ОДНА строка для отправки
- price_anchor_for_conversation — что сказать клиенту про цену

Принцип: противоречия убивают доверие. CAC $7000 + канал $0 без объяснения = тупик.
Объяснение снимает противоречие.

Kill switch дата вычислена: ${killSwitchDate}
Используй дословно. Не пересчитывай.


ЧАСТЬ 2 — DATA

- strategy_context: current_date = "${context.current_date}",
  kill_switch.experiment_days = ${context.kill_switch.experiment_days},
  segment, data_sufficiency
- research: revenue_mid/low/high, cac_mid, cac_scenarios,
  months_to_first_revenue, experiment_budget, payback_months,
  main_economic_risk, revenue_quality, price_range_median, sale_cycle_days
- from_s0: is_hypothesis, condition, barrier_type
- from_s1: validation_signal, price_point_monthly, price_source
- from_s2: estimated_build_cost, v1_feature_name, first_build_step, requires_team
- from_s3: channel_type, sale_cycle_fit_days, channel_kill_switch_signal,
  first_message_text, what_to_say_about_price

${dataJson}


ЧАСТЬ 3 — INLINE TAGGING

В cac_explanation и timeline_description оборачивай 2-3 фразы:
- Конкретный CAC (рыночный и реальный)
- Дата kill switch
- Цена в долларах

Каждый claim_id → data_trace.


ЧАСТЬ 4 — ПРАВИЛА

1. TIMELINE:
   BASE = research.months_to_first_revenue × 30
   Корректировка: ${multiplierNote}
   Итог = BASE × ${multiplier}, не менее sale_cycle_fit_days
   Округлить до целых дней.

   timeline_description — путь по шагам:
   "День 1-3: [действие из S3 day_1]"
   "День 4-14: [проверка kill switch]"
   "День 15-30: [если сигнал получен]"
   "День 31+: [первые деньги]"

2. CAC_EXPLANATION — всегда объясняй какой:
   "<t id=\"claim_0\">Рыночный CAC в нише через [recommended_channel]: $[cac_mid]</t>.
   Через [channel_type из S3]: <t id=\"claim_1\">$[cac_scenarios.channel.mid]</t> —
   это стоимость инструментов + твоё время, не рекламный бюджет."

   Если cac_mid = null:
   "Точный рыночный CAC не раскрыт конкурентами. Через [channel_type]:
   $[из cac_scenarios] — реалистичная оценка для схожих ниш."

3. ЦЕНА — всегда число:
   [P1] from_s1.price_point_monthly → использовать
   [P2] research.price_range_median → использовать
   [P3] Если оба null → cac_scenarios.[channel].mid × 3
   НИКОГДА не null.

4. PRICE_ANCHOR_FOR_CONVERSATION (КРИТИЧНО, DeepSeek):
   Что сказать клиенту если спросит цену. Дословно.

   {
     "standard_price": "число/мес",
     "launch_price": "число/мес (скидка для первых)",
     "what_to_say": "Дословная фраза. Пример: 'Обычно $299/мес, на старте $49 — собираем фидбек от первых 20.'",
     "when_to_raise_price": "условие для перехода на standard"
   }

   Используй what_to_say_about_price из S3 как базу, но добавь детали
   (стандартная цена, условие повышения).

5. FIRST_ACTION_TODAY — буквально одна строка:
   Используй from_s3.first_message_text как базу.
   Выдай ПЕРВОЕ ПРЕДЛОЖЕНИЕ которое пользователь отправит сегодня.

   Пример: "Зайди в r/n8n прямо сейчас и напиши: 'У нас Stripe webhook
   сломался в пятницу — v1_feature_name починил за 10 минут.
   Кто ещё через это проходил?'"

   Одна строка. Не план. Не задача.

6. MILESTONE_30_DAYS / 90_DAYS — из S3:
   milestone_30 = expected_result из day_14 S3 + прогресс
   milestone_90 = 3 платящих клиента ИЛИ признание что канал не работает

7. KILL_SWITCH = ДАТА РЕШЕНИЯ:
   Тон: "${killSwitchDate} — дата когда ты смотришь на данные и принимаешь решение.
   Не дата провала. Дата информированного выбора.
   Если [metric из S3] < [threshold] → узнал что X. Следующий шаг: [альтернатива]."

8. SCENARIO_IF_BEHIND:
   НЕ "пересмотри стратегию".
   ДА "Смени канал с [S3.channel_type] на [альтернативный].
   Или снизь цену до $[X]. Или сузь ICP до [подсегмент]."

9. READY_ASSETS для S5:
   - Шаблон еженедельного трекинга (what to measure)
   - Calculator params (цена, CAC, timeline) для аналитики
   - Dashboard structure (как визуализировать прогресс)
   - Script для pivot решения в kill switch дату

10. SO_WHAT_FOR_YOU:
    "К ${killSwitchDate} у тебя будут данные для решения без эмоций.
    Без этой даты — будешь тонуть в нише годами без ответа."

11. BRIDGE_FROM_S3:
    "Канал из S3 запущен — теперь нужно измерять чтобы в ${killSwitchDate}
    принять решение с данными, не интуицией."

12. ${isExperiment ? 'is_hypothesis = true. Kill switch = бинарное решение.' : 'is_hypothesis = false.'}

13. ${isLimited
    ? `option_conservative: timeline × 1.5, что задержало
option_optimistic: timeline × 0.7, что ускорило`
    : 'null.'}

14. DATA_TRACE с Enum methods:
    - MARKET_DATA, COMPETITOR_SCAN, CALCULATION, STRATEGIC_LOGIC, USER_PROFILE


ЧАСТЬ 5 — АБСОЛЮТНЫЕ ЗАПРЕТЫ

- Пересчитывать experiment_kill_switch_date (вычислена: ${killSwitchDate})
- CAC без объяснения какой (рыночный или реальный)
- Противоречия: высокий CAC + $0 канал без разграничения
- calculator_params.monthly_price = null
- price_anchor_for_conversation.what_to_say = абстрактно
- first_action_today как задача ("создай план")
- Kill switch тон провала
- data_trace.method со словами "данных нет"
- Незакрытые теги
- Текст вне JSON


ЧАСТЬ 6 — FORCED SPECIFICITY CHECK + ЗАДАЧА

Внутренняя проверка:

ШАГ 1: calculator_params.monthly_price = null?
        Рассчитать из CAC × 3.

ШАГ 2: first_action_today — одна строка для копирования?
        Не "составь план", не "подготовь". Конкретное сообщение.

ШАГ 3: kill_switch_description — слова "провал", "неудача"?
        Заменить на "дата решения", "узнали что".

ШАГ 4: price_anchor_for_conversation.what_to_say — можно произнести клиенту?

ШАГ 5: cac_explanation — разграничен рыночный и реальный?


ЗАДАЧА — верни ТОЛЬКО валидный JSON:

{
  "timeline_description": "Путь по дням — конкретно с числами",

  "cac_explanation": "С тегами. Рыночный: <t id=\\"claim_0\\">$X через канал Y</t>. Реальный через [channel_type]: <t id=\\"claim_1\\">$Z</t>. Разница: объяснение",

  "timeline_to_first_revenue_days": "integer",

  "milestone_30_days": "число + метрика + результат",
  "milestone_90_days": "число + метрика + результат",
  "success_metric_30": "измеримая метрика",
  "success_metric_90": "измеримая метрика",

  "kill_switch_description": "Дата решения ${killSwitchDate}: если [метрика] < [порог] — узнал что X. Следующий шаг: [альтернатива]",
  "experiment_kill_switch_date": "${killSwitchDate}",

  "scenario_if_behind": "Конкретный план Б: смени X на Y",

  "price_anchor_for_conversation": {
    "standard_price": "число/мес",
    "launch_price": "число/мес",
    "what_to_say": "дословная фраза для клиента",
    "when_to_raise_price": "условие"
  },

  "first_action_today": "Буквально одна строка для копирования и отправки сегодня",

  "calculator_params": {
    "monthly_price": "число в USD (НЕ null)",
    "price_source": "MARKET_DATA | CALCULATION | STRATEGIC_LOGIC",
    "cac_market": "рыночный CAC из research.cac_mid или null",
    "cac_real": "реальный CAC через канал из cac_scenarios",
    "months_to_first_revenue": "из research"
  },

  "ready_assets": [
    "Шаблон еженедельного трекинга",
    "Calculator для unit-economics",
    "Dashboard structure",
    "Script для pivot решения"
  ],

  "so_what_for_you": "1-2 предложения — что даёт пользователю",
  "bridge_from_s3": "1 предложение — связь с каналом из S3",

  "data_trace": [
    { "claim_id": "claim_0", "method": "MARKET_DATA: ..." },
    { "claim_id": "claim_1", "method": "CALCULATION: ..." }
  ],

  "is_hypothesis": ${isExperiment ? 'true' : 'false'},

  "ai_leverage": {
    "tool": "название",
    "task": "задача трекинга для этой ниши",
    "why": "что трекает, как помогает kill switch решению"
  },

  "option_conservative": ${isLimited ? '{ "timeline_days": "integer", "condition": "string" }' : 'null'},
  "option_optimistic": ${isLimited ? '{ "timeline_days": "integer", "condition": "string" }' : 'null'}
}
`.trim()
}
