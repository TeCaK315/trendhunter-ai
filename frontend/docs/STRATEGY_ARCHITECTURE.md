# TrendHunter AI — Раздел «Стратегия»: Полная архитектура

> Версия: Апрель 2026  
> Статус: Production  
> Расположение в UI: вторая главная вкладка после «Исследование»

---

## I. ОБЩАЯ СТРУКТУРА

Раздел «Стратегия» — это второй этап работы с нишей. Пользователь сначала проходит «Исследование» (7 блоков Evidence), затем переходит в «Стратегию» где данные превращаются в actionable план.

### Подвкладки (7 штук)

| ID | Название (RU) | Название (EN) | Иконка | Компонент |
|---|---|---|---|---|
| `plan` | План | Plan | 📋 | ActionPlanBlock |
| `differentiation` | Дифференциация | Differentiation | 🎯 | DifferentiationBlock |
| `calculator` | Калькулятор | Calculator | 🧮 | FinancialCalculator |
| `scenarios` | Сценарии | Scenarios | 🔀 | ScenarioComparison |
| `survey` | Опрос | Survey | 📝 | SurveyGenerator |
| `gtm` | GTM | GTM | 🚀 | GtmPlanGenerator |
| `report` | Отчёт | Report | 📄 | ExecutiveSummary |

### Принцип работы
```
Исследование (Блоки 1-7)
  ├── problem → жалобы, боли, платящие
  ├── demand → спрос, тренды, интент
  ├── sellability → монетизация, цены, каналы
  ├── occupation → конкуренция, gaps, слабости
  ├── economics → revenue, CAC, payback
  ├── blind_spots → слепые пятна, аномалии
  └── synthesis → GO/EXPERIMENT/NO GO вердикт
           ↓
Стратегия (Раздел 2)
  ├── План действий (GO/NO GO + приоритеты)
  ├── Дифференциация (USP + позиционирование)
  ├── Калькулятор (unit economics в реальном времени)
  ├── Сценарии (пессимист/базовый/оптимист)
  ├── Опрос (генерация вопросов для CustDev)
  ├── GTM (Go-To-Market стратегия)
  └── Отчёт (PDF экспорт)
```

---

## II. ПОДРОБНОЕ ОПИСАНИЕ КАЖДОГО ПОДПУНКТА

### 1. План действий (ActionPlanBlock)

**Файлы:**
- API: `src/app/api/action-plan/route.ts` (674 строки)
- UI: `src/components/blocks/ActionPlanBlock.tsx`

**Что делает:**
Генерирует финальный вердикт GO/NO GO/PIVOT/MORE DATA на основе ВСЕХ данных из Исследования. Показывает:
- Overall Readiness Score (0-100) с формулой расчёта
- Executive Summary — текст для принятия решения
- Priority Actions — 5-7 конкретных шагов с доказательствами
- Unit Economics — CAC, LTV/CAC ratio, бизнес-модель
- Target Customer — сегмент, ценовая чувствительность
- Competitive Landscape — количество конкурентов, Blue Ocean score

**Входные данные:**
```typescript
{
  query: string,                    // название тренда
  evidenceData: {
    problem: { ... },               // данные блока 1
    demand: { ... },                // данные блока 2
    sellability: { ... },           // данные блока 3
    occupation: { ... },            // данные блока 4
    economics: { ... },             // данные блока 5
  },
  competition: { competitors }      // данные о конкурентах
}
```

**Выходные данные:**
```typescript
{
  overall_readiness: {
    score: number,                  // 0-100
    assessment: 'go' | 'no_go' | 'pivot' | 'more_data',
    confidence: number,
    blocks_analyzed: number,
    formula: string,                // формула расчёта
    block_scores: Record<string, number>,
    block_confidences: Record<string, number>
  },
  executive_summary: {
    text: string,
    sources_cited: number
  },
  priority_actions: Array<{
    priority: number,
    action: string,
    reasoning: string,
    evidence_source: string,
    evidence_url?: string
  }>,
  unit_economics: {
    estimated_cac: number,
    ltv_cac_score: number,
    business_model: string,
    median_price: number,
    scalability_score: number
  },
  target_customer: {
    segment: string,
    price_sensitivity: string,
    sales_complexity: string,
    top_complaints: string[]
  },
  competitive_landscape: {
    competitor_count: number,
    blue_ocean_score: number,
    saturation: string,
    weaknesses: string[],
    unmet_needs: string[]
  }
}
```

**Auto-fetch:** Загружается автоматически при открытии вкладки Стратегия (если Evidence данные есть).

**Минимальные требования:** 2 блока Evidence. Рекомендуется 4-5 для точных рекомендаций.

---

### 2. Дифференциация (DifferentiationBlock)

**Файлы:**
- API: `src/app/api/differentiation/route.ts` (226 строк)
- UI: `src/components/blocks/DifferentiationBlock.tsx`

**Что делает:**
Генерирует уникальное торговое предложение (USP) и стратегию позиционирования через Blue Ocean Framework.

**Ключевые выходы:**
- **Positioning Vectors** — 3 вектора позиционирования с описанием целевой аудитории, доказательствами из данных, и уровнем сложности реализации (low/medium/high)
- **USP Formula** — структурированное USP: для кого → что делает → чем отличается → полная формулировка
- **Blue Ocean Strategy** — четыре действия: Eliminate (убрать), Reduce (уменьшить), Raise (усилить), Create (создать)
- **Competitor Weaknesses** — слабости конкурентов → возможности для дифференциации
- **Blue Ocean Score** — числовая оценка "голубого океана"

**Зависимости:** Данные Блока 4 (competition), Блока 1 (problem), Блока 3 (sellability).

---

### 3. Калькулятор (FinancialCalculator)

**Файлы:**
- UI: `src/components/blocks/FinancialCalculator.tsx`
- Нет отдельного API — расчёты на клиенте

**Что делает:**
Интерактивный калькулятор unit economics с 8 слайдерами. Пересчитывает в реальном времени без серверных запросов.

**8 параметров (слайдеры):**
1. Monthly Price ($) — цена подписки
2. Monthly Churn (%) — процент оттока
3. Monthly Growth Rate (%) — темп роста
4. Customer Acquisition Cost ($) — CAC
5. Monthly Fixed Costs ($) — постоянные расходы
6. Initial Customers — стартовые клиенты
7. Gross Margin (%) — валовая маржа
8. Months — горизонт расчёта

**Рассчитывает:**
- ARPU (Average Revenue Per User)
- LTV (Lifetime Value = ARPU / Churn)
- LTV:CAC Ratio
- CAC Payback Period (месяцы)
- Break-even Month (когда revenue > costs)
- Runway (месяцы до конца денег)
- 12-месячная проекция выручки

**Особенности:**
- Значения по умолчанию берутся из Evidence данных (median_price, estimated_cac)
- Сохраняется в localStorage (не теряется при перезагрузке)
- Все расчёты детерминированные (нет AI)

---

### 4. Сценарии (ScenarioComparison)

**Файлы:**
- UI: `src/components/blocks/ScenarioComparison.tsx`
- Нет отдельного API — использует данные калькулятора

**Что делает:**
Сравнивает три бизнес-сценария бок о бок:

- **Пессимистичный** — churn ×1.5, growth ×0.5, CAC ×1.3
- **Базовый** — текущие значения из калькулятора
- **Оптимистичный** — churn ×0.7, growth ×1.5, CAC ×0.8

**Для каждого сценария показывает:**
- MRR через 12 месяцев
- Количество клиентов
- Общая выручка
- Break-even месяц
- LTV:CAC ratio

**Экспорт:** CSV с тремя сценариями.

---

### 5. Опрос (SurveyGenerator)

**Файлы:**
- API: `src/app/api/survey-generator/route.ts` (если есть) или генерация на клиенте
- UI: `src/components/blocks/SurveyGenerator.tsx`

**Что делает:**
Генерирует вопросы для CustDev интервью и онлайн-опросов на основе данных из Исследования.

**5 категорий вопросов:**
1. **Демография** — кто ваш клиент
2. **Текущее решение** — как решают проблему сейчас
3. **Боль** — насколько критична проблема
4. **Ценообразование** — сколько готовы платить
5. **Готовность** — купили бы решение

**Функции:**
- Автогенерация из Evidence данных (берёт реальные боли из Блока 1)
- Рекомендации каналов распространения (Reddit, LinkedIn, email)
- Экспорт в Google Forms формат
- Экспорт в plain text
- Отправка по email через интеграцию

---

### 6. GTM — Go-To-Market (GtmPlanGenerator)

**Файлы:**
- API: `src/app/api/gtm-plan/route.ts` (365 строк)
- UI: `src/components/blocks/GtmPlanGenerator.tsx`

**Что делает:**
Генерирует полный план вывода продукта на рынок.

**Секции плана:**

**A. Позиционирование:**
- Tagline
- Value proposition
- Differentiators (vs конкретных конкурентов с доказательствами)
- Target ICP (Ideal Customer Profile)

**B. Каналы привлечения (3 уровня):**
- **Tier 1 — Бесплатные:** SEO, Content, Community, Social
- **Tier 2 — Платные:** Google Ads, LinkedIn Ads, Retargeting
- **Tier 3 — Масштабирование:** Partnerships, Integrations, API

Для каждого канала: тактика, бюджет, ожидаемый ROI, временной горизонт.

**C. Ценовая стратегия:**
- Рекомендованная модель (subscription/usage/hybrid)
- Рекомендованная цена с обоснованием
- 2-3 тарифных плана с функциями

**D. Метрики:**
- North Star метрика
- Цели на 1/3/6 месяцев
- KPI по каналам

**E. Фазы запуска:**
- Фаза 1: Валидация (2-4 недели)
- Фаза 2: Early Adopters (1-2 месяца)
- Фаза 3: Масштабирование (3-6 месяцев)
- Критерии перехода между фазами

---

### 7. Отчёт (ExecutiveSummary)

**Файлы:**
- UI: `src/components/blocks/ExecutiveSummary.tsx`
- Использует данные из ActionPlan

**Что делает:**
Генерирует печатный отчёт (Executive Summary) с экспортом в PDF.

**Содержание отчёта:**
- Резюме для руководства (1 страница)
- Вердикт GO/NO GO с обоснованием
- Ключевые метрики (revenue potential, CAC, market size)
- Конкурентный ландшафт
- Рекомендованные действия
- Источники данных (ссылки на Evidence)

**Экспорт:** PDF с брендингом TrendHunter AI, print-оптимизированный CSS.

---

## III. ДОПОЛНИТЕЛЬНЫЕ API (вызываются из других разделов)

### Marketing Plan
**API:** `src/app/api/marketing-plan/route.ts` (392 строки)
**UI:** `src/components/MarketingPlan.tsx`

Генерирует детальный маркетинговый план с 5 вкладками:
- **Аудитория:** сегмент, демография, психография, где обитают
- **Сообщения:** pain-based hooks, value props с источниками
- **Каналы:** платформа, стратегия, бюджет, ROI, timing
- **Рекламные тексты:** готовые шаблоны для каждой платформы
- **Чеклист:** задачи запуска с ответственными и дедлайнами

### Marketing Strategy (бюджетный калькулятор)
**API:** `src/app/api/marketing-strategy/route.ts` (279 строк)

Принимает бюджет ($0 — ∞) и распределяет по каналам с прогнозом ROI.

### Venture Data (инвестиции)
**API:** `src/app/api/venture-data/route.ts` (691 строка)

Анализирует инвестиционный ландшафт ниши:
- Общий объём финансирования
- Последние раунды (компания, сумма, инвесторы, дата, источник)
- Активные инвесторы (имя, портфель, фокус)
- Investment Hotness Score (0-10)
- Зрелость рынка (pre-seed / seed / series-a / growth / mature)
- Рекомендация для питча

### Find Companies (поиск клиентов)
**API:** `src/app/api/find-companies/route.ts` (398 строк)

Ищет компании для outreach:
- Имя, сайт, LinkedIn, email
- Pain Match Score — насколько подходит
- Outreach Angle — под каким углом писать
- Contact Person — имя, должность, email

### Generate Email (cold outreach)
**API:** `src/app/api/generate-email/route.ts` (141 строка)

Генерирует cold email:
- Subject + Body (первое письмо)
- Follow-up Subject + Body
- Tips по отправке

---

## IV. ПРОЕКТ (третий раздел — генерация MVP)

### Product Spec
**API:** `src/app/api/product-spec/route.ts` (824 строки)

Генерирует спецификацию MVP до написания кода:
- User Output — что пользователь получает
- User Input — что вводит
- User Flow — шаги от входа до aha-moment
- Magic Location — где AI создаёт ценность
- Technical Requirements — стек, API, база данных
- Monetization — модель, тарифы, лимиты
- Derived Features — фичи из реальных болей Evidence

Каждая фича привязана к конкретной жалобе:
```typescript
{
  feature_name: "3-step wizard",
  pain_source: "Reddit r/hr",
  pain_quote: "setup takes forever, gave up after 2 hours",
  solution: "guided wizard with pre-filled templates",
  implementation_hint: "React multi-step form with progress bar",
  priority: "high"
}
```

### Generate Code
**API:** `src/app/api/generate-code/route.ts` (286 строк)
**Lib:** `src/lib/code-generator.ts` (90KB)

Генерирует функциональный MVP (50+ файлов):
- Next.js + TypeScript + Tailwind
- Supabase (Auth + PostgreSQL)
- Stripe (Subscriptions + Webhooks)
- Dashboard с usage tracking
- Уникальная дизайн-система из Design Analysis

Pipeline: Architect → Coder → Reviewer

Два уровня:
- **Level 1:** MVP spec (~10 файлов, 2-3 мин, $1-2)
- **Level 2:** Functional Prototype (~50 файлов, 15-20 мин, $5-10)

Деплой: GitHub push + опциональный Vercel deploy.

### Generate Landing
**API:** `src/app/api/generate-landing/route.ts` (507 строк)

Генерирует HTML landing page и деплоит на Vercel:
- Positioning из GTM данных
- Pain points из Evidence
- Pricing из Sellability
- CTA с аналитикой

### Generate Improvements
**API:** `src/app/api/generate-improvements/route.ts` (154 строки)

Генерирует идеи улучшений для существующего MVP:
- Product Vision
- Functionality Improvements (с приоритетами и user stories)
- UI/UX Improvements
- Monetization Ideas
- Roadmap (3 фазы)

### Generate Theme
**API:** `src/app/api/generate-theme/route.ts` (301 строка)

Генерирует CSS тему / дизайн-систему:
- CSS переменные
- Tailwind конфиг
- Color palette preview
- Шрифты

---

## V. БИБЛИОТЕКИ (lib/)

### Генерация кода
| Файл | Размер | Назначение |
|---|---|---|
| `lib/code-generator.ts` | 90KB | Основной pipeline: Architect→Coder→Reviewer |
| `lib/mvp-templates/types.ts` | 13KB | ProductSpecification interface |
| `lib/mvp-templates/index.ts` | 7KB | MVP type definitions |
| `lib/mvp-templates/ai-tool-generator-v2.ts` | 71KB | Level 2 MVP (Supabase+Stripe+Auth) |
| `lib/mvp-templates/ai-tool-generator.ts` | 30KB | Level 1 MVP generator |
| `lib/mvp-templates/calculator-generator.ts` | 29KB | Calculator template |
| `lib/mvp-templates/dashboard-generator.ts` | 25KB | Dashboard template |
| `lib/mvp-templates/landing-generator.ts` | 23KB | Landing page template |

### Данные и расчёты
| Файл | Размер | Назначение |
|---|---|---|
| `lib/evidence-calculations.ts` | 13KB | CAC, LTV, investment hotness расчёты |
| `lib/evidence-adapters.ts` | 31KB | Конвертация Evidence блоков в strategy inputs |
| `lib/data-fetchers.ts` | 52KB | Поиск компаний, LinkedIn, SerpAPI |

### AI и деплой
| Файл | Размер | Назначение |
|---|---|---|
| `lib/ai.ts` | 8KB | Абстракция AI провайдеров (OpenAI, Anthropic) |
| `lib/design-analyzer.ts` | 11KB | Анализ дизайна конкурентов |
| `lib/vercel.ts` | 15KB | Утилиты деплоя на Vercel |
| `lib/rateLimit.ts` | 3KB | Rate limiting для API routes |

---

## VI. ПОТОК ДАННЫХ

```
Evidence (Блоки 1-7)
    │
    ├──────────────────────────────────┐
    │                                  │
    ▼                                  ▼
  /api/action-plan              /api/differentiation
    │                                  │
    ▼                                  ▼
  ActionPlanBlock              DifferentiationBlock
  (GO/NO GO вердикт)           (USP + позиционирование)
    │                                  │
    ├──────────────┬───────────────────┤
    │              │                   │
    ▼              ▼                   ▼
  /api/gtm-plan  FinancialCalc   ScenarioComparison
    │              │                   │
    ▼              │                   │
  GtmPlanGenerator │                   │
  (каналы+цены)    │                   │
    │              │                   │
    ├──────────────┼───────────────────┤
    │              │                   │
    ▼              ▼                   ▼
  /api/marketing-plan    SurveyGenerator
    │                         │
    ▼                         ▼
  MarketingPlan          Google Forms / Email
  (5 вкладок)
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
  /api/product-spec              ExecutiveSummary
    │                            (PDF отчёт)
    ▼
  /api/generate-code
    │
    ├─── GitHub push
    └─── Vercel deploy
```

---

## VII. СОСТОЯНИЕ В page.tsx

```typescript
// Strategy state
const [actionPlanData, setActionPlanData] = useState<any>(null);
const [actionPlanLoading, setActionPlanLoading] = useState(false);
const [actionPlanError, setActionPlanError] = useState('');
const [actionPlanSubTab, setActionPlanSubTab] = useState<ActionPlanSubTab>('plan');

const [differentiationData, setDifferentiationData] = useState<any>(null);
const [differentiationLoading, setDifferentiationLoading] = useState(false);
const [differentiationError, setDifferentiationError] = useState('');

// Evidence data (из Исследования — используется Стратегией)
const [evidenceData, setEvidenceData] = useState<Record<string, any>>({});
```

**Auto-fetch при открытии:**
```typescript
if (currentStep === 'action-plan' && !actionPlanData && !actionPlanLoading) {
  generateActionPlan();
}
```

**Минимальные требования для генерации:** 2 блока Evidence (показывается readiness indicator).

---

## VIII. СВЯЗЬ С ИССЛЕДОВАНИЕМ

Все API Стратегии получают Evidence данные в одном из форматов:

```typescript
// Формат 1 — через evidenceData объект
const evidenceData = {
  problem: evidenceData.problem,      // Блок 1
  demand: evidenceData.demand,        // Блок 2
  sellability: evidenceData.sellability, // Блок 3
  occupation: evidenceData.occupation,   // Блок 4
  economics: evidenceData.economics,     // Блок 5
};

// Формат 2 — через competition объект
const competition = {
  competitors: [...],
  negative_reviews: [...],
  unmet_needs: [...],
};
```

**Критически важные поля из Evidence:**
- `problem.who_hurts.complaints[]` → боли для USP и Survey
- `demand.growing_or_dying.growth_rate` → тренд для GTM timing
- `sellability.average_ticket.median_price` → цена для калькулятора
- `occupation.why_gaps_exist.negative_reviews[]` → слабости для дифференциации
- `economics.cac.estimated_cac` → CAC для unit economics

---

*Документ создан автоматически. TrendHunter AI · Апрель 2026*
