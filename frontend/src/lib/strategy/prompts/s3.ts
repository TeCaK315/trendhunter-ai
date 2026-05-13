/**
 * TrendHunter AI — Промпт S3: Первые 10 клиентов v4
 * src/lib/strategy/prompts/s3.ts
 *
 * Изменения v4:
 * - S3 самый "готовый вторник" — дословный скрипт + тайминг + ожидания
 * - day_by_day с expected_result (DeepSeek)
 * - alternatives_rejected: почему не другие каналы
 * - ready_assets: полный outreach pack
 * - what_to_say_about_price: что ответить если клиент спросит цену (DeepSeek)
 * - Inline tagging в first_message_text
 * - bridge_from_s2
 * - Kill switch тон защиты (из v3 сохранено)
 */

import { buildActiveConstraintsPrompt, type Constraint } from '../constraints/index'
import type { StrategyContext } from '../block0'
import { CHANNEL_ANCHORS, type ChannelType } from '../rule-engine'

function buildChannelAnchorsText(channels: ChannelType[]): string {
  return channels.map(ch => {
    const a = CHANNEL_ANCHORS[ch]
    return `  ${ch}: цикл ${a.min_days}-${a.max_days} дней, бюджет $${a.min_budget}/мес`
  }).join('\n')
}

export function buildS3Prompt(params: {
  dataJson: string
  context: StrategyContext
  constraints: Constraint[]
}): string {
  const { dataJson, context, constraints } = params

  const activeConstraints = buildActiveConstraintsPrompt(constraints)
  const isExperiment = context.strategy_mode === 'experiment_mode'
  const availableChannels = context.available_channels
  const channelAnchorsText = buildChannelAnchorsText(availableChannels)

  const requiresPaidBudgetFalse = constraints.some(
    c => c.type === 'REQUIRES_PAID_BUDGET' && c.value === false
  )
  const noSalesTeam = constraints.some(
    c => c.type === 'NO_SALES_TEAM_REQUIRED' && c.value === true
  )
  const maxKillSwitchDays = context.kill_switch.channel_days
  const maxChannelCost = constraints.find(c => c.type === 'MAX_MONTHLY_CHANNEL_COST')

  return `
${activeConstraints ? activeConstraints + '\n\n' : ''}
ЧАСТЬ 1 — РОЛЬ И ПРИНЦИП

Ты — специалист по первым продажам. Готовый вторник в полном виде.

S3 должен дать пользователю ВСЁ чтобы отправить первое сообщение СЕГОДНЯ:
- Канал (из доступных) с объяснением
- Дословный скрипт (копировать и отправить)
- Day-by-day с тайминг и ожидаемыми результатами
- Ответ на "а сколько стоит?"
- Kill switch как защита

Принцип: раз founder 2 часа утром — он должен успеть запустить канал за эти 2 часа.


ЧАСТЬ 2 — DATA

- strategy_context: segment, kill_switch.channel_days = ${maxKillSwitchDays},
  available_channels = [${availableChannels.map(c => `"${c}"`).join(', ')}]
- research: sale_cycle_days, acquisition_type, cac_mid, cac_scenarios, experiment_budget
- from_s0: positioning_angle, target_segment, barrier_type
- from_s1: client_profile_short, where_to_find, primary_trigger,
  validation_signal, target_company_size_max, price_point_monthly
- from_s2: v1_feature_name, barrier_mechanism, minimum_artifact

${dataJson}


ЧАСТЬ 3 — INLINE TAGGING

В first_message_text оборачивай 1-2 ключевые фразы:
- Конкретная боль из primary_trigger
- Название v1_feature_name

Теги делают key facts hover-able в UI.


ЧАСТЬ 4 — ПРАВИЛА

[ШАГ 1] ВЫБЕРИ КАНАЛ:
${channelAnchorsText}

   [P1] kill_switch.channel_days < мин. цикла → канал НЕДОСТУПЕН
   [P2] ${requiresPaidBudgetFalse ? 'REQUIRES_PAID_BUDGET=false → только PLG, COMMUNITY, SEO' : 'Без ограничений'}
   [P3] Из оставшихся: где клиент из from_s1.where_to_find
   [P4] Наименьший цикл

[ШАГ 2] ALTERNATIVES_REJECTED — почему НЕ другие каналы:
   Для каждого channel из available_channels кроме выбранного:
   - Если REQUIRES_PAID_BUDGET=false и канал платный: "Требует бюджет, у тебя $0"
   - Если цикл канала > kill_switch.channel_days: "Цикл X дней — не успеешь проверить"
   - Если канал не совпадает с where_to_find из S1: "Клиент не там"

[ШАГ 3] FIRST_MESSAGE_TEXT — дословный скрипт без плейсхолдеров:

   OUTBOUND_COLD:
   Структура: [конкретный контекст] + [боль из trigger] + [один вопрос]
   Используй primary_trigger из S1 дословно.

   COMMUNITY:
   Структура: [аутентичный контекст] + [боль] + [открытый вопрос]
   Пример: "У нас <t id=\"claim_0\">Stripe webhook сломался в пятницу</t>,
   клиенты не смогли оплатить. Решили через <t id=\"claim_1\">v1_feature_name</t>.
   Кто ещё с этим сталкивался?"

   PLG:
   Структура: [польза] + [время до результата] + [CTA]

   SEO: first_message_text = "SEO канал — контент, не прямое сообщение"

[ШАГ 4] DAY_BY_DAY — тайминг + ожидаемый результат:

   Для каждого дня:
   {
     "day": "1",
     "morning_action": "что делать утром (конкретно)",
     "target": "N действий (50 сообщений / 10 комментариев)",
     "expected_result": "ожидание к концу дня (реалистичное)",
     "if_below_expected": "микрокоррекция"
   }

   День 1: первые контакты + количество
   День 3: первая проверка + что делать если мало откликов
   День 7: либо звонки, либо признание что тактика не работает
   День 14: финальная оценка kill switch

[ШАГ 5] WHAT_TO_SAY_ABOUT_PRICE:
   Критично! Founder не знает что ответить на "а сколько стоит?".

   Формат:
   {
     "when_asked": "конкретная фраза для ответа",
     "why_this_price": "объяснение для себя (не клиенту)"
   }

   Пример:
   when_asked: "Обычно $299/мес, но на старте $49 — собираем фидбек от первых 20 клиентов"
   why_this_price: "Цена из price_point_monthly из S1. Скидка для создания пилотов."

[ШАГ 6] KILL SWITCH КАК ЗАЩИТА:
   Тон: "Если [метрика] не достигнута за [дни] — хорошая новость: узнал что X не работает.
   Следующий шаг: [конкретная альтернатива]."

ПРАВИЛА ЧИСЕЛ:

sale_cycle_fit_days:
   МИН = мин. якорь выбранного канала
   МАКС = ${maxKillSwitchDays} дней

${requiresPaidBudgetFalse
  ? 'requires_paid_budget = false. channel_monthly_tool_cost = 0.'
  : `Максимум $${maxChannelCost?.value ?? 'не указан'}/мес`}

${noSalesTeam ? 'requires_sales_team = false.' : ''}

${isExperiment ? 'is_hypothesis = true.' : 'is_hypothesis = false.'}

READY_ASSETS — полный outreach pack:
- Дословный скрипт для первого сообщения
- 2 follow-up варианта (если не ответил за 3 дня, за 7 дней)
- Что ответить если "не интересно" (reframe)
- Заголовок для поста на Reddit (если COMMUNITY)

SO_WHAT_FOR_YOU:
"Через 14 дней ты либо получишь первых клиентов, либо сэкономишь месяц жизни
и $0 — и пойдёшь к альтернативе [конкретный channel]."

BRIDGE_FROM_S2:
"С продуктом из S2 готов — теперь нужно чтобы о нём узнал
[клиент из S1]. Вот канал где он уже страдает от [триггер]."

AI_LEVERAGE:
Автоматизация outreach/мониторинга.
Пример: "Lemlist для OUTBOUND — 50 персонализированных сообщений за час.
Или GummySearch для COMMUNITY — мониторит Reddit на 'webhook failing'."

DATA_TRACE с Enum:
- MARKET_DATA, COMPETITOR_SCAN, CALCULATION, STRATEGIC_LOGIC, USER_PROFILE


ЧАСТЬ 5 — АБСОЛЮТНЫЕ ЗАПРЕТЫ

- channel_type не из available_channels
- Скрипт с плейсхолдерами [вставить ниша], [название]
- day_by_day без expected_result или тайминг
- what_to_say_about_price = null или абстракция
- Kill switch тон угрозы ("если провалишься")
- data_trace без Enum method
- Незакрытые теги
- Текст вне JSON


ЧАСТЬ 6 — FORCED SPECIFICITY CHECK + ЗАДАЧА

Внутренняя проверка:

ШАГ 1: first_message_text — плейсхолдеры [...]?
        Заменить конкретными данными из DATA.

ШАГ 2: day_by_day — каждый день имеет expected_result?
        "Продолжать работу" — НЕ результат. "3+ ответа" — результат.

ШАГ 3: what_to_say_about_price.when_asked — можно скопировать и произнести?
        Если абстрактно — переписать дословно.

ШАГ 4: kill_switch_description — защита или угроза?

ШАГ 5: Теги закрыты, уникальны, в data_trace?


ЗАДАЧА — верни ТОЛЬКО валидный JSON:

{
  "channel_type": "${availableChannels[0]}",
  "channel_description": "ПОЧЕМУ этот канал: данные + где клиент + почему не создавать спрос",

  "alternatives_rejected": [
    { "option": "канал", "reason": "конкретная причина" }
  ],

  "first_message_text": "Дословный скрипт с тегами. Готов к отправке. Использует primary_trigger + v1_feature_name.",

  "day_by_day": [
    {
      "day": "1",
      "morning_action": "конкретное действие утром",
      "target": "число + метрика",
      "expected_result": "реалистичное ожидание к вечеру",
      "if_below_expected": "микрокоррекция"
    },
    {
      "day": "3",
      "morning_action": "...",
      "target": "...",
      "expected_result": "...",
      "if_below_expected": "..."
    },
    {
      "day": "7",
      "morning_action": "...",
      "target": "...",
      "expected_result": "...",
      "if_below_expected": "..."
    },
    {
      "day": "14",
      "morning_action": "финальная оценка + решение",
      "target": "сравнить с kill_switch threshold",
      "expected_result": "решение продолжить/менять",
      "if_below_expected": "переход к альтернативе"
    }
  ],

  "what_to_say_about_price": {
    "when_asked": "дословная фраза для ответа",
    "why_this_price": "объяснение для пользователя (не клиенту)"
  },

  "ready_assets": [
    "Скрипт первого сообщения",
    "Follow-up 1 (день 3)",
    "Follow-up 2 (день 7)",
    "Reframe для 'не интересно'",
    "Заголовок поста (если COMMUNITY)"
  ],

  "kill_switch_description": "Защита: если [метрика] < [число] за [дни] — узнал что X. Следующий шаг: [альтернатива].",
  "success_criteria": "как выглядит успех через ${maxKillSwitchDays} дней — число + метрика",

  "so_what_for_you": "1-2 предложения — что даёт пользователю",
  "bridge_from_s2": "1 предложение — связь с продуктом из S2",

  "requires_paid_budget": ${requiresPaidBudgetFalse ? 'false' : 'boolean'},
  "requires_sales_team": ${noSalesTeam ? 'false' : 'boolean'},
  "sale_cycle_fit_days": "integer",
  "channel_monthly_tool_cost": "number или null",

  "channel_kill_switch_signal": {
    "metric": "response_rate | meetings_booked | signups | conversion_rate",
    "threshold": "number",
    "time_window_days": "integer ≤ ${maxKillSwitchDays}"
  },

  "data_trace": [
    { "claim_id": "claim_0", "method": "MARKET_DATA: ..." }
  ],

  "is_hypothesis": ${isExperiment ? 'true' : 'false'},

  "ai_leverage": {
    "tool": "название",
    "task": "задача для этого канала и ниши",
    "why": "что автоматизирует, сколько экономит"
  }
}
`.trim()
}
