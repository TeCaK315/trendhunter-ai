/**
 * TrendHunter AI — Партнёрский переводчик S0-S5 (v2)
 * src/lib/strategy/prompts/translator.ts
 *
 * Изменения v2:
 * - TranslatorOutput разделён на общую часть (CommonFields) + BlockSpecificFields
 * - Каждый блок получает свои поля: S0.alternatives_rejected, S1.filter_questions,
 *   S2.ready_assets, S3.day_by_day + first_message, S5.timeline + calculator
 * - Промпт генерирует И партнёрский язык И специфичные поля блока
 * - Переводчик больше не "теряет" block-specific данные из raw v4.1 — они проходят через него
 */

import type { BlockId } from '../block0'

// ═════════════════════════════════════════════════════════════════════
// INPUT
// ═════════════════════════════════════════════════════════════════════

export interface TranslatorInput {
  block_id: BlockId
  block_raw_output: Record<string, unknown>
  research_data: Record<string, unknown>
  user_profile: {
    niche_title: string
    resource_profile: string
    weekly_hours: number
    budget_total: number
    technical_skill: string
  }
  synthesis_verdict: 'go_if' | 'experiment_if' | 'no_go_until'
  confidence: number
}

// ═════════════════════════════════════════════════════════════════════
// OUTPUT — общая часть (есть во всех блоках S0-S5)
// ═════════════════════════════════════════════════════════════════════

export interface CommonTranslatorFields {
  headline: string
  opening_story: string
  main_insight: string
  why_it_works: string
  what_you_do: {
    action: string
    goal: string
    success_criterion: string
    fallback_if_not: string
  }
  your_numbers: Array<{
    metric_name: string
    human_translation: string
    comparison: string
  }>
  ai_agent_card: {
    role: string
    replaces_job: string
    hours_saved: string
    what_for_niche: string
    status: 'activates_in_roadmap'
  } | null
  bridge_to_next: string
  honest_limitation: string
}

// ═════════════════════════════════════════════════════════════════════
// S0 — Угол атаки
// ═════════════════════════════════════════════════════════════════════

export interface S0SpecificFields {
  positioning_quote: string  // Якорная фраза для клиента

  versus_block: {
    them: { name: string; size: string; weakness: string; source: string }
    you: { description: string; advantage: string; window_months: string }
  }

  alternatives_rejected: Array<{
    option: string        // "NETWORK_EFFECT"
    human_name: string    // "Сетевой эффект"
    reason: string
  }>
}

// ═════════════════════════════════════════════════════════════════════
// S1 — Первый клиент
// ═════════════════════════════════════════════════════════════════════

export interface S1SpecificFields {
  client_portrait: {
    who: string
    when_searching: string
    pain_moment: string
    where_to_find: string
  }

  filter_questions: Array<{
    question: string
    qualifying_answer: string
    why_matters: string
  }>  // length = 3

  price_point: {
    monthly: number
    explanation: string
    comparison: string
  }

  primary_trigger: string
}

// ═════════════════════════════════════════════════════════════════════
// S2 — V1 Продукт
// ═════════════════════════════════════════════════════════════════════

export interface S2SpecificFields {
  core_feature: {
    name: string
    description: string
    why_this_one: string
  }

  not_in_v1: Array<{ what: string; why: string }>  // min 3

  first_build_step: string

  ready_assets: Array<{
    name: string
    purpose: string
    cost: string  // "free" / "$29/мес"
  }>  // min 3

  estimated_cost: {
    amount: number
    time_weeks: string
    context: string
  }
}

// ═════════════════════════════════════════════════════════════════════
// S3 — Первые 10 клиентов
// ═════════════════════════════════════════════════════════════════════

export interface S3SpecificFields {
  channel: {
    type: string          // "COMMUNITY"
    human_name: string    // "Сообщества разработчиков"
    where_exactly: string // "r/sysadmin + r/devops"
    why_this_one: string
  }

  first_message: {
    text: string          // Дословно что написать (копируется)
    when_to_send: string
    how_to_adapt: string
  }

  day_by_day: Array<{
    day: string           // "День 1", "День 3", "День 7", "День 14"
    action: string
    target: string
    expected: string
    if_below: string
  }>  // length = 4

  price_conversation: {
    standard_price: string
    launch_price: string
    what_to_say: string
    when_to_raise: string
  }

  kill_switch: {
    metric_human: string
    threshold: number
    time_window: string
    what_to_do_then: string
  }
}

// ═════════════════════════════════════════════════════════════════════
// S5 — Путь к деньгам
// ═════════════════════════════════════════════════════════════════════

export interface S5SpecificFields {
  timeline: {
    days_to_first_revenue: number
    human_text: string
    what_happens_weekly: string
  }

  milestones: {
    day_30: { what: string; success_metric: string }
    day_90: { what: string; success_metric: string }
  }

  calculator: {
    monthly_price: number
    cac_real: number
    months_to_revenue: number
    human_math: string
  }

  first_action_today: {
    what: string
    time_needed: string
    result: string
  }

  if_behind: {
    signs: string
    what_to_do: string
  }

  kill_switch_date: string          // YYYY-MM-DD
  kill_switch_explanation: string
}

// ═════════════════════════════════════════════════════════════════════
// COMBINED OUTPUT
// ═════════════════════════════════════════════════════════════════════

export type TranslatorOutput =
  | (CommonTranslatorFields & { block_id: 'S0'; specific: S0SpecificFields })
  | (CommonTranslatorFields & { block_id: 'S1'; specific: S1SpecificFields })
  | (CommonTranslatorFields & { block_id: 'S2'; specific: S2SpecificFields })
  | (CommonTranslatorFields & { block_id: 'S3'; specific: S3SpecificFields })
  | (CommonTranslatorFields & { block_id: 'S5'; specific: S5SpecificFields })

// ═════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═════════════════════════════════════════════════════════════════════

export function buildTranslatorPrompt(input: TranslatorInput): string {
  const { block_id, block_raw_output, research_data, user_profile, synthesis_verdict, confidence } = input

  const toneCalibration = getToneCalibration(synthesis_verdict, confidence)
  const blockContext = getBlockContext(block_id)
  const specificFormat = getSpecificOutputFormat(block_id)

  return `Ты — партнёрский переводчик для стартап-платформы TrendHunter AI.

## ТВОЯ РОЛЬ

Пользователь только что получил технически корректный, но СУХОЙ анализ блока ${block_id} (${blockContext.title}).
Он solo-founder, устал, хочет действовать но боится ошибиться.

Задача — переписать технический output в язык ПАРТНЁРА:
- Не аналитик который вещает термины
- А старший товарищ который объясняет на пальцах: что происходит, почему это важно ЛИЧНО ему, что с этим делать

## ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ

Ниша: ${user_profile.niche_title}
Ресурсы: ${user_profile.resource_profile}
Часов в неделю: ${user_profile.weekly_hours}
Бюджет: $${user_profile.budget_total}
Навыки: ${user_profile.technical_skill}

## КАЛИБРОВКА ТОНА

Verdict: ${synthesis_verdict}
Confidence: ${Math.round(confidence * 100)}%

${toneCalibration}

## 4 ПРАВИЛА ЯЗЫКА (обязательны)

### Правило 1: Переводи данные в картины
Любое число → действие + время + знакомое сравнение.
ПЛОХО: "CAC через community $173"
ХОРОШО: "Чтобы найти одного клиента через сообщества — 4 часа твоего времени за 2 недели. В 3-5 раз дешевле платной рекламы."

### Правило 2: Разделяй задача / цель / критерий / план Б
Каждое действие — маленькая история с концом.
В what_you_do обязательны все 4 поля: action, goal, success_criterion, fallback_if_not.

### Правило 3: Объясняй "почему именно так"
Не декларируй. Показывай логику через историю.
ПЛОХО: "Барьер — SPEED"
ХОРОШО: "Твоё преимущество — скорость. У конкурента 1000 сотрудников, решения утверждаются месяцами. Ты один — обновление за 3 дня. Это окно на 6-18 месяцев."

### Правило 4: Калибруй уверенность
Честно обозначай где данные, где гипотеза.
Низкий confidence → тон "давай проверим", не "вот твой путь".
Никогда не обещай конкретных цифр дохода — только диапазоны.

## SAFEGUARDS (строго запрещено)

1. **НЕ выдумывай конкурентов** — если в данных нет явного большого игрока, меняй нарратив на "фрагментированный рынок".
2. **НЕ обещай точных цифр дохода** — только диапазоны.
3. **НОРМАЛИЗУЙ провал заранее** — "первые 10 попыток скорее всего проигнорируют — это база", не "это провал".
4. **При слабых данных не расцвечивай** — лучше скучная правда чем красивая выдумка.
5. **НЕ используй метрики которых нет в Research** — если нет cac_scenarios, не придумывай CAC.
6. **НЕ пиши "$X/мес зарплаты AI команды"** — валюта часы рутины, не доллары зарплат.
7. **НЕ обещай интерактив "нажми чтобы запустить"** — в Стратегии агенты визитная карточка, в Роадмапе работают.

## КОНТЕКСТ БЛОКА ${block_id}

${blockContext.purpose}

## ВХОДНЫЕ ДАННЫЕ

### Raw output v4.1 блока:
\`\`\`json
${JSON.stringify(block_raw_output, null, 2)}
\`\`\`

### Research data:
\`\`\`json
${JSON.stringify(simplifyResearch(research_data), null, 2)}
\`\`\`

## ФОРМАТ ВЫХОДНОГО JSON

Верни строго JSON. Все поля обязательны. Специфика блока ${block_id} — в поле \`specific\`.

\`\`\`json
{
  "block_id": "${block_id}",

  "headline": "Краткий цепляющий заголовок блока в партнёрском тоне",
  "opening_story": "2-3 предложения: что происходит на рынке в контексте этого блока",
  "main_insight": "Главная мысль блока. Что пользователю надо усвоить.",
  "why_it_works": "Объяснение логики через историю (Правило 3)",

  "what_you_do": {
    "action": "Что конкретно делаешь",
    "goal": "Что получишь",
    "success_criterion": "Как поймёшь что получилось",
    "fallback_if_not": "Что это значит если не получилось (нормализация провала)"
  },

  "your_numbers": [
    {
      "metric_name": "Человеческое название метрики",
      "human_translation": "Число переведённое в действие/время",
      "comparison": "Сравнение со знакомым"
    }
  ],

  "ai_agent_card": {
    "role": "Твой аналитик / копирайтер / продакт",
    "replaces_job": "Эту задачу обычно делает маркетолог",
    "hours_saved": "14 часов скроллинга → 20 минут",
    "what_for_niche": "Конкретно под твою нишу делает X",
    "status": "activates_in_roadmap"
  },

  "bridge_to_next": "Мостик к следующему блоку",
  "honest_limitation": "Что может пойти не так и как это воспринимать",

  "specific": ${specificFormat}
}
\`\`\`

Никаких объяснений вне JSON. Только JSON.
`
}

// ═════════════════════════════════════════════════════════════════════
// BLOCK-SPECIFIC OUTPUT FORMAT
// ═════════════════════════════════════════════════════════════════════

function getSpecificOutputFormat(block_id: BlockId): string {
  const formats: Record<BlockId, string> = {
    S0: `{
    "positioning_quote": "Якорная фраза: одно предложение которое пользователь скажет клиенту. Например: 'Мы делаем то же что ManageEngine, но настройка за 15 минут'",
    "versus_block": {
      "them": {
        "name": "Имя главного конкурента из research.b4.top_competitor",
        "size": "'1000+ сотрудников' или аналогичное",
        "weakness": "Структурная слабость — почему не догонит",
        "source": "Откуда взяли данные: 'LinkedIn, Glassdoor'"
      },
      "you": {
        "description": "'Соло + AI помощники' или подходящий под профиль",
        "advantage": "Твоё преимущество (скорость, гибкость)",
        "window_months": "'6-18 месяцев' — сколько у тебя форы"
      }
    },
    "alternatives_rejected": [
      { "option": "NETWORK_EFFECT", "human_name": "Сетевой эффект", "reason": "Solo + $0 бюджет — сеть не с чем запускать" },
      { "option": "DATA_MOAT", "human_name": "Данные как ров", "reason": "Нет давления собирать уникальные данные" }
    ]
  }`,

    S1: `{
    "client_portrait": {
      "who": "Кто конкретно (роль, размер команды): 'IT-специалист в команде 10-50 человек'",
      "when_searching": "Когда он ищет решение: 'Когда третью неделю воюет с настройкой ManageEngine'",
      "pain_moment": "В какой момент чувствует боль",
      "where_to_find": "Где его найти: 'r/sysadmin, G2 reviews с 1-2 звёздами'"
    },
    "filter_questions": [
      {
        "question": "Первый вопрос для фильтрации",
        "qualifying_answer": "Что должен ответить подходящий",
        "why_matters": "Зачем этот вопрос (партнёрское объяснение)"
      }
    ],
    "price_point": {
      "monthly": 120,
      "explanation": "Почему такая цена — человечески",
      "comparison": "В нише $100-200/мес. Ниже $100 воспринимают как несерьёзно"
    },
    "primary_trigger": "Что должно произойти чтобы человек начал искать"
  }`,

    S2: `{
    "core_feature": {
      "name": "Название фичи одной строкой",
      "description": "Что она делает (человеческим языком)",
      "why_this_one": "Почему именно эту, а не другую"
    },
    "not_in_v1": [
      { "what": "Что отбросили", "why": "Почему не в v1" }
    ],
    "first_build_step": "Что делаешь в первый день разработки",
    "ready_assets": [
      { "name": "Название библиотеки", "purpose": "Что даёт", "cost": "free или $X/мес" }
    ],
    "estimated_cost": {
      "amount": 400,
      "time_weeks": "3 недели",
      "context": "Из чего складывается стоимость"
    }
  }`,

    S3: `{
    "channel": {
      "type": "COMMUNITY",
      "human_name": "Сообщества разработчиков",
      "where_exactly": "Конкретное место: 'r/sysadmin + r/devops'",
      "why_this_one": "Почему именно этот канал"
    },
    "first_message": {
      "text": "Дословный текст первого сообщения который можно скопировать и отправить",
      "when_to_send": "Когда использовать",
      "how_to_adapt": "Как подстроить под конкретную ситуацию"
    },
    "day_by_day": [
      {
        "day": "День 1",
        "action": "Что делаешь утром",
        "target": "Целевая метрика",
        "expected": "Ожидаемый результат",
        "if_below": "Что если ниже — нормализуется"
      }
    ],
    "price_conversation": {
      "standard_price": "$120",
      "launch_price": "$60 первые 3 месяца",
      "what_to_say": "Дословно что сказать клиенту когда спросит цену",
      "when_to_raise": "Когда поднимать цену"
    },
    "kill_switch": {
      "metric_human": "'Откликов меньше 5%'",
      "threshold": 5,
      "time_window": "за 14 дней",
      "what_to_do_then": "Что делать если сработал — без паники"
    }
  }`,

    S5: `{
    "timeline": {
      "days_to_first_revenue": 42,
      "human_text": "'6 недель если канал пойдёт'",
      "what_happens_weekly": "Что должно происходить каждую неделю"
    },
    "milestones": {
      "day_30": {
        "what": "'5 разговоров с потенциальными клиентами'",
        "success_metric": "Как поймёшь что получилось"
      },
      "day_90": {
        "what": "'3-5 платящих клиента'",
        "success_metric": "Как поймёшь что получилось"
      }
    },
    "calculator": {
      "monthly_price": 120,
      "cac_real": 45,
      "months_to_revenue": 2,
      "human_math": "Словами что значат эти числа: 'Чтобы выйти на $1200/мес нужно 10 клиентов'"
    },
    "first_action_today": {
      "what": "Что делаешь в первые 2 часа после закрытия стратегии",
      "time_needed": "Сколько времени займёт",
      "result": "Что получишь"
    },
    "if_behind": {
      "signs": "Как понять что отстаёшь от плана",
      "what_to_do": "Что делать если отстаёшь"
    },
    "kill_switch_date": "YYYY-MM-DD (90 дней от сегодня по умолчанию)",
    "kill_switch_explanation": "Человеческое объяснение этой даты"
  }`,
  }

  return formats[block_id]
}

// ═════════════════════════════════════════════════════════════════════
// TONE CALIBRATION
// ═════════════════════════════════════════════════════════════════════

function getToneCalibration(
  verdict: 'go_if' | 'experiment_if' | 'no_go_until',
  confidence: number
): string {
  if (verdict === 'go_if' && confidence >= 0.7) {
    return `ТОН: уверенный. "Вот твой путь. Вот почему он работает. Давай идти."
Но не триумфальный. Партнёр не продаёт — он показывает.`
  }
  if (verdict === 'experiment_if' || (verdict === 'go_if' && confidence < 0.7)) {
    return `ТОН: гипотезный. "Это выглядит перспективно. Давай проверим — вот как."
Ключевые слова: "похоже", "предполагаем", "если подтвердится".`
  }
  if (verdict === 'no_go_until') {
    return `ТОН: осторожный. "Есть серьёзные ограничения. Сначала нужно проверить X."
Ключевые слова: "при условии", "сначала убедись", "риск в том что".`
  }
  return `ТОН: нейтральный. Партнёрский, без крайностей.`
}

// ═════════════════════════════════════════════════════════════════════
// BLOCK CONTEXT
// ═════════════════════════════════════════════════════════════════════

function getBlockContext(block_id: BlockId): { title: string; purpose: string } {
  const contexts: Record<BlockId, { title: string; purpose: string }> = {
    S0: {
      title: 'Угол атаки',
      purpose: `В S0 пользователь узнаёт СВОЙ угол входа в нишу.
- На что он давит? (боль клиентов)
- Против кого играет? (главный конкурент + его слабость)
- Почему именно он может выиграть?

Главное: "я понимаю против кого играю и почему у меня есть шанс".`,
    },
    S1: {
      title: 'Первый клиент',
      purpose: `В S1 пользователь узнаёт КТО его первый клиент.
- Живой портрет (роль, размер, боль, когда ищет)
- Где находится
- 3 фильтрующих вопроса
- Сколько готов платить

Главное: пользователь представил конкретного человека.`,
    },
    S2: {
      title: 'Продукт v1',
      purpose: `В S2 пользователь узнаёт ЧТО ИМЕННО построить.
- Одна главная функция
- Что НЕ в v1
- Первый шаг разработки
- Готовые ассеты
- Стоимость и срок

Главное: это выполнимо за 2-6 недель.`,
    },
    S3: {
      title: 'Первые 10 клиентов',
      purpose: `В S3 пользователь узнаёт КАК получить первых 10 клиентов.
- Конкретный канал
- Дословный скрипт
- План на 14 дней
- Что говорить о цене
- Когда остановиться

Главное: пользователь знает что написать первому человеку.`,
    },
    S5: {
      title: 'Путь к деньгам',
      purpose: `В S5 пользователь узнаёт ЧЕРЕЗ СКОЛЬКО появятся деньги.
- Таймлайн до первого дохода
- Вехи 30 и 90 дней
- Реальный CAC
- Что делать сегодня
- Kill switch с датой

Главное: реалистичная картина финансов.`,
    },
  }
  return contexts[block_id]
}

// ═════════════════════════════════════════════════════════════════════
// RESEARCH SIMPLIFICATION
// ═════════════════════════════════════════════════════════════════════

function simplifyResearch(research: Record<string, unknown>): Record<string, unknown> {
  return {
    niche: research['niche'],
    b1: {
      pain_clusters: (research['b1'] as any)?.pain_clusters ?? [],
      pain_type: (research['b1'] as any)?.pain_type,
      top_complaints: (research['b1'] as any)?.top_complaints ?? [],
      dynamics: (research['b1'] as any)?.dynamics,
    },
    b2: {
      rising_queries_ratio: (research['b2'] as any)?.rising_queries_ratio,
      has_hype_risk: (research['b2'] as any)?.has_hype_risk,
    },
    b3: {
      competition_intensity: (research['b3'] as any)?.competition_intensity,
    },
    b4: {
      top_competitor: (research['b4'] as any)?.top_competitor,
      top_complaints: (research['b4'] as any)?.top_complaints ?? [],
      gap_type: (research['b4'] as any)?.gap_type,
      entry_point: (research['b4'] as any)?.entry_point,
    },
    b5: {
      revenue_mid: (research['b5'] as any)?.revenue_mid,
      cac_scenarios: (research['b5'] as any)?.cac_scenarios,
      months_to_first_revenue: (research['b5'] as any)?.months_to_first_revenue,
      main_economic_risk: (research['b5'] as any)?.main_economic_risk,
    },
  }
}

// ═════════════════════════════════════════════════════════════════════
// VALIDATION
// ═════════════════════════════════════════════════════════════════════

export function validateTranslatorOutput(
  output: TranslatorOutput
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  // Safeguard 6: не должно быть "$X/мес" и подобного в ai_agent_card
  const agentText = JSON.stringify(output.ai_agent_card ?? {})
  if (/\$\d+K?\/мес/i.test(agentText) && !agentText.includes('часов')) {
    warnings.push('ai_agent_card содержит маркетинговую цифру $/мес — должно быть в часах')
  }

  // Safeguard 2: обещания точного дохода
  const allText = JSON.stringify(output)
  if (/заработаешь \$\d+/i.test(allText) || /получишь \$\d+(?!\s*-)/i.test(allText)) {
    warnings.push('Найдено обещание точной суммы дохода — используй диапазоны')
  }

  // Правило 2: все 4 поля what_you_do
  if (output.what_you_do) {
    const required = ['action', 'goal', 'success_criterion', 'fallback_if_not']
    for (const field of required) {
      const val = (output.what_you_do as any)[field]
      if (!val || typeof val !== 'string' || val.length < 10) {
        warnings.push(`what_you_do.${field} отсутствует или слишком короткий`)
      }
    }
  }

  // Safeguard 3: fallback_if_not нормализует провал
  if (output.what_you_do?.fallback_if_not &&
      !/сигнал|норм|база|обычно|скорее всего|первые|часть процесса/i.test(output.what_you_do.fallback_if_not)) {
    warnings.push('fallback_if_not не нормализует провал — должен показывать что неудача часть процесса')
  }

  // Block-specific validation
  if (output.block_id === 'S1') {
    const spec = output.specific as S1SpecificFields
    if (!spec?.filter_questions || spec.filter_questions.length !== 3) {
      warnings.push('S1.filter_questions должно быть ровно 3 вопроса')
    }
    if (!spec?.price_point?.monthly || spec.price_point.monthly <= 0) {
      warnings.push('S1.price_point.monthly должен быть положительным числом')
    }
  }

  if (output.block_id === 'S2') {
    const spec = output.specific as S2SpecificFields
    if (!spec?.not_in_v1 || spec.not_in_v1.length < 3) {
      warnings.push('S2.not_in_v1 должно быть минимум 3 элемента')
    }
    if (!spec?.ready_assets || spec.ready_assets.length < 3) {
      warnings.push('S2.ready_assets должно быть минимум 3 элемента')
    }
  }

  if (output.block_id === 'S3') {
    const spec = output.specific as S3SpecificFields
    if (!spec?.day_by_day || spec.day_by_day.length !== 4) {
      warnings.push('S3.day_by_day должно быть ровно 4 контрольных дня')
    }
    if (!spec?.first_message?.text || spec.first_message.text.length < 30) {
      warnings.push('S3.first_message.text слишком короткий (min 30 символов)')
    }
  }

  if (output.block_id === 'S5') {
    const spec = output.specific as S5SpecificFields
    if (!spec?.kill_switch_date || !/^\d{4}-\d{2}-\d{2}$/.test(spec.kill_switch_date)) {
      warnings.push('S5.kill_switch_date должна быть в формате YYYY-MM-DD')
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}
