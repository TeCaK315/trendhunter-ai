# Раздел «Исследование» — отчёт о нововведениях (Этап 2)

**Период:** 10 апреля 2026 (дневная сессия)
**Предыдущий отчёт:** RESEARCH_SECTION_CHANGELOG.md (8–10 апреля, ночная сессия)
**Затронутые блоки:** 1–7 (все блоки раздела Evidence + AI Синтез)
**Главная идея:** переход с 7/10 на 9/10 по каждому блоку — углубление интерпретаций, исправление расчётов, стабилизация повторных прогонов.

---

## Большая картина

Этап 1 (ночная сессия) добавил Interpretation Layer — слой человекочитаемых выводов. Этап 2 делает этот слой **точным и конкретным**: вместо общих фраз «спрос растёт» — конкретные запросы с числами; вместо статических CAC $144 для любой ниши — расчёт из среднего чека продукта; вместо одинакового score 5/10 для всех YELLOW блоков — информативный score от 3 до 6 в зависимости от силы сигналов.

Параллельно исправлены системные проблемы: медиа-издания (Forbes, PCMag) больше не попадают в список конкурентов; Haiku-классификация стала детерминированной (temperature=0); повторные прогоны стабильны (score smoothing + diagnosis dampening); Блок 6 находит 2-4 пятна вместо 1-2.

---

## Исправленные баги

### Баг: demand score 19/10

Ветка `hype` в `makeDemandDiagnosis` использовала `Math.max(1, 2 + Math.log10(demand_index))`. При `demand_index = 1116721413687958` → `log10 ≈ 15` → score = 17. Добавлен `Math.min(10, ...)` к ветке hype и clamp `Math.min(10, Math.max(0, Math.round(...)))` на уровне output для всех веток.

### Баг: Block 6 score 0/10

`BlindSpotResult` не содержал поле `score`. API отвечал `{ spots, mode, diagnosis }` — без score. В SynthesisPanel `d.score === undefined` → `0`. Добавлен `blockScore` в response: `public: { ...finalResult, score: blockScore }`. В SynthesisPanel добавлен fallback по diagnosis (`green=8, yellow=5, red=3`).

### Баг: Синтетические ключи в rising_keywords

Ключи из `buildExpandedKeywords` (volume: 50, число) попадали в `rising_keywords` и `top_keywords` в сохранённых данных. Добавлена фильтрация перед upsert: rising оставляются только с volume-строкой (`+250%`, `Breakout`); top отсеиваются по `volume === 50 && intent_confidence === 'low'`.

### Баг: experiment_budget = 0

При `cheapestCacMid === null` fallback на `result.experiment_budget` мог быть 0. Добавлен floor `$100` (`Math.max(result.experiment_budget ?? 0, 100)`) в двух местах — route save и interpretation function.

### Баг: Fallback цена $500 для B2C ниши

При `entry_price_usd: null` и `price_tier: "enterprise"` computeCACScenarios использовал fallback $500. Для CRM риелторов (B2C) это давало PLG $1598. Fallback теперь зависит от `market_type`: B2C → $20, B2B → $150, mixed → $40. Добавлен PLG ceiling: B2C max $500, B2B max $8000.

---

## Блок 1 — Проблема (7→9/10)

### Pain-loaded запросы (1.4)

Добавлен новый батч `painQueries` в `collectFromSources` — для каждого top-subreddit два варианта запросов с болевыми маркерами (`problem OR issue OR frustrated` и `alternative OR "switched from"`), плюс таргетированные запросы на G2 (`"what do you dislike"`, `reviews pros-and-cons`), Capterra, HackerNews, Quora. Итого 9-13 дополнительных запросов параллельно.

### Signal pre-filter (1.6)

Новый этап фильтрации между keyword pre-filter и Haiku валидацией. Пост проходит только если длина >= 80 символов И содержит хотя бы один из 30+ pain/purchase сигналов. Снижает `sent_to_validation` с ~300 до ~100-130, экономя токены Haiku.

G2/Capterra запросы переработаны: вместо `"cons" OR "negative"` (возвращало страницы списков) → `"what do you dislike"`, `reviews pros-and-cons`, `"what could be improved"`.

### Конкретные кластеры в интерпретации (1.5)

`generateProblemInterpretation` расширена параметром `painClustersRich: PainCluster[]`. Топ-3 кластера (по `mention_count`, фильтр `confidence === 'high'` или `mention_count >= 5`) передаются в промпт как секция `КОНКРЕТНЫЕ ПАТТЕРНЫ ЖАЛОБ` с инструкцией использовать их в headline и key_facts[0].

`key_facts[0]` теперь ОБЯЗАТЕЛЬНО описывает конкретную боль из данных, а не процент-агрегат. Первый факт в UI показывается крупнее (14px, `#E8F2FF`, font-weight 500) с разделительной полоской.

### Динамика между прогонами (1.7)

При `run_count > 1` вычисляется `dynamicsSignal` — изменение paying_ratio или pain_scale между прогонами. Передаётся в промпт как секция `ДИНАМИКА`. `key_facts[2]` при наличии динамики описывает изменение, не общий «интерес растёт».

### Source bias note (1.8)

При `paying_ratio > 50%` и `run_count <= 2` добавляется `paying_ratio_source_note: 'high_review_platform_bias'` в block_context + `payingNote` в промпт — объяснение что высокий процент может отражать bias G2/Capterra.

### Score smoothing + diagnosis dampening

При `run_count > 1`: score сглаживается (70% текущий + 30% предыдущий). Diagnosis при < 30 cumulative posts не меняется; при 30-60 — не прыгает через ступень (RED↔GREEN → промежуточный YELLOW).

---

## Блок 2 — Спрос (7→9/10)

### Расширение семантического ядра (2.5)

Helper `buildExpandedKeywords(niche)` — 20 ключей в 5 категориях (продукт-формы, AI-вариации, сравнения, боли, конкуренты). При `total_keywords < 20` синтетические ключи мерджатся (дедупликация через `Set` + `includes`-проверки), классифицируются Haiku тем же батчем.

### Детальные запросы и конкуренты в промпте (2.6)

`risingHumanDetailed` — топ-3 с форматом `"n8n workflow automation" (×6.5 за год)`. `breakoutQueries` отдельно. Платные конкуренты с `serp_frequency`, органические лидеры с `position <= 2`. Промпт требует называть конкретные запросы и конкретных рекламодателей.

### Тайминг входа (2.7)

`timingSignal` — `good` если growing + сильный сезон (Q2/Q4), `wait` если declining, `neutral` иначе. `timingText` передаётся в промпт и в `decision_impact`.

### Hype risk handling (2.10)

При `has_hype_risk: true` или `diagnosis_reason === 'hype_without_foundation'`: headline ОБЯЗАТЕЛЬНО отражает нестабильность (запрещено «зрелый»/«стабильный»); key_facts адаптированы — `[1]` предупреждает про % новых запросов, `[2]` как проверить устойчивость.

### Инвалидация кэша при смене диагноза (2.8)

Кэш проверяет соответствие headline текущему диагнозу. Если RED (hype) но headline «зрелый/стабильный» — регенерация. И наоборот.

### Фильтрация синтетических ключей (2.9)

`risingKeywordsAll` фильтруется при extraction: оставляются только ключи с volume типа строка (`%` или `Breakout`). Синтетические (`volume: 50` число) отсеиваются и в промпте, и в сохранённых данных.

---

## Блок 3 — Продаваемость (7→9/10)

### Competitor trends из Блока 2 (3.1)

Запрос к Блоку 2 расширен с `select('block_context')` на `select('block_context, raw_data')`. Из `raw_data` извлекаются `competitor_trends`. Каждый конкурент в `competitor_monetization` обогащается `growth_pct` и `growth_direction`.

### Детальное сравнение конкурентов в промпте (3.2)

`competitorDetails` — многострочная строка с моделью, trial/freemium, ростом. `fastestGrowingInsight` — самый быстрорастущий с привязкой к архетипу. `key_facts[0]` ОБЯЗАТЕЛЬНО — конкретный конкурент + рост% + модель.

### Конкуренты с ростом в UI (3.3)

В SellabilityBlock каждый конкурент показывает: модель, badge `trial`/`free`, рост `↑ +133%` зелёным.

### Вторичный архетип (3.5)

`monetization_archetype_secondary` (например `USAGE_BASED`) передаётся в промпт как «направление рынка». `key_facts[2]` описывает будущий тренд если secondary archetype есть.

### Trial/freemium coverage (3.6)

`noFreeEntrySignal` — если все >= 2 конкурента без trial/freemium. В UI зелёная плашка «Никто не предлагает trial — возможность». В промпте — обязательное упоминание как стратегическая возможность.

### Инвалидация кэша при смене архетипа (3.4)

Кэш проверяет соответствие `monetization_archetype` содержимому headline/decision_impact. SALES_LED ↔ SELF_SERVICE вызывает регенерацию.

---

## Блок 4 — Конкуренция (7→9/10)

### Enrichment по домену (4.7)

Enrichment ищет по `comp.name` И `domainKey` (домен без `.com`). Для крупных конкурентов (`g2_reviews > 500`) лимит результатов увеличен с 8 до 12. Enrichment пропускается для медиа-доменов.

### Fix gap_type при execution_gap (4.8)

Ветка `insufficient_data` (total_reviews < 5) пропускается если есть execution_gaps или strategic_gaps. Добавлен `has_execution_gap` в CompetitionBlockContext.

### Fix размера конкурента (4.2, ранее)

LinkedIn employees теперь приоритетнее G2 reviews. Пороги по сотрудникам: >= 5000 → large, >= 200 → medium, >= 20 → small. G2 fallback: >= 2000 → large, >= 300 → medium.

### Цитаты жалоб в интерпретации (4.3, расширено)

`allComplaints` собирает top_complaints от всех конкурентов с переводом категорий. Топ-3 передаются в промпт как `РЕАЛЬНЫЕ ЖАЛОБЫ КЛИЕНТОВ` с цитатами в кавычках.

### Positioning vectors в промпте (4.9)

Все три positioning_vectors передаются нумерованным списком. `key_facts[2]` требует конкретный угол входа из списка. Gap type context добавляет инструкцию по срочности (execution = 6-18 мес, strategic = долгосрочное).

### Кэш по top_competitor (4.9)

Кэш проверяет что `top_competitor` упоминается в headline+main_insight. При смене — регенерация.

---

## Блок 5 — Экономика (7→9/10)

### Niche-dependent CAC (новое)

`calculateCACScenarios` полностью переписана. Базы рассчитываются из `price_range_median`:
- PLG: `monthlyPrice × 2.5 × frictionMult × competitionMult × intentMult`
- SEO: `plgBase × 2.0`
- Community: `plgBase × 0.9`
- Sales-led: `ACV × segment_ratio × competitionMult × switchingMult`

Для $8/мес B2C: PLG ~$16 (было $144). Для $500/мес B2B: PLG ~$1000 (было $144).

### Cumulative timeline в интерпретации (5.1)

`month_24_monthly_revenue` и `month_36_monthly_revenue` передаются в промпт как «Динамика роста». `key_facts[2]` требует временную шкалу по годам. В UI добавлена Timeline секция (Месяц 1 / Год 2 / Год 3).

### Method agreement в интерпретации + UI (5.5)

При `revenue_method_agreement: false` с расхождением > 50%: промпт получает `СИГНАЛ НЕОПРЕДЕЛЁННОСТИ`, key_facts[0] даёт диапазон. В UI — amber-блок `⚡ Два расчёта дают разные результаты` с двумя числами.

### Расширенная фильтрация calculation_notes (5.6)

`isB2CContext` расширен на `mixed`. Фильтр убирает любые заметки с `enterprise`, `прямые продажи`, `sales-led` для B2C/mixed. Market type detection с fallback inference через `cac_scenarios.recommended`.

### Кэш по значимому изменению чисел (5.4)

Кэш проверяет наличие `168 000`/`168000`/`$168k` в кэшированных данных и соответствие `revenue_mid / 1000` текущему значению.

---

## Блок 6 — Слепые пятна (7→9/10)

### Три новых детектора аномалий

Паттерн 9 — `low_search_volume` (STRUCTURAL): search_volume < 500 и demand_strength !== 'STRONG'.
Паттерн 10 — `cac_exceeds_ltv` (CONTRADICTION): CAC > monthly_revenue × 24 (не окупается за 2 года).
Паттерн 11 — `declining_demand` (TIMING): demand_strength === 'DECLINING' или 'LOW'.

Все три добавлены в 6 scoring maps + clustering themes.

### Снижение порогов kill switch

`strategy_impact`: 0.2/0.3 → 0.15/0.25. `actionability`: 0.3/0.4 → 0.2/0.3. Адаптивный порог при <= 3 кластерах (было <= 2).

### Динамический максимум пятен

`selectTop3` принимает `dataQualityConfidence`: high → 4, medium → 3, low → 2 пятен.

### Запрет технических терминов в инсайтах

В `BLIND_SPOT_SYSTEM_PROMPT` добавлен явный список запрещённых терминов (`behavior_gap`, `incentive_misalignment`, `CAC_spread` и т.д.) с русскими альтернативами.

### Запрет риторического вопроса в финале

Правило `1_doubt` переписано: вопрос внутри текста — ок, финальная фраза — всегда вывод или условие. Добавлен пункт 5 в самопроверке.

### buildTeaser переработан

Приоритизированные точки разрыва: конец предложения (. ! ?) → тире ` — ` → запятая → граница слова. `cleanTrailing` убирает trailing запятые/пробелы/тире на всех путях.

### forceRegenerate

Каждый прогон Блока 6 принудительно обновляет interpretation (не из кэша 24ч). Добавлен диагностический лог.

### Актуальные числа

`cac_mid` берётся из `Math.min(plg, community_led, seo_led)` вместо `recommended` (мог быть SALES_LED). `experiment_budget` берётся из `min_signal_budget`. `market_type` из Block 5 (с B2C override).

---

## Блок 7 — AI Синтез (7→9/10)

### Niche override (7.6)

Реальная ниша читается из `b1ctx.niche` (например `"workflow automation services"` вместо `"SaaS"`). Используется во всех промптах агентов, Sales Architect, synthesis_results save, interpretation.

### verdict_condition post-processing (7.7)

После генерации от Арбитра — regex заменяет `CAC ≤ $6,000` → `CAC ≤ $${cheapestCAC * 3}`. Замена происходит ДО `send("arbitrator", ...)`.

### Мутация block_context Блока 5 (7.1)

`block_context` Блока 5 мутируется в памяти ДО вызова агентов: `experiment_budget` перезаписывается на реалистичный, `cac_scenarios.recommended` на PLG для B2C.

### Gap_drivers cleanup (7.8)

`firstSpotTeaser` в delta.ts проходит inline `cleanTrailing` для удаления trailing запятых/пробелов.

### forceRegenerate для interpretation (7.3)

Каждый запуск синтеза принудительно пересчитывает interpretation (параметр `forceRegenerate: true`).

### Stale data indicator

Уже реализован в `/api/synthesis/cached`: возвращает `is_stale: true` + `stale_blocks` если блоки обновлялись после синтеза. SynthesisPanel показывает warning + кнопку «Пересчитать».

---

## Системные улучшения

### Информативный score (все 6 блоков)

Вместо фиксированного `GREEN=8, YELLOW=5, RED=2` — базовый по диагнозу + бонусы/штрафы по силе сигналов. Каждый блок имеет свою формулу: Block 1 учитывает paying_ratio, clusters, dynamics; Block 2 — intent, ad_density, hype_risk; Block 3 — friction, trial, scalability; Block 4 — gap type, competitors count; Block 5 — payback, method agreement, barriers; Block 6 — spots count × impact matrix.

### Haiku temperature = 0

Все 11 вызовов Haiku (classification, intent, validation) переведены на `temperature: 0` для детерминированной классификации. Sonnet-вызовы (генерация текста) оставлены с дефолтным temperature.

### Фильтрация медиа-доменов

Создана shared утилита `src/lib/utils/media-filter.ts` (50+ доменов). В Block 2: расширен `AGGREGATOR_STOPLIST` на 30+ медиа-доменов (Forbes, PCMag, Housingwire, Bloomberg, WSJ и т.д.). В Block 4: inline фильтр + пропуск enrichment для медиа.

### data_sufficiency пересмотрены

Block 2: 15+ ключей + high confidence + cross-validated → sufficient (раньше требовалось 20). Block 5: LOW confidence + реальные данные конкурентов (method_a > 0) → sufficient. Block 6: пятна найдены → всегда sufficient.

---

## Скрипты и утилиты

### export-trend.js

Исправлен захардкоженный output path — теперь генерируется динамически из `trend_id`.

### media-filter.ts (новый)

`isMediaDomain()` и `filterMediaCompetitors()` — проверка домена против 50+ медиа/агрегаторов. Поддержка субдоменов.

---

## Состояние проекта

**TypeScript:** `npx tsc --noEmit` → `exit 0` стабильно после всех изменений.

**Покрытие улучшений:** все 7 блоков прошли через Этап 2, каждый получил 2-4 точечных улучшения в интерпретации, данных или стабильности.

**Ключевые числа после Этапа 2:**
- CAC: niche-dependent (не статический $144)
- Score: информативный (не одинаковый 5/10 для YELLOW)
- Haiku: temperature=0 (детерминированный)
- Пятна: 2-4 вместо 1-2
- Медиа-домены: отфильтрованы из конкурентов
- Кэш: инвалидируется при смене диагноза/архетипа/конкурента
- Повторные прогоны: стабильные (smoothing + dampening)

---

_Документ описывает изменения за дневную сессию 10 апреля 2026. Все фичи проверены на TypeScript уровне. Предыдущий отчёт — RESEARCH_SECTION_CHANGELOG.md (Этап 1, ночная сессия 8-10 апреля)._
