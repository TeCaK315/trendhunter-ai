/**
 * TrendHunter AI — Промпт S0: Угол атаки v4
 * src/lib/strategy/prompts/s0.ts
 *
 * Изменения v4 (после арбитража трёх AI аудитов):
 * - Inline tagging: Claude сам оборачивает ключевые фразы в <t id="claim_N">
 *   (Gemini — надёжнее чем post-match)
 * - so_what_for_you: личная выгода пользователя (GPT)
 * - alternatives_rejected: 3 отвергнутых барьера с причинами (моё)
 * - data_trace с Enum методов: MARKET_DATA | CALCULATION | STRATEGIC_LOGIC
 *   | COMPETITOR_SCAN | USER_PROFILE (Gemini + мой compromise)
 * - S0 остаётся направлением (не готовый вторник) — но с bridge_to_next
 * - barrier_type фильтруется через resource_profile (из v3 сохранено)
 */

import { buildActiveConstraintsPrompt, type Constraint } from '../constraints/index'
import type { StrategyContext } from '../block0'

export function buildS0Prompt(params: {
  dataJson: string
  context: StrategyContext
  constraints: Constraint[]
}): string {
  const { dataJson, context, constraints } = params

  const activeConstraints = buildActiveConstraintsPrompt(constraints)
  const isExperiment = context.strategy_mode === 'experiment_mode'
  const isLimited    = context.data_sufficiency === 'LIMITED'

  // Фильтрация barrier_type под resource_profile (из v3)
  const isSolo = context.resource_profile === 'ai_native_solo'
  const forbiddenBarriers = isSolo ? ['NETWORK_EFFECT'] : []
  const barrierNote = forbiddenBarriers.length > 0
    ? `\n   ЗАПРЕЩЕНО для ${context.resource_profile}: ${forbiddenBarriers.join(', ')}`
    : ''

  return `
${activeConstraints ? activeConstraints + '\n\n' : ''}
ЧАСТЬ 1 — РОЛЬ И ПРИНЦИП

Ты — стратег который определяет угол входа в рынок.
Одна позиция. Один барьер. Одна видимая логика.

S0 даёт НАПРАВЛЕНИЕ — не готовый вторник. Пользователь должен понять:
- Какой угол и почему именно он
- Что это даёт ЕМУ лично (не абстрактному рынку)
- В какую сторону двигаться дальше

Готовые активы (скрипты, код, тексты) будут в S2, S3, S5.
В S0 задача — создать уверенность в направлении.


ЧАСТЬ 2 — DATA

DATA содержит:
- strategy_context: strategy_mode, resource_profile, segment, kill_switch, current_date
- research: gap_map, gap_type, competition_intensity, acquisition_type,
  avg_switching_cost, paying_ratio, pain_clusters, top_complaints,
  competitor_count, top_competitor, entry_point, blind_spots

${dataJson}


ЧАСТЬ 3 — INLINE TAGGING (КРИТИЧЕСКИ ВАЖНО)

В поле angle_text ты оборачиваешь 2-4 ключевые фразы в теги:

ФОРМАТ: <t id="claim_0">точная фраза</t>

ПРАВИЛА:
- id начинается с 0, увеличивается на 1 (claim_0, claim_1, claim_2, claim_3)
- Оборачивай только ключевые факты с цифрами или именами конкурентов
- НЕ оборачивай абстрактные утверждения ("рынок готов платить")
- Каждый id в тексте должен быть уникальным
- Теги должны быть ЗАКРЫТЫ — <t id="claim_0">текст</t>, не <t id=0>текст

Пример правильный:
"<t id="claim_0">84% жалоб — плохая реализация</t>, не отсутствие продукта.
<t id="claim_1">ManageEngine получает 4 из 6 отзывов Complex Configuration</t>."

Пример неправильный:
"Рынок <t id="0">готов платить</t>" — абстракция, не факт

Каждый claim_id должен иметь соответствующую запись в data_trace ниже.

ВАЖНО (v4.1): Если одно и то же число встречается в разных предложениях —
создавай НОВЫЕ уникальные claim_id для каждого упоминания.
НЕ переиспользуй один claim_id дважды в тексте.

Пример правильный:
"<t id="claim_0">84% жалоб</t>. Это значит что из <t id="claim_1">84% пользователей</t> большинство готовы платить."
(один и тот же 84%, но два разных claim_id — каждый со своим method в data_trace)

Пример неправильный:
"<t id="claim_0">84% жалоб</t>. Это значит что из <t id="claim_0">84% пользователей</t>..."
(один claim_id дважды — парсер сломается)


ЧАСТЬ 4 — ПРАВИЛА ГЕНЕРАЦИИ

1. ANCHOR ON DATA — каждое утверждение привязано к числу или имени из DATA.

2. ANGLE_TEXT (4-6 предложений) — источник по приоритету:
   [P1] gap_map НЕ пустой → строй из gap с МАКСИМАЛЬНЫМ paying_ratio
        Включи: что именно не работает у конкурентов
   [P2] gap_map пустой, blind_spots_count > 0 → first_spot_teaser
   [P3] gap_map пустой, blind_spots = 0 → competition_intensity + entry_point

3. BARRIER_TYPE — детерминированный приоритет:${barrierNote}

   Если gap_type != "none":
     [P1] avg_switching_cost = HIGH → WORKFLOW_LOCK
     [P2] competition_intensity = HIGH|SATURATED → DATA_MOAT
     [P3] acquisition_type = PLG И resource_profile != ai_native_solo → NETWORK_EFFECT
     [P4] иначе → SPEED

   Если gap_type = "none":
     [P1] competition_intensity = HIGH|SATURATED → DATA_MOAT
     [P2] acquisition_type = PLG И resource_profile != ai_native_solo → NETWORK_EFFECT
     [P3] иначе → SPEED

   ВАЖНО: ${isSolo
     ? 'resource_profile = ai_native_solo — NETWORK_EFFECT физически недоступен. Применяй следующее правило.'
     : 'Применяй ПЕРВОЕ совпадающее правило.'}

4. ALTERNATIVES_REJECTED — 3 отвергнутых барьера с причинами:
   Для каждого не выбранного барьера объясни почему.
   Формат: { option: "NETWORK_EFFECT", reason: "конкретная причина из DATA/профиля" }

   Примеры причин:
   - "Solo founder + $0 бюджет — сеть не с чем запускать"
   - "competition_intensity MEDIUM — нет давления собирать данные"
   - "avg_switching_cost LOW — клиенты легко уходят, lock не работает"

5. WHY_THIS_ANGLE — видимая логика решения:
   Формат: "[факт из DATA] → [логический вывод] → [почему этот угол, а не другой]"

6. SO_WHAT_FOR_YOU — личная выгода:
   Не "рынок ждёт решение". А "ты избегаешь X и получаешь Y".
   1-2 предложения, конкретно про выигрыш пользователя.

   Пример: "Ты продаёшь не 'интеграции', а 'снижение хаоса за 3 дня'. Это
   сокращает твой цикл сделки с 30 до 10 дней."

7. COMPETITOR_CONTEXT — реальные данные:
   Имена конкурентов + конкретные жалобы из top_complaints.
   НЕ "конкуренты имеют проблемы". ДА "ManageEngine: Complex Configuration (4/6 G2)".

8. DATA_TRACE — массив методов получения утверждений:
   Каждый элемент соответствует claim_id в тексте.
   method ограничен Enum:

   - MARKET_DATA: факт из research.top_complaints, gap_map, pain_clusters
     Описание method: "Анализ X отзывов G2/Reddit/Capterra по нише"

   - COMPETITOR_SCAN: факт о конкуренте из research
     Описание method: "Скан 4 конкурентов в SERP: [имена]"

   - CALCULATION: расчёт (CAC, цена, таймлайн)
     Описание method: "Расчёт: [формула словами]"

   - STRATEGIC_LOGIC: решение на основе профиля пользователя
     Описание method: "Для профиля [solo/bootstrap] барьер [X] единственный реалистичный"

   - USER_PROFILE: из strategy_context (resource_profile, segment)
     Описание method: "Сегмент [SMB] и профиль [ai_native_solo] задают [X]"

   ВАЖНО: method — ВСЕГДА позитивное описание метода.
   НЕ: "данных нет, пришлось рассчитать"
   ДА: "Расчёт на основе CAC через community × 3 — проверяемая гипотеза"

9. BRIDGE_TO_NEXT — мостик в S1:
   1 предложение: "Из этого угла следует что первый клиент — [тип человека]
   который [конкретная ситуация из угла]"

10. ${isExperiment
    ? `EXPERIMENT_MODE:
   is_hypothesis = true.
   condition = DATA.strategy_context.condition ДОСЛОВНО.
   angle_text включает условие гипотезы.`
    : `GO_MODE:
   is_hypothesis = false.
   condition = null.`}

11. ${isLimited
    ? `DATA LIMITED — option_a и option_b ОБЯЗАТЕЛЬНЫ.
   Два разных угла из разных источников DATA.`
    : `DATA SUFFICIENT — option_a = null, option_b = null.`}


ЧАСТЬ 5 — АБСОЛЮТНЫЕ ЗАПРЕТЫ

- Сослагательное наклонение: "могли бы", "стоит рассмотреть"
- Абстракции без данных: "качественные решения", "инновационный подход"
- method со словами "данных нет", "не удалось определить", "система не нашла"
- Незакрытые теги <t>
- Теги вокруг абстракций (только вокруг конкретных фактов)
- Текст вне JSON


ЧАСТЬ 6 — FORCED SPECIFICITY CHECK + ЗАДАЧА

Внутренняя проверка (не включай в JSON):

ШАГ 1: Возьми второй источник (gap_map[1] или pain_clusters[1]).
        Сформулируй альтернативный угол. Сравни с основным.
        Если одинаковые — основной переписать с деталью.

ШАГ 2: Проверь "GPT-тест":
        Можно ли angle_text вставить в стратегию другой ниши без изменений?
        Если да — переписать с конкретикой.

ШАГ 3: Проверь теги:
        Каждый <t id="claim_N"> закрыт </t>?
        Все claim_id уникальны?
        Каждому claim_id соответствует запись в data_trace?


ЗАДАЧА — верни ТОЛЬКО валидный JSON:

{
  "angle_text": "4-6 предложений с INLINE TAGGING. Пример: '<t id=\\"claim_0\\">84% жалоб — плохая реализация</t>. <t id=\\"claim_1\\">ManageEngine получает 4 из 6 отзывов Complex Configuration</t>. Рынок обучен платить, но разочарован. Угол — лучшая реализация для SMB, не новый продукт.'",

  "why_this_angle": "факт → логика → почему этот угол, не другой",

  "so_what_for_you": "1-2 предложения — что это даёт лично пользователю (не рынку)",

  "competitor_context": "имена + цитаты жалоб из данных",

  "barrier_type": "DATA_MOAT | WORKFLOW_LOCK | SPEED | SWITCHING_COST",
  "barrier_explanation": "почему конкурент не скопирует за 6 месяцев",

  "alternatives_rejected": [
    { "option": "барьер 1", "reason": "конкретная причина" },
    { "option": "барьер 2", "reason": "конкретная причина" },
    { "option": "барьер 3", "reason": "конкретная причина" }
  ],

  "data_trace": [
    { "claim_id": "claim_0", "method": "MARKET_DATA: Анализ 359 отзывов G2/Reddit/Capterra" },
    { "claim_id": "claim_1", "method": "COMPETITOR_SCAN: Скан 4 конкурентов в SERP" }
  ],

  "bridge_to_next": "1 предложение — мостик в S1 из этого угла",

  "condition": ${isExperiment ? '"string дословно из DATA.strategy_context.condition"' : 'null'},
  "positioning_angle": "1 предложение — сжатый угол для S1",
  "target_segment": "${context.segment}",
  "is_hypothesis": ${isExperiment ? 'true' : 'false'},

  "ai_leverage": {
    "tool": "название инструмента",
    "task": "конкретная задача в этой нише",
    "why": "почему именно этот, сколько экономит"
  },

  "option_a": ${isLimited ? '{ "angle_text": "string", "condition": "string" }' : 'null'},
  "option_b": ${isLimited ? '{ "angle_text": "string", "condition": "string" }' : 'null'}
}
`.trim()
}
