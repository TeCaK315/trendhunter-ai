# Детальный разбор раздела "Исследование" — 7 подразделов

## Порядок выполнения (волны)

```
Волна 1:  Блок 1 (Проблема) + Блок 2 (Спрос)    — параллельно
Волна 2:  Блок 3 (Продажи)  + Блок 4 (Конкуренция) — параллельно, зависят от волны 1
Волна 3:  Блок 5 (Экономика)                      — зависит от блоков 2-4
Волна 4:  Блок 6 (Слепые пятна)                   — зависит от блоков 1-5
Вручную:  Блок 7 (AI Синтез)                      — зависит от блоков 1-6, стоит 20 монет
```

---

## 1. ПРОБЛЕМА (Block 1) — "Решений нет или решения плохие?"

**Файл:** `frontend/src/app/api/evidence/problem/route.ts`
**AI модели:** Claude Haiku (3 вызова)
**SerpAPI:** 1 discovery + до 5 source queries = **до 6 вызовов**

### Алгоритм (3 прохода):

**Pass 1 — Поиск источников:**
1. SerpAPI: `"{niche} {keywords[0:3]} site:reddit.com"` → извлекает сабреддиты из URL
2. Haiku: валидирует релевантность каждого сабреддита (оценка 1-10, порог >= 5)
3. Формирует поисковые запросы по валидным источникам:
   - Сабреддиты: `site:reddit.com/r/{sub} {niche} problem OR issue OR frustrating OR alternative`
   - G2: `site:g2.com {niche} reviews`
   - Trustpilot: `site:trustpilot.com {niche} review`
   - Quora: `site:quora.com {niche} problem OR alternative OR better`
4. Параллельно — **нативные API (бесплатные, без SerpAPI):**
   - HackerNews Algolia API: `{niche} problem`, `{niche} frustrating`, `{niche} alternative`
   - StackExchange API: `{niche} error problem`, `{keyword} issue not working`
5. Результат: до **200 постов** с полями `source, text, link, upvotes, date`

**Pass 2 — Валидация + классификация:**
1. Посты разбиваются на батчи по 10, до 5 параллельных
2. Каждый батч → Haiku: "Этот пост РЕАЛЬНО о проблеме в нише {niche}?"
3. Каждый релевантный пост классифицируется:
   - `no_solution` — решений нет
   - `bad_solution` — решение плохо реализовано
   - `expensive_solution` — решение слишком дорогое
4. **Эвристика платящего пользователя** (regex, без AI):
   - High signals (weight 10): `я использую`, `мой аккаунт`, `$X/месяц`, `cancelled`
   - Medium signals (weight 5): `баг`, `не работает`, `после обновления` + упоминание конкурента
   - Low signals (weight 1): `слышал`, `думаю попробовать`

**Pass 3 — Кросс-валидация (кластеризация):**
1. Haiku группирует все `pain_summary` в кластеры похожих жалоб
2. Для каждого кластера определяется:
   - `source_count` — сколько **разных типов** источников подтвердили (reddit + g2 + quora = 3)
   - `confidence`: **high** = 3+ источника, **medium** = 2, **low** = 1
   - Доминирующая категория, топ цитаты по upvotes

### ƒРасчёт:

| Метрика | Формула |
|---------|---------|
| **distribution** | `count[category] / total_relevant * 100%` |
| **paying_score** | `SUM(paying_weight)` по всем релевантным постам (weight: 10/5/1) |
| **paying_ratio** | `count(is_paying=true) / total_relevant * 100%` |
| **dynamics** | Если `recent_4w > older * 1.3` → `growing`; `< older * 0.7` → `declining`; иначе `stable` |
| **context (B2B/B2C)** | Если `b2bCount/total > 0.6` → `b2b`; `< 0.2` → `b2c`; иначе `mixed` |

### Диагностика (5 веток по приоритету):

| Диагноз | Условие | Score |
|----------|---------|-------|
| **GREEN** | `bad_solution >= 55%` + `paying_score >= 40` + `valid >= 30` + кластеры high/medium | 6 + бонусы (до 10) |
| **RED** | `dynamics = declining` + `paying_score < 15` | max(1, 2 + valid/200) |
| **YELLOW** | `no_solution >= 55%` | 6 |
| **YELLOW** | `valid < 20` ИЛИ `paying_score < 20` | min(5, 4 + valid/100) |
| **YELLOW** | всё остальное (серая зона) | 5 |

### ƒScore GREEN:
```
score = min(10,  6
  + (bad_solution% - 55) / 20
  + (paying_score - 40) / 50
  + highConfClusters * 0.3
  + confBonus)   // +0.5 high, 0 medium, -0.5 low
```

### Output для downstream блоков:
- `pain_type` → Блок 3 (deal_cycle расчёт)
- `paying_users_ratio` → Блок 6 (unserved_segment detection)
- `pain_clusters` → Синтез (Скептик читает конкретные жалобы)
- `classification_confidence` → Блок 6 (Multi-Pass confidence)

---

## 2. СПРОС (Block 2) — "Люди ищут чтобы купить или чтобы понять?"

**Файл:** `frontend/src/app/api/evidence/demand/route.ts`
**AI модели:** Claude Haiku (классификация интента, батчами)
**SerpAPI:** 2 (Trends related + Trends timeseries) + до 3 (SERP по коммерческим) = **до 5 вызовов**

### Алгоритм:

**Шаг 1 — Сбор данных Google Trends:**
1. SerpAPI `google_trends`, `data_type: RELATED_QUERIES`: seed = `{niche} {keywords[0]}`
   - Получает top keywords (до 20) и rising keywords (до 10)
   - Если Trends пустой → fallback: Haiku генерирует 10 запросов (flag: `has_insufficient_data = true`)
2. SerpAPI `google_trends`, `data_type: TIMESERIES`, `date: today 5-y`:
   - `historicalVolumeRatio = oldest_index / newest_index`
   - `volume3mAgoIndex` — для hype detection

**Шаг 2 — Классификация интента (Haiku батчами):**
1. Каждый keyword → Haiku:
   - `commercial`: хочет КУПИТЬ, сравнить цены, найти альтернативу
   - `informational`: хочет ПОНЯТЬ, найти туториал, прочитать определение
2. Каждой классификации — confidence: high/medium/low

**Шаг 3 — Конкуренты из SERP:**
1. Берёт топ-3 **коммерческих** запроса (сортировка: confidence → volume)
2. SerpAPI `google` по каждому запросу → извлекает:
   - **Paid ads** → `source: "paid"` (прямые конкуренты с бюджетом)
   - **Organic top-5** → `source: "organic"`
3. Фильтр: стоп-лист агрегаторов (g2.com, capterra, reddit, wikipedia и т.д.)
4. `serp_ad_density = totalAds / totalResults`

**Hype Detection (детерминированный, без LLM):**
```
isHype = (risingRatio > 50%) AND (historicalVolumeRatio < 0.20)
```
Или: `volume3mAgoIndex < 10` + текущий > 50 (хайп возрождения, VR-сценарий)

### ƒРасчёт:

| Метрика | Формула |
|---------|---------|
| **demand_index** | Средний `volume` по top keywords (индекс 0-100 из Trends) |
| **commercial_intent_ratio** | `count(commercial) / total_classified` |
| **historical_volume_ratio** | `oldest_index / newest_index` (>1.4 = рынок упал на 40%+) |
| **rising_queries_ratio** | `rising_count / total_keywords` |
| **serp_ad_density** | `totalAds / (totalAds + totalOrganic)` по 3 SERP запросам |

### Пороги диагностики (CALIBRATE_AFTER_50_ANALYSES):

| Константа | Значение | Описание |
|-----------|----------|----------|
| `standard_min_index` | 50 | Минимальный demand_index для GREEN |
| `micro_b2b_min_index` | 30 | Минимальный для B2B ниш (ищут меньше, платят больше) |
| `insufficient_max_index` | 30 | Ниже этого = рынок слишком мал |
| `declining_ratio_threshold` | 1.4 | historicalVolumeRatio выше = рынок упал на 40% |

### Диагностика (7 веток):

| Диагноз | Reason | Условие |
|----------|--------|---------|
| **RED** | declining_market | `historicalVolumeRatio > 1.4` + `demand_index < 50` |
| **RED** | hype_without_foundation | hype detected |
| **GREEN** | commercial_market | `demand_index >= 50` + `commercial_ratio > 0.5` + не declining |
| **GREEN** | micro_b2b_market | `demand_index >= 30` + `commercial_ratio > 0.6` + `ad_density > 0.15` |
| **YELLOW** | informational_market | `demand_index >= 50` + `commercial_ratio <= 0.5` |
| **YELLOW** | insufficient_volume | `demand_index < 30` |
| **YELLOW** | grey_zone | всё остальное |

### Output для downstream блоков:
- `competitors_found[]` → Блок 3 (pricing), Блок 4 (seed для gap анализа)
- `commercial_intent_ratio` → Блок 5 (Method 2), Блок 6 (unserved_segment), Синтез
- `serp_ad_density` → Блок 5 (CAC расчёт)
- `has_declining_signal` → Блок 5 (Method 2 modifier), Синтез
- `volume_confidence` → Блок 5 (Revenue Range confidence)
- `rising_queries_ratio` → Блок 6 (tech_shift detection)
- `has_hype_risk` → Блок 6 (tech_shift фильтр)

---

## 3. ПРОДАВАЕМОСТЬ (Block 3) — "Есть ли путь к первым деньгам?"

**Файл:** `frontend/src/app/api/evidence/sellability/route.ts`
**Зависимости:** Блок 1 (`pain_type`), Блок 2 (`competitors_found`)
**AI модели:** Claude Haiku (парсинг цен, Reddit бюджеты, deal cycle)
**SerpAPI:** до 5 (pricing) + 1 (Reddit бюджеты) + community queries = **до 10 вызовов**

### Алгоритм (3 слоя):

**Слой 1 — Готовность платить (Willingness to Pay):**
1. Для каждого из топ-5 конкурентов (из Блока 2) **параллельно**:
   - SerpAPI: `"{domain} pricing plans"`
   - Haiku: парсит SERP-сниппеты → `prices[], payment_model, has_trial`
   - **Multi-Pass 2:** Haiku проверяет, что цены относятся ИМЕННО к нише (`is_relevant`)
2. Агрегация цен: min, median, premium
3. **Кросс-валидация цен:** если 2+ источника дают медианы в пределах 3x → `priceCrossValidated = true`
4. **Psychological threshold** — ближайший психологический уровень к медиане:
   - Уровни: `[9, 19, 29, 49, 79, 99, 199, 299, 499, 999, 2999]`
5. **has_trial_period** — агрегация сигналов:
   - `true` если хоть один конкурент имеет trial
   - `null` если нет информации ни об одном
   - `false` если явно нет trial ни у кого
6. Reddit бюджеты:
   - SerpAPI: `site:reddit.com "{niche}" ("how much" OR "price" OR "cost") pricing budget`
   - Haiku: классифицирует sentiment (complaint / neutral / satisfaction)

**Pricing Confidence (Multi-Pass 3):**
| Уровень | Условие |
|---------|---------|
| **high** | 2+ источника с подтверждёнными ценами (кросс-валидация) |
| **medium** | 1 источник (concentrated niche) ИЛИ данные доступны |
| **low** | Нет данных или все extractions failed |

**Слой 2 — Барьер к покупке (Barrier to Purchase):**

### ƒРасчёт deal_cycle_days:
```
base = B2B → 14д, B2B2C → 7д, B2C → 2д

× pain_type:
  bad_solution  → ×0.5 (быстрое переключение)
  no_solution   → ×2.0 (нужна эдукация)

+ trial:
  true  → -3д
  false → +5д
  null  → +0д

+ complexity:
  simple   → +0д
  moderate → +7д
  complex  → +14д

+ decision_makers:
  single     → +0д
  small_team → +7д
  large_org  → +14д
```

- `budget_category_exists` = true если 2+ сигнала из:
  - `competitors_are_paid` (из Блока 2)
  - `commercial_intent_high` (из Блока 2)
  - `reddit_mentions_budget` (из Layer 1)
- `time_to_first_revenue_days = deal_cycle_days + 30`

**First payment friction:**
```
if psychological_threshold = null  → "medium"
if psychological_threshold < 50    → "low"
if psychological_threshold < 200   → "medium"
else                               → "high"
```

**Слой 3 — Каналы и точки перехвата:**
- SerpAPI: `site:reddit.com {competitor.domain} OR {competitor.name}` → сабреддиты, Slack, Discord
- Haiku: анализирует community из SERP результатов
- `primary_channel` — самый активный канал с наибольшим trust_score
- Traffic interception points из коммерческих keywords Блока 2

### Диагностика:

| Диагноз | Reason | Условие |
|----------|--------|---------|
| **GREEN** | easy_to_sell | `budget_exists` + `deal_cycle <= 14д` + `has_channel` + `price_range.data_available` |
| **YELLOW** | needs_work | `budget_exists` + (`deal_cycle > 14д` ИЛИ `no channel`) |
| **YELLOW** | channel_not_found | рынок есть, но канал не найден |
| **RED** | hard_to_sell | `!budget_exists` + `deal_cycle > 30д` |
| **YELLOW** | unclear_signals | всё остальное |

### Output для downstream блоков:
- `price_range.median` → Блок 4 (segment), Блок 5 (revenue calc)
- `sale_cycle_days` → Блок 5 (months_to_first_revenue)
- `budget_exists` → Блок 5 (Method 3 confidence)
- `payment_model` → Блок 4 (strategic gap анализ)
- `primary_channel` → GTM стратегия
- `data_quality` → Блок 6 (Multi-Pass confidence)

---

## 4. КОНКУРЕНЦИЯ (Block 4) — "Где конкуренты слепые?"

**Файл:** `frontend/src/app/api/evidence/competition/route.ts`
**Зависимости:** Блок 2 (`competitors_found`), Блок 3 (`price_range`, `payment_model`)
**AI модели:** Haiku (классификация жалоб) + Sonnet (strategic vs execution gap + точка входа)
**SerpAPI:** 3 × 3 конкурента (G2, LinkedIn, MRR) + 2 × 3 (G2 reviews, Trustpilot) = **до 15 вызовов**

### Алгоритм (3 слоя):

**Слой 1 — Картография (размер конкурентов):**

Для каждого из топ-3 конкурентов **параллельно** 3 прокси:
1. **G2 reviews** (высший приоритет): `site:g2.com "{domain}" reviews`
2. **LinkedIn employees:** `site:linkedin.com/company "{name}" employees`
3. **MRR mentions:** `"{domain}" MRR OR revenue OR "annual recurring"`

### ƒРасчёт размера конкурента:
```
Иерархия прокси (по приоритету):

1. G2 reviews:
   userEstimate = g2_reviews × 300
   confidence = reviews >= 100 → "high"
              = reviews >= 20  → "medium"
              = иначе          → "low"

2. LinkedIn employees (если нет G2):
   userEstimate = employees × 100
   confidence = "low"

3. MRR mentions (если нет G2 и LinkedIn):
   userEstimate = mrr_mentioned / 50
   confidence = "medium"

Размер по userEstimate:
  0-100    → micro
  100-1K   → small
  1K-10K   → medium
  10K+     → large
```

- `primary_segment` определяется по цене из Блока 3:
  - `price > $200` → enterprise
  - `price > $30` → smb
  - иначе → consumer

**Слой 2 — Gap анализ (2-шаговый):**

**Шаг 1: Haiku — классификация жалоб по 6 категориям (объём):**
1. Для каждого конкурента **параллельно**:
   - SerpAPI: `site:g2.com "{domain}" "1 star" OR "2 stars" reviews problems`
   - SerpAPI: `site:trustpilot.com "{domain}" bad review`
2. Haiku: классифицирует каждый отзыв:
   - `pricing_model` — жалобы на цену, тарифы
   - `missing_feature` — нет нужной функции
   - `ux_bug` — плохой UX, баги
   - `performance` — медленно, падает
   - `support` — плохая поддержка
   - `integration` — проблемы с интеграциями, API

**Шаг 2: Sonnet — определение типа gap (качество):**

Для топ жалобы каждого конкурента Sonnet решает:

| Тип | Определение | Пример |
|-----|------------|--------|
| **Strategic Gap** | Конкурент **НЕ МОЖЕТ** исправить без ущерба для бизнес-модели | Slack не может убрать лимит бесплатного плана — это главный рычаг конверсии |
| **Execution Gap** | Конкурент **МОЖЕТ** исправить за квартал | Медленная загрузка — техническая проблема, не связана с моделью |

Sonnet получает контекст: сегмент, бизнес-модель, размер, жалобу + количество упоминаний.

**Слой 3 — Точка входа (Sonnet):**
- Sonnet формулирует:
  - `entry_point` — "Войти через {конкурент} потому что {конкретная причина}"
  - `entry_point_reasoning` — 1-2 предложения обоснования
  - `strategic_gap_summary` — если gap стратегический
  - `positioning_vectors` — 3 конкретных вектора позиционирования

### Диагностика (5 веток):

| Диагноз | Reason | Условие | Score |
|----------|--------|---------|-------|
| **GREEN** | no_competitors | 0 конкурентов найдено | 8 |
| **YELLOW** | insufficient_data | < 5 отзывов проанализировано | 4 |
| **GREEN** | strategic_gap | Есть хотя бы 1 Strategic Gap | min(10, 7 + strategic_count) |
| **YELLOW** | execution_gap | Только Execution Gap | 5 |
| **RED** | no_gap | Нет gap вообще | 2 |

### Output для downstream блоков:
- `gap_type` → Блок 5 (market_share %), Блок 6 (lockin_opportunity)
- `top_competitor_g2_reviews` → Блок 5 (Method 1: competitor_customers)
- `top_competitor_size` → Блок 5 (fallback для Method 1), Блок 6 (lockin_opportunity)
- `top_gap_category` → Блок 6 (pricing_gap, lockin_opportunity detection)
- `has_strategic_gap` → Блок 6 (pricing_gap condition)
- `entry_point` → Синтез, Стратегия
- `positioning_vectors` → Синтез, Стратегия

---

## 5. ЭКОНОМИКА (Block 5) — "Сколько денег возможно сделать?"

**Файл:** `frontend/src/app/api/evidence/revenue-sizing/route.ts`
**Зависимости:** Блок 2, 3, 4 (все обязательны)
**AI модели:** НИКАКИХ — **чистая математика**
**SerpAPI:** 0 вызовов

### Алгоритм (3 метода):

**Метод 1 — Competitor-Based Revenue:**
```
ƒ competitor_customers:
  if g2_reviews (из Блока 4):
    competitor_customers = g2_reviews × 300
    data_source = "g2_reviews"
  elif competitor_size_fallback (из Блока 4):
    competitor_customers = sizeEstimateToCustomerCount(size)
      micro  = 50
      small  = 500
      medium = 3,000
      large  = 15,000
    data_source = "competitor_size_fallback"

ƒ competitor_revenue_annual:
  competitor_customers × pricing_median (из Блока 3) × 12

ƒ market_share (зависит от gap_type из Блока 4):
  strategic_gap → 15%
  execution_gap → 5%
  no gap        → 2%

ƒ revenue_estimate:
  competitor_revenue_annual × market_share

ƒ confidence:
  g2_reviews >= 100 → "high"
  g2_reviews >= 20  → "medium"
  g2_reviews < 20   → "low"
  size_fallback     → "medium"
```

**Метод 2 — Demand Signal (только модификатор, не число):**
```
Входные данные из Блока 2:
  commercial_intent_ratio, has_declining_signal

ƒ confidence_modifier:
  if has_declining_signal       → "reduce"
  if commercial_ratio > 0.7     → "boost"
  if commercial_ratio 0.4-0.7   → "neutral"
  if commercial_ratio < 0.4     → "reduce"
```

**Метод 3 — Deal Cycle:**
```
Входные данные из Блока 3:
  sale_cycle_days, budget_category_exists

ƒ months_to_first_revenue = sale_cycle_days / 30

ƒ confidence:
  budget_category_exists → "medium"
  else                   → "low"
```

### ƒ Revenue Range (финальный расчёт):
```
revenue_low  = revenue_estimate × 0.7
revenue_mid  = revenue_estimate        ← ОСНОВНАЯ МЕТРИКА
revenue_high = revenue_estimate × 1.3
```

### ƒ Финальная Confidence (3 модификатора):
```
base = Method 1 confidence

if Method 2 modifier = "boost"  → upgrade (low→medium, medium→high)
if Method 2 modifier = "reduce" → downgrade (high→medium, medium→low)

if Method 3 confidence = "low" AND base = "high" → downgrade to "medium"
```

### ƒ CAC Estimate (из serp_ad_density Блока 2):
```
if ad_density > 0.3 → pct = 50%
if ad_density > 0.1 → pct = 20%
else                → pct = 5%

CAC = pricing_median × pct
```

### ƒ Data Quality Score:
```
base = 0
+ Method 1 applied → +3
+ Method 2 applied → +2
+ Method 3 applied → +2
max = 10
```

### Диагностика:

| Диагноз | Условие | Score | Viability |
|----------|---------|-------|-----------|
| **GREEN** | `revenue_mid > $100K` + confidence HIGH + `months < 12` + не declining | 8 | viable |
| **YELLOW** | `revenue_mid > $50K` + (confidence MEDIUM ИЛИ months < 24) | 5 | marginal |
| **RED** | всё остальное | 2 | not_viable |

### Output для downstream блоков:
- `revenue_mid` → Синтез (conflict detection: Demand GREEN + Economics RED?)
- `confidence` → Синтез
- `months_to_first_revenue` → Синтез, Стратегия
- `cac_estimate` → Синтез, Стратегия
- `revenue_viability` → Синтез

---

## 6. СЛЕПЫЕ ПЯТНА (Block 6) — "Что не видит никто кроме тебя?"

**Файл:** `frontend/src/app/api/evidence/blind-spots/route.ts`
**Зависимости:** Блоки 1-5 (все обязательны)
**AI модели:** Sonnet (формулирование инсайтов, до 5 параллельных вызовов)
**SerpAPI:** 0 вызовов

### Алгоритм:

**Этап 1 — Детерминированное определение типов (без AI):**

5 типов слепых пятен проверяются по данным блоков 1-5:

| Тип | Условие | Данные из | Impact |
|-----|---------|-----------|--------|
| **unserved_segment** | `commercial_intent > 0.6` + `paying_ratio < 0.3` | Б1 + Б2 | high |
| **pricing_gap** | `top_gap = pricing_model` + `strategic_gap` + `price confidence != low` | Б3 + Б4 | high |
| **tech_shift** | `rising_queries_ratio > 0.4` + `!has_hype_risk` | Б2 | high |
| **intent_mismatch** | `demand_index > 30` + `commercial_intent < 0.45` | Б2 | medium |
| **lockin_opportunity** | `competitor = large` + `gap ∈ [integration, missing_feature]` + `strategic` | Б4 | medium |

**Strength (сортировка кандидатов):**
- `unserved_segment`: commercial_intent - paying_ratio
- `pricing_gap`: 0.85 (фиксированная)
- `tech_shift`: rising_queries_ratio
- `intent_mismatch`: demand_index / 100
- `lockin_opportunity`: 0.8 (фиксированная)

Кандидаты сортируются по `strength`, берутся топ 3-5.

**Этап 2 — Sonnet формулирует каждый инсайт (параллельно):**
- `title` — 3-5 слов, заголовок (не вопрос, не список)
- `insight` — 2-3 предложения с конкретикой из данных
- `teaser` — одно предложение-интрига без раскрытия (для locked пятен)

**Multi-Pass 3 — Confidence пятна:**
```
confidence = MIN(upstream_confidence) из блоков, от которых зависит пятно

Пример:
  unserved_segment зависит от Б1 + Б2
  Б1 confidence = "high", Б2 confidence = "medium"
  → spot confidence = "medium"
```

### Монетизация:
| Элемент | Доступ |
|---------|--------|
| Пятно 0 (первое) | Бесплатно сразу |
| Пятна 1-N | По одному в день ИЛИ все сразу за 5 токенов |
| Синтез получает | Только мета (count, types, impact) — не содержимое |

### Диагностика:

| Диагноз | Условие | Score |
|----------|---------|-------|
| **GREEN** | `high_impact >= 2` + `total >= 3` | 3 + high×2 + (total>3 ? 1 : 0) |
| **YELLOW** | `high_impact >= 1` | 3 + high×2 |
| **RED** | `high_impact = 0` | 3 |

### Дополнительные метрики:
- `has_revenue_multiplier` = true если impact HIGH + есть `pricing_gap` (меняет revenue estimate)
- `conflict_weight`: high impact → 1, medium → 2, low → 2

---

## 7. AI СИНТЕЗ (Block 7) — "GO / NO GO / EXPERIMENT"

**Файл:** `frontend/src/app/api/synthesis/route.ts`
**Промпты:** `frontend/src/lib/synthesis/prompts/skeptic.ts`, `optimist.ts`, `arbitrator.ts`
**Conflict detection:** `frontend/src/lib/synthesis/conflict-detection.ts`
**Зависимости:** Все 6 блоков (обязательны)
**AI модели:** Sonnet (Скептик, Оптимист) + Opus (Арбитр; Скептик при Blind Spot)
**SerpAPI:** 2 (новости за 90 дней)
**Стоимость:** 20 монет
**Формат:** SSE stream (Server-Sent Events)

### Алгоритм:

**Шаг 1 — Авторизация + проверка баланса:**
- Минимум 20 монет на балансе
- Монеты списываются ДО запуска агентов (нельзя прервать и получить бесплатно)

**Шаг 2 — Чтение блоков из Supabase:**
- Все 6 блоков читаются с сервера (НЕ от фронтенда — защита от подмены)
- Каждый блок: `diagnosis, score, conflict_weight, key_factors, key_metric, block_context`

**Шаг 3 — Conflict Detection (детерминированный, без AI):**

11 предустановленных паттернов конфликтов между блоками:

| Конфликт | Пример | Тип | Weight |
|----------|--------|-----|--------|
| Спрос GREEN + Экономика RED | Спрос есть но денег не сделать | existential | 3 |
| Проблема GREEN + Конкуренция RED | Боль есть но рынок закрыт | operational | 2 |
| Продажи GREEN + Экономика RED | Продать легко но экономика не сходится | operational | 2 |
| Слепые пятна HIGH + Конкуренция GREEN | Есть слепые пятна которые конкуренты не видят | manageable | 1 |

**Шаг 4 — Внешний контекст (параллельно с conflict detection):**
- SerpAPI News: `{niche} regulation law ban 2025 2026`
- SerpAPI News: `{niche} market disruption Google Apple OpenAI announcement`

**Шаг 5 — Скептик (Sonnet, или Opus если Blind Spot):**

Два режима:

| Режим | Условие | Задача | Output |
|-------|---------|--------|--------|
| **Конфликты есть** | conflicts.length > 0 | Углубить механизм каждого конфликта для ниши | `points[]`: conflict_pair, mechanism, severity |
| **Конфликтов нет** | conflicts.length === 0 | Найти 3 скрытых риска (regulatory, technological, cultural) | `blind_spots[]`: category, risk, timeline |

Модель: Sonnet обычно, **Opus** если конфликтов нет (Blind Spot) — нужен более широкий контекст.

**Шаг 6 — Оптимист (Sonnet):**
- Получает: блоки + конфликты + вывод Скептика
- Задача: НЕ опровергает Скептика, а ищет **условие нейтрализации** для каждой угрозы
- "При каком условии эта угроза перестаёт быть фатальной?"
- Output: `neutralizations[]` с типами:
  - `pricing_model` — изменение ценовой модели
  - `strategic_gap` — использование слабости конкурента
  - `pivot` — разворот продукта
  - `partnership` — стратегическое партнёрство
  - `sequencing` — правильная последовательность действий

**Шаг 7 — Арбитр (Opus):**
- Получает ВСЁ: 6 блоков + конфликты + Скептик + Оптимист
- Выносит вердикт:

| Вердикт | Условие |
|---------|---------|
| **GO_IF** | Нет existential конфликтов ИЛИ главный конфликт нейтрализован + confidence > 0.65 |
| **NO_GO_UNTIL** | Existential конфликт (weight 3) без нейтрализации ИЛИ Problem/Competition = RED |
| **EXPERIMENT_IF** | Данных достаточно для гипотезы, но не для уверенности; только operational конфликты |

- `verdict_condition` — одно предложение: что должно быть истиной для GO
- `verdict_reasoning` — одно предложение со ссылкой на главный конфликт
- `confidence` — число 0.0-1.0
- 3 приоритетных действия:
  1. **Действие 1:** Решает главный (самый тяжёлый) конфликт
  2. **Действие 2:** Решает следующий конфликт
  3. **Действие 3:** **Усиливает** самый сильный GREEN блок (не фиксит проблемы — развивает сильные стороны)

**Шаг 8 — Сохранение + кэширование:**
- Результат upsert в `synthesis_results` (trend_id + user_id)
- Кэш доступен через `/api/synthesis/cached` (GET, без повторного списания монет)

---

## Сводная таблица ресурсов

| Блок | SerpAPI | AI вызовы | Модель | Зависит от | Стоимость |
|------|---------|-----------|--------|------------|-----------|
| 1. Проблема | до 6 | ~3 Haiku | claude-haiku-4-5 | — | бесплатно |
| 2. Спрос | до 5 | ~2 Haiku | claude-haiku-4-5 | — | бесплатно |
| 3. Продажи | до 10 | ~3 Haiku | claude-haiku-4-5 | Б1, Б2 | бесплатно |
| 4. Конкуренция | до 15 | Haiku + 2 Sonnet | haiku + sonnet-4-6 | Б2, Б3 | бесплатно |
| 5. Экономика | 0 | 0 (математика) | — | Б2, Б3, Б4 | бесплатно |
| 6. Слепые пятна | 0 | до 5 Sonnet | sonnet-4-6 | Б1-5 | unlock: 5 токенов |
| 7. AI Синтез | 2 | Sonnet×2 + Opus×1 | sonnet + opus-4-6 | Б1-6 | 20 монет |
| **ИТОГО** | ~38 | ~16 | — | — | 25 монет |

---

## Граф зависимостей данных

```
Блок 1 (Проблема)  ──→ pain_type ──────────────→ Блок 3 (deal_cycle)
                    ──→ paying_ratio ────────────→ Блок 6 (unserved_segment)
                    ──→ pain_clusters ───────────→ Синтез

Блок 2 (Спрос)     ──→ competitors_found ───────→ Блок 3, Блок 4
                    ──→ commercial_intent_ratio ─→ Блок 5, Блок 6, Синтез
                    ──→ serp_ad_density ─────────→ Блок 5 (CAC)
                    ──→ has_declining_signal ─────→ Блок 5, Синтез
                    ──→ rising_queries_ratio ─────→ Блок 6 (tech_shift)
                    ──→ has_hype_risk ───────────→ Блок 6 (фильтр)

Блок 3 (Продажи)   ──→ price_range.median ──────→ Блок 4 (segment), Блок 5 (revenue)
                    ──→ sale_cycle_days ──────────→ Блок 5 (months_to_first_revenue)
                    ──→ budget_exists ────────────→ Блок 5 (Method 3 confidence)
                    ──→ payment_model ────────────→ Блок 4 (strategic gap)

Блок 4 (Конкуренция)──→ gap_type ────────────────→ Блок 5 (market_share %), Блок 6
                    ──→ top_competitor_g2_reviews → Блок 5 (Method 1)
                    ──→ top_competitor_size ──────→ Блок 5 (fallback), Блок 6
                    ──→ top_gap_category ─────────→ Блок 6 (pricing_gap, lockin)
                    ──→ has_strategic_gap ─────────→ Блок 6 (pricing_gap)

Блок 5 (Экономика)  ──→ revenue_mid ─────────────→ Синтез (conflict detection)
                    ──→ months_to_first_revenue ──→ Синтез, Стратегия

Блок 6 (Сл. пятна) ──→ blind_spots_count ────────→ Синтез (meta only)
                    ──→ blind_spots_impact ────────→ Синтез
                    ──→ has_revenue_multiplier ────→ Синтез

Все блоки 1-6       ──→ Синтез (Скептик → Оптимист → Арбитр)
```

---

## Multi-Pass Validation (сквозная)

Принцип: каждый блок передаёт `data_quality` / `confidence` вниз по цепочке.

| Блок | Что передаёт | Кому |
|------|-------------|------|
| Б1 | `classification_confidence` (high/medium/low от % failed batches) | Б6 |
| Б2 | `volume_confidence`, `commercial_intent_confidence` | Б5, Б6, Синтез |
| Б3 | `pricing_confidence`, `overall_data_confidence` | Б5, Б6 |
| Б4 | нет явного confidence поля (количество отзывов = прокси) | Б5, Б6 |
| Б5 | `data_quality_score` (1-10), `confidence` | Синтез |
| Б6 | spot confidence = MIN(upstream confidence) | Синтез |
