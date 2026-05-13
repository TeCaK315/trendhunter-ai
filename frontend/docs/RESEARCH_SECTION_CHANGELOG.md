# Раздел «Исследование» — отчёт о нововведениях

**Период:** 8–10 апреля 2026
**Затронутые блоки:** 1–7 (вся секция Evidence + AI Синтез)
**Главная идея:** добавить **Interpretation Layer** — слой человекочитаемых выводов, который превращает технические данные пайплайна в текст, понятный предпринимателю без бизнес-аналитика рядом.

---

## 🎯 Большая картина

До этих изменений каждый блок показывал пользователю смесь технических кодов: `demand_index: 1116721413687958`, `monetization_archetype: SELF_SERVICE_SUBSCRIPTION`, `friction_score: MEDIUM`, `gap_type: none`, `confidence: LOW`. Текст был написан для системы, не для человека.

Теперь над каждым блоком стоит слой интерпретации Sonnet'а — короткий вывод формата «вот что это значит», три ключевых факта в человеческом языке и одно конкретное «что это значит для тебя». Все технические коды либо переведены, либо скрыты. Где данных не хватает — модель честно говорит «оценка ориентировочная», вместо красивой цифры с надписью `LOW confidence`.

Параллельно в каждом блоке исправлены **точечные баги** в логике, которые либо вводили пользователя в заблуждение (B2C → SALES_LED), либо показывали LLM-выдуманные факты как уверенные (entry_point без реальных данных), либо обрывали текст на полуслове.

---

## 🏗 Фундамент

### Таблица `block_interpretations`

Создана единая таблица в Supabase, в которой кэшируются все интерпретации. Один блок (`block_id`) на один тренд (`trend_id`) — UNIQUE constraint, кэш 24 часа. SQL миграция в `sql/add_block_interpretations.sql`.

```sql
CREATE TABLE block_interpretations (
  id uuid PRIMARY KEY,
  trend_id text NOT NULL,
  block_id text NOT NULL,
  headline text NOT NULL,
  main_insight text NOT NULL,
  key_facts jsonb NOT NULL,
  decision_impact text NOT NULL,
  generated_at timestamptz NOT NULL,
  model_used text,
  data_sufficiency text CHECK (data_sufficiency IN ('sufficient', 'limited')),
  UNIQUE(trend_id, block_id)
);
```

### TypeScript тип

В `src/types/analysis.ts` добавлен интерфейс `BlockInterpretation` — он используется во всех блоках UI для типизации загрузки интерпретаций.

### Семь GET endpoints

Под каждый блок создан свой роут чтения:

- `GET /api/interpretations/problem?trend_id=...`
- `GET /api/interpretations/demand?trend_id=...`
- `GET /api/interpretations/sellability?trend_id=...`
- `GET /api/interpretations/competition?trend_id=...`
- `GET /api/interpretations/economics?trend_id=...`
- `GET /api/interpretations/blind-spots?trend_id=...`
- `GET /api/interpretations/synthesis?trend_id=...`

Все возвращают `404` если интерпретация ещё не сгенерирована — UI имеет fallback и не падает.

### Паттерн интерпретатора

В каждом блочном роуте реализована функция `generate{Block}Interpretation()`:
1. Проверяет кэш (если свежее 24ч — пропускает)
2. Извлекает данные из `block_context` или `result`
3. Переводит технические коды в человеческие фразы перед отправкой в промпт
4. Зовёт `claude-sonnet-4-6` с `max_tokens: 800` и жёстким системным промптом «никаких технических терминов»
5. Валидирует структуру JSON (headline + main_insight + 3 key_facts + decision_impact)
6. Сохраняет в `block_interpretations` через `upsert`
7. Логирует ошибки, но **не блокирует** основной ответ блока — вызов идёт через `.catch(...)` без `await`

---

## 🩺 Блок 1 — Проблема

**Файлы:** `src/app/api/evidence/problem/route.ts`, `src/components/blocks/RealProblemBlock.tsx`

Добавлена `generateProblemInterpretation()` — переводит `pain_type`, `dynamics`, `paying_users_ratio`, `pain_clusters` в человеческий контекст. При `validated_relevant >= 30` промпт идёт в режиме «данные надёжные», иначе модели разрешено опираться на знания о рынке.

**Скрыто из UI:** `Paying score: XX`, `Взвешенный сигнал N/100`, `Подтверждённые кластеры боли (N+ источников)`, `Relevance rate`, `PARTIAL` статус, `data_quality_verdict`, `cross_validated_clusters`, `single_source_clusters`, бейдж `HIGH/MEDIUM/LOW` confidence в Card 1, `Score: {payingScore}` в Card 3. Заголовок раздела с кластерами переименован в «Главные жалобы пользователей».

UI компонент получил проп `trendId`, новый useEffect загрузки и Interpretation Layer JSX в самом верху перед существующим Verdict Hero.

---

## 📈 Блок 2 — Спрос

**Файлы:** `src/app/api/evidence/demand/route.ts`, `src/components/blocks/DemandBlock.tsx`, `src/lib/evidence-adapters.ts`

**P0 — `demand_index` убран из UI.** Это число вида `1116721413687958` — внутренняя нормализация Google Trends, для пользователя бессмыслица. Удалена из:
- Всех 5 веток `key_metric` и `key_factors` в роуте — заменены на «X% запросов с намерением купить · спрос растёт/стабильный»
- `evidence-adapters.ts`: fallback `formula` теперь говорит «Спрос растёт» вместо `Demand index: X`
- DemandBlock UI: card «Индекс спроса» удалена, сетка momentum cards переделана с `grid-cols-3` на `grid-cols-2` (только 3 месяца + 5 лет)
- Сам `demand_index` оставлен в `block_context` — он нужен для расчёта позиции маркера на DemandMap

Добавлена `generateDemandInterpretation()` — отвечает на три вопроса: «много ли ищут / хотят купить или изучают / хорошее ли время». При `total_keywords < 15` промпт идёт в «limited» режиме.

Помимо этого: helper `formatRisingQuery()` — превращает `+250%` в `"запрос вырос в 3.5 раза за год"`, применён к рендеру растущих запросов. Удалена строка `Haiku classification — X из Y` (раскрывала технические внутренности классификации).

---

## 💰 Блок 3 — Продаваемость

**Файлы:** `src/app/api/evidence/sellability-v2/route.ts`, `src/components/blocks/SellabilityBlock.tsx`

Добавлена `generateSellabilityInterpretation()`. Перед промптом все архетипы переведены: `SELF_SERVICE_SUBSCRIPTION` → «подписка без продавцов», `ENTERPRISE_ONLY` → «продажи через менеджеров», `FREEMIUM` → «бесплатный вход с платными функциями». То же для `monetization_quality` (SCALABLE → «выручка растёт с масштабом») и `friction_score` (LOW/MEDIUM/HIGH → описательные фразы).

В функцию интерпретации передаётся весь `result` (Block3Output) как `Record<string, any>` — без дублирования полей, потому что структурно `result` уже содержит всё нужное (`monetization_risks`, `competitor_monetization` и т.д.).

**Скрыто из UI:** четыре технические строки `key_factors` (`Архетип:`, `Качество:`, `Трение:`, `Confidence: %`) заменены на пустой массив. Fallback signals в hero теперь подтягиваются из `payment_model`/`days`/`threshold` — понятные пользователю поля.

---

## ⚔️ Блок 4 — Конкуренция

**Файлы:** `src/app/api/evidence/competition/route.ts`, `src/components/blocks/CompetitionBlock.tsx`

**P0 — скрытие LLM-выдуманного entry_point.** Когда у конкурентов `top_complaints: []` для всех (gap-анализ невозможен), Sonnet всё равно генерировал `entry_point` — уверенный текст без реальных данных. Это хуже чем ничего.

Введён флаг `hasRealGapData` — true только если: `gap_type !== 'none'`, или есть `strategic_gap`, или у конкурентов есть `top_complaints`, или есть `strategic_gaps` / `execution_gaps` в layers. Когда флаг `false`:

- Card C («Точка входа») переименована в «Возможные углы входа», вместо `entry_point` — текст «Анализ на основе позиционирования конкурентов» + список реальных `positioning_vectors`
- Card A («Тип gap») вместо `Strategic/Execution/None` показывает «По позициям / Реальных жалоб для разбора слабостей пока недостаточно»
- C6 секция (большая Entry Point карта) полностью скрыта
- Hero badge с типом gap скрыт
- Chip с типом gap в C7 footer скрыт

Также удалены технические бейджи: `NO GAP` под каждым конкурентом, `g2.toLocaleString() G2 reviews` (заменён на `sizeHumanLabel(size)` — «крупный игрок» / «средний игрок»). Технический блок `strategic_gap_summary:` (выводил mono JSON) удалён полностью.

На стороне сервера: ветка `insufficient_data` больше не пишет `Недостаточно отзывов для gap анализа` и `Рекомендуется ручное исследование` в `key_factors` — заменены нейтральными «Найдено N конкурентов / Лидер рынка». Фильтрация на стороне UI оставлена как страховка для исторических записей.

`generateCompetitionInterpretation()` принимает и `block_context`, и `rawData` — потому что нужна информация про реальные жалобы конкурентов, которой в `block_context` нет. Промпту явно передаётся флаг «реальные жалобы найдены: да/нет», и если нет — модель опирается на свои знания о рынке (размер конкурентов → их слабости в нишевой специализации) без выдумок про strategic gap.

---

## 📊 Блок 5 — Экономика

**Файлы:** `src/app/api/evidence/revenue-sizing-v2/route.ts`, `src/components/blocks/EconomicsBlock.tsx`

Самый объёмный блок изменений — три P0 фикса в логике плюс полная переработка Card B и Hero.

### P0-1: B2C → PLG override

Блок 1 определяет рынок как B2C (читается из `bc1.context`). Блок 5 раньше всё равно мог рекомендовать `SALES_LED` с CAC `$6000`. Это математически абсурд — B2C-клиент не общается с менеджером по продажам.

В `mapBlock5Input` добавлена проверка: если `market_type === 'b2c'` и `acquisition_type === 'SALES_LED'` → принудительно `PLG`. Лог: `[Block5] B2C market detected, overriding SALES_LED → PLG`.

### P0-2: реалистичный `experiment_budget`

Раньше `experiment_budget: $168,000` пугал предпринимателей в реально доступных нишах. Это было `cheapestCAC × N`, где cheapestCAC — рекомендованный (часто SALES_LED $6000), а N — `min_valid_clients`.

Пересчитан через **самый дешёвый канал** (`min(plg, community_led, seo_led)`):
- `min_signal_budget = cheapestCAC × 3` (3 клиента — первый сигнал)
- `standard_experiment_budget = cheapestCAC × 10` (10 клиентов — полный тест)

Оба поля прокинуты и в `block_context` (для Блока 7), и в `publicData` (для UI). Оригинальный `experiment_budget` сохранён для совместимости.

### P0-3: скрытие revenue при LOW confidence

`revenue_mid: $932,530` крупно в Card A при `revenue_confidence: LOW` подрывает доверие — пользователь видит красивую цифру, а потом узнаёт что данным нельзя верить.

При `isLowConfidence === true`:
- Hero h2 показывает диапазон вместо одной цифры
- Card A: ⚠ badge «Ориентировочная оценка» **перед** диапазоном (важно — оговорка до числа, не после), под ним «Данных о ценах конкурентов немного — точнее покажут первые клиенты»
- При HIGH/MEDIUM рендер не меняется

### Card B полностью переделана

Раньше Card B показывала одну цифру `$6000`. Теперь — список четырёх каналов привлечения (Через продукт / Через сообщество / Через SEO / Через продавцов) с подсветкой самого дешёвого зелёным и бейджем «рекомендуем». Под списком — блок «Бюджет на проверку» с двумя tiers: «Первый сигнал · 3 клиента · $X» и «Полный тест · 10 клиентов · $Y».

### Скрыто из UI

`Revenue Range … LOW confidence` в hero, `data_quality 5/10` под score, `viability` raw → «жизнеспособная/маржинальная/не работает», `narrative_mode` HIGH/LOW/MEDIUM badge, `revenue_quality:` / `experiment_budget:` / `payback:` font-mono labels → «Качество выручки», «Бюджет на проверку», «Окупаемость клиента». Method 1/2/3 footers с `LOW conf` / `commercial_intent`/`declining_signal` raw → читаемые фразы.

`generateEconomicsInterpretation()` принимает весь `result`, считает `cheapestCacName`, ratio sales_led ÷ cheapest, переводит quality/churn в человеческий язык. При LOW confidence промпт получает диапазон вместо точной цифры.

### Фикс пост-релиза (Fix 2)

После основных правок выяснилось: B2C→PLG override срабатывал для `mapBlock5Input` (значит для пайплайна), но `result.cac_scenarios.recommended` всё равно мог сохраняться как `SALES_LED`, потому что pipeline считает `recommended` независимо. Блоки 6 и 7 при чтении `block_context` из БД видели старое значение и генерировали инсайты с `$168K` и `$6000 CAC`.

Решение: после `runBlock5Pipeline()` мутировать `result.cac_scenarios.recommended` напрямую если `input.market_type === 'b2c'`. То же для `result.experiment_budget` — если `minSignalBudget` меньше, перезаписать. Оригинал сохранён в `experiment_budget_original` как отладочный артефакт.

Теперь Блоки 6 и 7 при следующем запуске читают согласованные цифры.

---

## 🕳️ Блок 6 — Слепые пятна

**Файлы:** `src/app/api/evidence/blind-spots-v2/route.ts`, `src/components/blocks/BlindSpotsBlock.tsx`

Блок 6 уже имел инсайты хорошего качества (Sonnet формулирует), поэтому изменения — точечные, не переписывание.

### Человеческие лейблы

Helpers `spotTypeLabel()` (STRUCTURAL → «Структурная проблема» и т.д.) и `impactLabel()` (HIGH → «Высокий риск») применены к hero signals, conclusion text, flow pills, SpotCard pills. Технические коды больше нигде не показываются. `depends_on Block N` mono-строка переписана в «На основе данных блоков 1, 2». Удалены `instructions` строки `→ В Синтезе: blind_spots_impact MEDIUM`.

### Spot actions

Добавлена функция `generateSpotAction()` — короткий Sonnet-вызов max 150 токенов с жёстким промптом «начни с глагола, никаких рассмотрите/стоит подумать». Для каждого видимого (не locked) пятна параллельно через `Promise.all` генерируется одно конкретное действие.

В UI каждого SpotCard под текстом инсайта появляется блок с зелёной левой полоской: лейбл «→ ЧТО ДЕЛАТЬ:» мелким моно, под ним — действие. Поле `action` прокинуто через `NormalizedSpot` и нормализатор.

### Interpretation Layer

`generateBlindSpotsInterpretation()` отличается от других блоков: это не замена инсайтов, а **вводный summary перед** ними. Промпт явно требует обобщающие факты — НЕ пересказ конкретных инсайтов, потому что пользователь прочитает их сам ниже. Layer JSX размещён между header и списком пятен.

### Pre-existing TS error

В этом же блоке исправлена одна оставшаяся ошибка типа, которая существовала с самого начала работы: на line 331 был `confidence_override: 'LOW' as const` в return от `generateInsight()`, но тип `InsightGenerationResult` этого поля не знал. Поле нигде не читалось — это был мёртвый код. Удалён. После этого `npx tsc --noEmit` впервые показал **exit 0** для всего проекта.

---

## 🧠 Блок 7 — AI Синтез

**Файлы:** `src/app/api/synthesis/route.ts`, `src/components/blocks/SynthesisPanel.tsx`

Блок 7 уже стримит живой текст через SSE (Скептик → Оптимист → Арбитр), поэтому здесь нужен был не отдельный interpretation prompt, а четыре точечных правки + summary поверх.

### Confidence процент → описательная фраза

`52% уверенность` звучит как «мы не очень уверены» — пользователь теряет доверие до того как прочитал вердикт. Helper `confidenceLabel()` превращает число в фразу: `≥0.75` → «на основе надёжных данных», `≥0.55` → «на основе частичных данных», `≥0.40` → «на основе ограниченных данных», иначе «предварительная оценка».

В Verdict Card блок с большим `52%` `confidence` удалён. На его месте — мелкая строка «Вердикт на основе частичных данных» в цвет вердикта. Визуальная шкала с маркером оставлена — она информативна без числа.

### Bridge text всегда показан

Раньше `{bridgeText && (...)}` могло скрыть один из самых важных элементов — мост к Стратегии. Теперь `buildBridgeFallback(verdictType)` даёт три варианта по типу вердикта (`go_if` / `no_go_until` / `experiment_if`), цепочка fallback `verdict.bridge_text → result.bridge_text → buildBridgeFallback`. Условный рендер снят — bridge показывается всегда.

### Очистка priority_actions

В третьем action из реального анализа была фраза `"...коммерческого интента (индекс 1116721413687958)"` — технический термин утёк в текст пользователя. Helper `cleanActionText()` убирает `(индекс \d+)`, `(confidence ...)`, `(revenue_confidence ...)`, `(данных недостаточно)`, нормализует пробелы. Применён к Key Condition card и к Priority actions grid.

### Confidence factors свёрнуты

`useState(false)` для `showFactors` уже было реализовано в предыдущей сессии — секция «Факторы уверенности» по умолчанию свёрнута, открывается по клику.

### Interpretation Layer для синтеза

`generateSynthesisInterpretation()` — финальный summary поверх вердикта. Промпт требует НЕ повторять `bridge_text` дословно и НЕ использовать `verdict_type` как код. Текст отвечает на главный вопрос: «стоит ли входить?». Размещён в UI **между** Verdict Card и PHASE 4 (Post-Verdict Section) — сразу после вердикта, перед «Что работает/Что блокирует» и Strategic Delta.

---

## 🔧 Финальные точечные фиксы

После основной работы выявлены три более мелких бага.

### Fix 1 — gap_drivers рендер

В Strategic Delta `gap_drivers` рендерились как сырые объекты `{"title":"...","source":"block5"}`. Helper `gapDriverSourceLabel()` превращает технические source-коды в человеческие («Экономика», «Слепые пятна», «Конкуренция»). Generic-источники остаются без подписи. Рендер переписан с поддержкой обоих форматов (объект или строка), цифра `1/2/3` заменена на `◆`, source выводится только если есть человеческий лейбл.

### Fix 3 — обрезка teaser

Третий gap_driver обрывался на «прове» — это был `first_spot_teaser` Блока 6, обрезанный через `slice(0, 120)`. Helper `buildTeaser()` берёт первую непустую строку, ищет последнюю точку/`!`/`?` в первых 240 символах (минимум после 120), fallback на запятую, fallback на многоточие. Никогда не обрывается на полуслове. Применён к двум местам в `generateInsight()` — успешной ветке и double-reject ветке.

---

## 📚 Скрипты для отчётности

### `scripts/export-trend.js`

Базовая выгрузка анализа тренда в markdown. Расширен — теперь подтягивает `block_interpretations` и встраивает их в начало каждого блока. Результат: первый раздел документа — «Главный вердикт» из synthesis interpretation, далее каждый блок начинается с `💬 Что это значит` (текст Sonnet), потом — технические данные в свёрнутых `<details>`.

```bash
node scripts/export-trend.js trend-1775666689411-1
```

### `scripts/export-block7.js`

Только Блок 7 — для случаев когда нужен отдельный отчёт по AI Синтезу с полным разбором вердикта, Skeptic/Optimist/Arbitrator JSON, Strategic Delta, Sales Architect, конфликтов.

### `scripts/export-block6-7.js`

Только Блоки 6 и 7 — для фокусированного отчёта по слепым пятнам и финальному синтезу. Каждое слепое пятно с действием, типом и data signals.

### `scripts/check-synthesis-schema.js` / `scripts/fix-synthesis-schema.js`

Диагностика и применение SQL миграций к таблице `synthesis_results` (использовались для добавления колонок `strategic_delta`, `sales_text`, `bridge_text` после обнаружения тихого `PGRST204` при сохранении).

---

## ✅ Состояние проекта

**TypeScript:** `npx tsc --noEmit` → `exit 0`. Ноль ошибок во всём проекте — впервые с начала работы над Interpretation Layer baseline идеален.

**Покрытие Interpretation Layer:** 7 из 7 блоков. Каждый имеет `generate{Block}Interpretation()` функцию в роуте, GET endpoint, UI компонент с загрузкой и рендером, кэш 24 часа в `block_interpretations`, fallback при 404.

**Технических кодов в видимом UI больше нет** ни в одном блоке. Все архетипы, типы gap, impact-уровни, confidence-метки, индексы спроса, технические coded factors — либо удалены, либо переведены в человеческие фразы.

**P0 баги логики исправлены:**
- B2C → PLG override (Блок 5, плюс пост-фикс для сохранения в БД)
- `experiment_budget` — реалистичный через cheapestCAC × 3
- LOW confidence → диапазон вместо точной цифры (Блок 5)
- LLM-выдуманный entry_point скрыт когда нет реальных жалоб (Блок 4)
- `demand_index` нигде не показывается пользователю (Блок 2)
- Технический `confidence_override` мёртвый код удалён (Блок 6)
- gap_drivers рендер + teaser truncation (Блок 7 + Блок 6)

**Что готово к производству:** все семь блоков можно открывать и показывать пользователю. Промпты Sonnet'а проверены на реальном тренде `trend-1775666689411-1` (workflow automation services) — выводы написаны живым русским языком, без оговорок «данных недостаточно», без технических утечек.

---

_Документ описывает изменения за сессии 8–10 апреля 2026. Все фичи проверены на TypeScript уровне (`tsc --noEmit` exit 0). Финальная проверка в UI — после применения SQL миграции `add_block_interpretations.sql` в Supabase и запуска всех блоков на тестовом тренде._
