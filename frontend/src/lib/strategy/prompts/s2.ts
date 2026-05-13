/**
 * TrendHunter AI — Промпт S2: v1 Продукт v4
 * src/lib/strategy/prompts/s2.ts
 *
 * Изменения v4:
 * - S2 становится "ГОТОВЫМ ВТОРНИКОМ" — конкретика до первого файла/промта
 * - first_build_step: буквально первая строка кода / первый промт (DeepSeek)
 * - ready_assets: массив готовых артефактов (GPT+DeepSeek)
 * - Inline tagging в feature_description
 * - bridge_from_s1: связь с клиентом из S1
 * - so_what_for_you: выгода от v1 vs альтернатив
 * - data_trace с Enum
 */

import { buildActiveConstraintsPrompt, type Constraint } from '../constraints/index'
import type { StrategyContext } from '../block0'

export function buildS2Prompt(params: {
  dataJson: string
  context: StrategyContext
  constraints: Constraint[]
}): string {
  const { dataJson, context, constraints } = params

  const activeConstraints = buildActiveConstraintsPrompt(constraints)
  const isExperiment = context.strategy_mode === 'experiment_mode'
  const isLimited    = context.data_sufficiency === 'LIMITED'
  const noTeamRequired = constraints.some(c => c.type === 'NO_TEAM_REQUIRED' && c.value === true)
  const maxBuildCost   = constraints.find(c => c.type === 'MAX_BUILD_COST')

  return `
${activeConstraints ? activeConstraints + '\n\n' : ''}
ЧАСТЬ 1 — РОЛЬ И ПРИНЦИП

Ты определяешь ЧТО строить в v1. Одна функция. И КАК начать СЕГОДНЯ.

S2 — это ГОТОВЫЙ ВТОРНИК. Пользователь должен после прочтения знать:
- Какую функцию делать и почему именно её
- Что она НЕ включает и почему
- Какой конкретный артефакт создать за 1-2 дня
- ПЕРВЫЙ ШАГ СЕГОДНЯ (первая строка кода или первый промт)
- Готовые активы: структура, шаблоны, примеры

Принцип: ranний founder ценит конкретику. "Направление" для него = откладывание.
Конкретика = "я сделаю это завтра в 8 утра".


ЧАСТЬ 2 — DATA

DATA содержит:
- strategy_context: strategy_mode, segment, resource_profile, experiment_budget
- research: gap_map, gap_type, top_complaints, acquisition_type,
  avg_switching_cost, price_model, friction_score, sale_cycle_days,
  priority_actions
- from_s0: positioning_angle, barrier_type, target_segment, barrier_explanation
- from_s1: client_profile_short, primary_trigger, filter_questions

${dataJson}


ЧАСТЬ 3 — INLINE TAGGING

В feature_description и feature_why оборачивай 2-3 ключевые фразы:
- Конкретная жалоба из top_complaints
- Процент клиентов с этой болью
- Имя конкурента и его недостаток

Каждый claim_id → запись в data_trace.


ЧАСТЬ 4 — ПРАВИЛА

1. ОДНА ФУНКЦИЯ = ОДНО ДЕЙСТВИЕ → ОДИН РЕЗУЛЬТАТ:
   Формат: "[Пользователь делает X] → [Система делает Y] → [Результат Z]"
   ЗАПРЕЩЕНЫ: "и", "затем", "также", "плюс"

2. FEATURE_WHY — обязательно связь с данными:
   "Эта функция закрывает [жалоба из top_complaints] у [процент/количество] клиентов.
   Именно за это платят — не за [альтернативу]."

3. BARRIER в механике:
   barrier_type из S0 встроен в саму функцию.
   DATA_MOAT: "каждое использование добавляет данные → точность растёт"
   WORKFLOW_LOCK: "встраивается в процесс → миграция = потеря X"
   SPEED: "результат за X вместо Y"

4. NOT_IN_V1 — минимум 3 вещи с объяснением:
   Не очевидные исключения — те которые клиент может ожидать.
   Для каждого: почему не нужно в v1 → что нужно вместо

5. FIRST_BUILD_STEP — готовый вторник (КРИТИЧНО):
   Буквально первая строка кода / первый промт / первый файл.

   Варианты:
   - Если нужен код: первая функция в коде (синтаксис как в Cursor)
   - Если AI-инструмент: первый промт для Claude/GPT (дословно)
   - Если no-code: первый шаг в конкретном инструменте (v0.dev, Bubble)

   Пример: "Открой v0.dev → напиши промт: 'Build a web app that accepts
   a JSON error log and outputs a suggested fix. Use Claude API for analysis.'"

6. READY_ASSETS — массив 3-5 готовых артефактов:
   Не описания. Конкретные сущности которые пользователь получает:
   - "Схема анализатора логов (mermaid diagram)"
   - "3 примера реальных ошибок Stripe → патч"
   - "Структура Notion-документа для демо первым 20 клиентам"

7. ARTIFACT_DESCRIPTION — что создать за 1-2 дня без кода:
   Конкретный артефакт + как использовать в первом разговоре.
   Пример: "Notion с 10 примерами: лог → патч. Отправляешь до звонка."

8. ESTIMATED_BUILD_COST:
   ${maxBuildCost ? `Максимум: $${maxBuildCost.value}` : 'Из experiment_budget × 0.3'}
   COST_CONTEXT: "$X = стоимость часа разработчика которого не нанимаешь"

9. ${noTeamRequired ? 'NO_TEAM_REQUIRED: requires_team = false, выполнимо одним через браузер.' : ''}

10. SO_WHAT_FOR_YOU:
    Не "вы построите быстрее". А: "Альтернатива — нанимать разработчика
    за $3-5K. Эта функция за $150 проверяет гипотезу раньше — ты сэкономишь
    2 месяца до первого 'да' или 'нет'."

11. BRIDGE_FROM_S1:
    1 предложение: "[Клиент из S1] просыпается с мыслью '[триггер из S1]'.
    Вот что ему нужно чтобы проблема исчезла."

12. DATA_TRACE с Enum:
    - MARKET_DATA, COMPETITOR_SCAN, CALCULATION, STRATEGIC_LOGIC, USER_PROFILE

13. ${isExperiment ? 'is_hypothesis = true.' : 'is_hypothesis = false.'}

14. ${isLimited ? 'option_a/b ОБЯЗАТЕЛЬНЫ.' : 'null.'}


ЧАСТЬ 5 — АБСОЛЮТНЫЕ ЗАПРЕТЫ

- Несколько функций маскированных ("и", "затем")
- Абстракции: "платформа", "система" без конкретики
- FIRST_BUILD_STEP вида "определи архитектуру" (планирование, не действие)
- ${noTeamRequired ? 'Упоминать найм команды' : ''}
- data_trace со словами "данных нет"
- Незакрытые теги
- Текст вне JSON


ЧАСТЬ 6 — FORCED SPECIFICITY CHECK + ЗАДАЧА

Внутренняя проверка:

ШАГ 1: feature_description — есть "и"/"затем"/"также"?
ШАГ 2: Возьми другой barrier_type (не из S0). Функция была бы другой?
        Если нет — барьер не встроен. Переписать.
ШАГ 3: first_build_step — можно выполнить сегодня вечером?
        "Определи план" — НЕ действие. "Открой v0.dev → напиши промт" — действие.
ШАГ 4: Теги закрыты и уникальны?


ЗАДАЧА — верни ТОЛЬКО валидный JSON:

{
  "feature_description": "ОДНО ДЕЙСТВИЕ с тегами: '<t id=\\"claim_0\\">Пользователь вставляет лог</t> → <t id=\\"claim_1\\">система выдаёт патч</t>'",

  "feature_why": "Почему эта функция: связь с жалобой из данных + процент клиентов",

  "v1_feature_name": "3-5 слов, конкретное название",

  "not_in_v1": [
    "вещь 1 — почему не нужна в v1",
    "вещь 2 — почему не нужна",
    "вещь 3 — почему не нужна"
  ],

  "first_build_step": "Буквально первый шаг сегодня: первая строка кода / первый промт / первый файл",

  "ready_assets": [
    "Артефакт 1 — конкретный",
    "Артефакт 2 — конкретный",
    "Артефакт 3 — конкретный"
  ],

  "artifact_description": "Что создать за 1-2 дня без кода + как использовать",

  "barrier_description": "Почему не скопируют за 6 месяцев. Конкретный механизм",
  "barrier_mechanism": "Для S3. 1-2 предложения",

  "estimated_build_cost": "число в USD",
  "cost_context": "Стоимость в сравнении с альтернативой найма/аутсорса",

  "so_what_for_you": "1-2 предложения — что даёт конкретно пользователю",

  "bridge_from_s1": "1 предложение — связь с клиентом из S1",

  "requires_team": ${noTeamRequired ? 'false' : 'boolean'},
  "requires_enterprise_sales_motion": "boolean",
  "requires_sales_team": "boolean",

  "data_trace": [
    { "claim_id": "claim_0", "method": "MARKET_DATA: ..." },
    { "claim_id": "claim_1", "method": "STRATEGIC_LOGIC: ..." }
  ],

  "is_hypothesis": ${isExperiment ? 'true' : 'false'},

  "ai_leverage": {
    "tool": "название",
    "task": "задача создания прототипа",
    "why": "что делает, сколько времени"
  },

  "option_a": ${isLimited ? '{ "feature_description": "string", "condition": "string" }' : 'null'},
  "option_b": ${isLimited ? '{ "feature_description": "string", "condition": "string" }' : 'null'}
}
`.trim()
}
