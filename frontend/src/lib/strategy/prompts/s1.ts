/**
 * TrendHunter AI — Промпт S1: Первый клиент v4
 * src/lib/strategy/prompts/s1.ts
 *
 * Изменения v4:
 * - Inline tagging в profile_text (<t id="claim_N">)
 * - bridge_from_s0: явная ссылка на угол атаки
 * - so_what_for_you: выигрыш пользователя от правильного выбора клиента
 * - filter_questions: 3 конкретных вопроса для отсева любопытных (DeepSeek)
 * - data_trace с Enum методов
 * - price_point_monthly с обязательным source из Enum
 * - S1 остаётся направлением — но с конкретными фильтрами
 */

import { buildActiveConstraintsPrompt, type Constraint } from '../constraints/index'
import type { StrategyContext } from '../block0'

export function buildS1Prompt(params: {
  dataJson: string
  context: StrategyContext
  constraints: Constraint[]
}): string {
  const { dataJson, context, constraints } = params

  const activeConstraints = buildActiveConstraintsPrompt(constraints)
  const isExperiment = context.strategy_mode === 'experiment_mode'
  const isLimited    = context.data_sufficiency === 'LIMITED'
  const isB2C        = context.segment === 'B2C'

  const personRule = isB2C
    ? `B2C — "один человек" = конкретная жизненная ситуация.
   Формат: "[кто в жизни] который [что происходит сейчас] потому что [причина]"
   Пример: "Фрилансер-дизайнер который потерял главного клиента
   и понимает что следующий месяц закрыть нечем"`
    : `B2B — один человек с должностью + контекст компании + острая боль.
   Формат: "[должность] в [компания, размер] который сейчас [ситуация]"
   Пример: "CTO в SaaS 30 человек который утром обнаружил
   что Stripe webhook сломался в выходные и 3 клиента не смогли оплатить"`

  return `
${activeConstraints ? activeConstraints + '\n\n' : ''}
ЧАСТЬ 1 — РОЛЬ И ПРИНЦИП

Ты описываешь ОДНОГО КОНКРЕТНОГО ЧЕЛОВЕКА — не сегмент, не ICP.
Пользователь должен прочитать и подумать "я знаю таких людей".

S1 даёт НАПРАВЛЕНИЕ — портрет клиента и где его искать.
НЕ "готовый вторник" (это в S3 будет скрипт).
НО ДАЁТ 3 ФИЛЬТРУЮЩИХ ВОПРОСА для первого разговора — это критично.

Bridge из S0: этот блок должен явно использовать угол из S0
и показать кому именно этот угол решает проблему.


ЧАСТЬ 2 — DATA

DATA содержит:
- strategy_context: segment, condition, data_sufficiency, resource_profile
- research: paying_ratio, pain_clusters, top_complaints, gap_map,
  avg_switching_cost, price_range_median, sale_cycle_days, market_type,
  top_competitor, entry_point, cac_mid, cac_scenarios
- from_s0: positioning_angle, target_segment, barrier_type

${dataJson}


ЧАСТЬ 3 — INLINE TAGGING

В profile_text оборачивай 2-4 ключевые фразы в <t id="claim_0">...</t>

Оборачивай:
- Конкретные цифры (84%, 40% времени, 25 человек)
- Имена инструментов которые сломались (Stripe webhook, Zapier)
- Конкретные инциденты (потерял клиента, сломалась интеграция)

НЕ оборачивай:
- Абстрактные описания ("испытывает трудности")
- Общие фразы ("в этой нише")


ЧАСТЬ 4 — ПРАВИЛА

1. ОДИН ЧЕЛОВЕК:
${personRule}

2. БОЛЬ ИЗ ДАННЫХ:
   [P1] gap_map с MAX paying_ratio → эта боль в profile_text
   [P2] top_complaints[0] → конкретная цитата попадает в портрет
   [P3] pain_clusters[0] если нет других

3. TRIGGER — конкретный инцидент:
   Не абстрактная боль. Конкретное событие.
   Пример: "Клиент написал что не смог оплатить из-за webhook".

4. WHERE_TO_FIND — конкретное место:
   НЕ: "LinkedIn"
   ДА: "Reddit r/n8n, треды 'webhook failing' или 'integration broke'"

5. FILTER_QUESTIONS — 3 вопроса для первого разговора:
   Конкретные вопросы которые отсекают 90% любопытных.
   Для каждого: текст вопроса + что считается "правильным" ответом.

   Пример:
   {
     "question": "Сколько часов в неделю команда чинит интеграции?",
     "qualifying_answer": "≥5 часов — целевой клиент, <5 — не твой"
   }

6. VALIDATION_SIGNAL — число + единица + срок:
   "3 детальных ответа с описанием инцидента за 14 дней"

7. PRICE_POINT_MONTHLY — всегда число:
   [P1] research.price_range_median → использовать
   [P2] Если null → рассчитать из cac_scenarios:
        min_price = cac_scenarios.[recommended_channel].mid × 3
   НИКОГДА не null.

   price_source из Enum:
   - "MARKET_DATA": взято из research.price_range_median
   - "CALCULATION": рассчитано из CAC × 3
   - "STRATEGIC_LOGIC": минимум для окупаемости при данных параметрах

8. SO_WHAT_FOR_YOU:
   Не "вы найдёте правильного клиента".
   А "если не отфильтровать — потратишь 3 месяца на любопытных.
   С этими 3 вопросами — 30 минут чтобы понять за/против."

9. BRIDGE_FROM_S0:
   1 предложение: "Из твоего угла (S0) следует что клиент — [тип],
   потому что именно он страдает от [конкретная боль из угла]."

10. DATA_TRACE с Enum методов:
    - MARKET_DATA: из research (цитаты, проценты, имена)
    - COMPETITOR_SCAN: скан конкурентов
    - CALCULATION: расчёт цены из CAC
    - STRATEGIC_LOGIC: вывод из профиля/угла S0
    - USER_PROFILE: из strategy_context

    method — ВСЕГДА позитивное описание.

11. ${isExperiment ? 'EXPERIMENT: is_hypothesis = true.' : 'GO_MODE: is_hypothesis = false.'}

12. ${isLimited ? 'LIMITED: option_a/option_b ОБЯЗАТЕЛЬНЫ.' : 'SUFFICIENT: null.'}

13. AI_LEVERAGE — мониторинг для поиска клиента:
    Пример: "GummySearch мониторит Reddit по ключу 'webhook failing'.
    Настрой алерт — получишь список горячих лидов каждое утро."


ЧАСТЬ 5 — АБСОЛЮТНЫЕ ЗАПРЕТЫ

- "целевая аудитория", "сегмент рынка", "потенциальные клиенты"
- Описание группы вместо одного человека
- price_point_monthly = null
- data_trace.method со словами "данных не было"
- Незакрытые теги <t>
- Текст вне JSON


ЧАСТЬ 6 — FORCED SPECIFICITY CHECK + ЗАДАЧА

Внутренняя проверка:

ШАГ 1: Прочитай profile_text. Этого человека можно найти в интернете?
        Если нет — конкретизировать.

ШАГ 2: Прочитай trigger_explanation. В какой момент он открывает браузер?
        Должен быть конкретный инцидент, не состояние.

ШАГ 3: Прочитай filter_questions. Каждый вопрос отфильтровывает любопытных?
        Если вопрос можно задать любому — переписать.

ШАГ 4: Теги закрыты? claim_id уникальны? Соответствуют data_trace?


ЗАДАЧА — верни ТОЛЬКО валидный JSON:

{
  "profile_text": "3-5 предложений с INLINE TAGGING. Один конкретный человек с болью из данных. Пример: '<t id=\\"claim_0\\">CTO в SaaS-стартапе 25 человек</t>. Его команда <t id=\\"claim_1\\">тратит 40% времени на починку webhook</t>. <t id=\\"claim_2\\">Stripe сломался в пятницу, клиенты не смогли оплатить</t>.'",

  "trigger_explanation": "Конкретный инцидент — момент когда человек активно ищет решение",

  "where_to_find_text": "2-3 конкретных места — платформа + раздел + что искать",

  "filter_questions": [
    {
      "question": "Вопрос 1 для первого разговора",
      "qualifying_answer": "что считать правильным ответом"
    },
    {
      "question": "Вопрос 2",
      "qualifying_answer": "критерий"
    },
    {
      "question": "Вопрос 3",
      "qualifying_answer": "критерий"
    }
  ],

  "so_what_for_you": "1-2 предложения — выгода от правильного выбора клиента",

  "bridge_from_s0": "1 предложение — связь с углом из S0",

  "validation_signal": "ЧИСЛО + ЕДИНИЦА + СРОК",

  "price_point_monthly": "число в USD (не null)",
  "price_source": "MARKET_DATA | CALCULATION | STRATEGIC_LOGIC",
  "price_explanation": "откуда взята цена — 1 предложение",

  "target_segment": "${context.segment}",
  "target_company_size_max": ${isB2C ? 'null' : 'number или null'},

  "primary_trigger": "1 предложение — сжатый триггер для S3",
  "where_to_find": "краткий список мест для S3",
  "client_profile_short": "1-2 предложения — профиль для S2 и S3",

  "data_trace": [
    { "claim_id": "claim_0", "method": "MARKET_DATA: Анализ отзывов G2/Reddit" },
    { "claim_id": "claim_1", "method": "COMPETITOR_SCAN: скан конкурентов" }
  ],

  "is_hypothesis": ${isExperiment ? 'true' : 'false'},

  "ai_leverage": {
    "tool": "название инструмента",
    "task": "конкретная задача мониторинга в этой нише",
    "why": "что делает и сколько экономит"
  },

  "option_a": ${isLimited ? '{ "profile_text": "string", "condition": "string" }' : 'null'},
  "option_b": ${isLimited ? '{ "profile_text": "string", "condition": "string" }' : 'null'}
}
`.trim()
}
