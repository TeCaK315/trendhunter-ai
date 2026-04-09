# TrendHunter AI — Полная техническая документация
### Весь проект · Все разделы · Все пайплайны

| Документ | Версия | Статус | Кому |
|----------|--------|--------|------|
| Полная техдокументация проекта | Production v1.0 | Финальная | Разработчик проекта |

| Что включено | Файл / Размер |
|---|---|
| Код: Все API routes, библиотеки, типы | `CURRENT_ARCHITECTURE_FULL.ts` · ~5400 строк |
| Документация: архитектура, алгоритмы, схема БД | Этот документ |
| Справка по Evidence блокам | `TrendHunter_Research_Documentation_FULL.md` (отдельный файл) |

---

## 1. Что это и зачем

TrendHunter AI — платформа для анализа ниш. Пользователь видит 69+ трендов в 8 категориях, выбирает интересный, система за 90 секунд говорит стоит ли в неё входить и как именно.

**7 разделов продукта:**

| # | Раздел | Главный вопрос | Статус |
|---|--------|---------------|--------|
| 1 | Showcase (Главная) | Какие ниши сейчас растут? | ✅ Готов |
| 2 | Evidence (Исследование) | Стоит ли входить? | ✅ Готов (4 из 6 блоков) |
| 3 | AI Synthesis (Анализ) | GO / ПОДОЖДИ / СТОП? | ✅ Готов |
| 4 | Action Plan (Стратегия) | Как входить на рынок? | ✅ Частично |
| 5 | Business (Бизнес) | Кто инвесторы? Кто клиенты? | ✅ Готов |
| 6 | Project (Проект) | Создать MVP | ✅ Готов (Level 1 + Level 2) |
| 7 | Admin | Управление трендами и пользователями | ✅ Готов |

---

## 2. Архитектура — общий вид

### 2.1 Tech Stack

| Слой | Технология | Назначение |
|------|-----------|------------|
| Frontend/Backend | Next.js 16 (App Router) | SSR + API Routes |
| Language | TypeScript | Строгая типизация |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Database | Supabase (PostgreSQL) | Users, Ideas, Projects, Usage |
| Cache | Vercel KV (Redis) | Тренды (primary storage) |
| Auth | NextAuth.js (Google OAuth) | Аутентификация |
| AI — Analysis | OpenAI (GPT-4o, GPT-4o-mini) | Evidence блоки, Synthesis |
| AI — Classification | Claude Haiku | Классификация постов, интентов |
| AI — Code Generation | Anthropic Claude | Генерация MVP кода |
| Search Data | SerpAPI | Reddit, G2, Quora, Google SERP |
| Free APIs | HackerNews Algolia, StackExchange, YouTube, GitHub | Данные без SerpAPI лимитов |
| Hosting | Vercel (Hobby plan) | 10s function timeout |

### 2.2 Файловая структура

```
trendhunter-ai/
├── frontend/
│   ├── data/
│   │   └── trends.json                 ← Seed data (69+ трендов)
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                ← Landing (Showcase)
│   │   │   ├── layout.tsx              ← Root layout (AuthProvider)
│   │   │   ├── trends/[id]/page.tsx    ← Детали тренда (ГЛАВНАЯ СТРАНИЦА)
│   │   │   ├── admin/page.tsx          ← Admin панель
│   │   │   ├── projects/               ← Управление проектами
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── favorites/page.tsx      ← Избранное
│   │   │   ├── niche-research/page.tsx ← Ручное исследование
│   │   │   ├── survey/page.tsx         ← Опросы
│   │   │   │
│   │   │   └── api/                    ← 73 API routes
│   │   │       ├── auth/[...nextauth]/ ← Google OAuth
│   │   │       ├── trends/             ← CRUD трендов
│   │   │       ├── scan-trends/        ← Google Trends scanning
│   │   │       ├── cron/scan/          ← Daily cron job
│   │   │       ├── evidence/           ← 6 Evidence блоков
│   │   │       │   ├── problem/        ← Block 1
│   │   │       │   ├── demand/         ← Block 2
│   │   │       │   ├── sellability/    ← Block 3
│   │   │       │   ├── market-occupation/ ← Block 4
│   │   │       │   ├── economics/      ← Block 5 (IN DEV)
│   │   │       │   └── design-analysis/← Block 6 (фоновый)
│   │   │       ├── deep-analysis/      ← AI Synthesis (3 агента)
│   │   │       ├── product-spec/       ← Спецификация MVP
│   │   │       ├── generate-code/      ← Генерация кода
│   │   │       ├── github/             ← GitHub интеграция
│   │   │       └── admin/              ← Admin endpoints
│   │   │
│   │   ├── components/                 ← 45+ React компонентов
│   │   │   ├── blocks/                 ← Evidence визуализации
│   │   │   ├── layout/                 ← Header, Sidebar, Footer
│   │   │   ├── auth/                   ← Auth компоненты
│   │   │   └── showcase/               ← Landing компоненты
│   │   │
│   │   ├── lib/                        ← 140+ библиотечных файлов
│   │   │   ├── ai.ts                   ← AI unified module (254 строки)
│   │   │   ├── openai.ts              ← OpenAI wrapper (341 строка)
│   │   │   ├── supabase.ts            ← Supabase client (84 строки)
│   │   │   ├── auth-helpers.ts        ← Auth утилиты (48 строк)
│   │   │   ├── data-fetchers.ts       ← Сбор данных (1516 строк!)
│   │   │   ├── blocks/                ← Block Assembly System
│   │   │   │   ├── types.ts           ← Core types (181 строка)
│   │   │   │   ├── block-assembler.ts ← Оркестратор (624 строки)
│   │   │   │   ├── foundation/        ← ~8 блоков
│   │   │   │   ├── auth/              ← ~3 блока
│   │   │   │   ├── database/          ← ~3 блока
│   │   │   │   ├── ui/               ← ~15 блоков
│   │   │   │   ├── features/          ← ~10 блоков
│   │   │   │   ├── pages/             ← ~5 блоков
│   │   │   │   ├── api/              ← ~5 блоков
│   │   │   │   └── project-types/     ← ~3 блока
│   │   │   └── mvp-templates/         ← MVP template types
│   │   │
│   │   └── types/                     ← Типы
│   │       ├── trend.ts               ← 46 строк
│   │       ├── analysis.ts            ← 68 строк
│   │       └── analysis-context.ts    ← 386 строк
│   │
│   ├── next.config.ts                 ← 19 строк
│   ├── vercel.json                    ← Cron config
│   ├── tailwind.config.ts
│   └── package.json
│
├── CURRENT_ARCHITECTURE_FULL.ts       ← Код-документация (этот файл)
├── TrendHunter_Research_Documentation_FULL.md ← Документация Evidence
└── CLAUDE.md                          ← Контекст для AI
```

---

## 3. Хранение данных

### 3.1 Где что хранится

| Данные | Хранилище | Доступ | Персистентность |
|--------|-----------|--------|-----------------|
| Тренды (69+) | Vercel KV (Redis) + `data/trends.json` | `/api/trends` | ✅ Постоянно |
| Users | Supabase `users` | `auth-helpers.ts` | ✅ Постоянно |
| Usage tracking | Supabase `user_usage` | `/api/admin/usage` | ✅ Постоянно |
| Saved ideas | Supabase `ideas` | `/api/admin/ideas` | ✅ Постоянно |
| Projects | Supabase `projects` | `/api/projects` | ✅ Постоянно |
| Sessions | NextAuth (JWT) | Cookies | ✅ До logout |
| Evidence results | **React state (клиент)** | Компоненты | ❌ Теряются при перезагрузке |
| Generated code | GitHub | Git Data API | ✅ Постоянно |

> ⚠️ **Критично:** Evidence results НЕ персистятся в БД. Каждый раз при открытии тренда данные загружаются заново. Это дизайн-решение — данные должны быть свежими. Но это означает повторные SerpAPI вызовы.

### 3.2 Vercel KV (Redis) — Тренды

```
Ключ:    "trendhunter:trends"
Значение: { trends: Trend[], lastUpdated: string }
```

**Fallback стратегия:**
1. KV доступен + данные есть → возвращаем из KV
2. KV доступен + пуст → fallback на `data/trends.json`
3. KV ошибка → fallback на `data/trends.json`
4. Local dev (нет KV) → in-memory + файл

### 3.3 Supabase — Таблицы

| Таблица | Ключевые поля | RLS |
|---------|--------------|-----|
| `users` | id (UUID), email, github_username, name, avatar_url, provider, is_admin | ✅ |
| `user_usage` | user_id, date (YYYY-MM-DD), ideas_generated, projects_created, analyses_run | ✅ |
| `ideas` | user_id, trend_id, title, category, data (JSONB) | ✅ |
| `projects` | user_id, idea_id, name, status (draft/active/completed/archived), data (JSONB) | ✅ |

> 🔑 `user_id` = SHA-256(email) → UUID формат. Это NextAuth UUID, **НЕ** Supabase Auth UUID.

### 3.4 Supabase client — Lazy Proxy

```typescript
// Проблема: Vercel build падает если env vars не заданы
// Решение: createClient() вызывается ТОЛЬКО при первом обращении

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(url, anonKey); // Здесь, не при импорте
    }
    return (_supabase as any)[prop];
  },
});
```

---

## 4. Аутентификация

### 4.1 Текущая система

| Параметр | Значение |
|----------|----------|
| Провайдер | NextAuth.js |
| OAuth | Google |
| User ID | SHA-256(email) → UUID |
| Session | JWT (cookies) |
| Supabase Auth | **НЕ используется** |

> ⚠️ **Несовместимость с файлом RESEARCH_SECTION_FULL_v2.ts:**
> Файл Evidence блоков использует `supabase.auth.getUser()` — это Supabase Auth.
> Наш проект использует NextAuth + `getAuthUser()` из `auth-helpers.ts`.
> При интеграции нужно заменить `supabase.auth.getUser()` → `getAuthUser()`.

### 4.2 Auth flow

```
Пользователь → Google Sign In
  → NextAuth callback
    → JWT token (session cookie)
      → getAuthUser() → { id: emailToUuid(email), email }
        → Supabase queries с .eq("user_id", user.id)
```

### 4.3 Env vars

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## 5. Пайплайн 1: Обнаружение трендов

### 5.1 Cron Job

| Параметр | Значение |
|----------|----------|
| Расписание | `0 6 * * *` (ежедневно 6:00 UTC) |
| Конфигурация | `vercel.json` → crons |
| Endpoint | `/api/cron/scan` → `/api/scan-trends` |
| Авторизация | `CRON_SECRET` |

### 5.2 Сканирование

```
Vercel Cron (6:00 UTC)
  └→ /api/cron/scan (проверка CRON_SECRET)
      └→ /api/scan-trends
          ├→ 69 ниш × 8 категорий
          ├→ Google Trends API (related queries + interest)
          ├→ GPT-4o-mini (форматирование + классификация)
          └→ POST /api/trends (дедупликация + merge)
              └→ Vercel KV + data/trends.json
```

### 5.3 Дедупликация трендов

POST `/api/trends` выполняет 5 проверок перед добавлением:

| # | Проверка | Порог |
|---|---------|-------|
| 1 | Exact normalized title match | 100% |
| 2 | Substring match | 70%+ length ratio |
| 3 | source_query word-set similarity (Jaccard) | ≥0.7 |
| 4 | Title word-set similarity (EN + RU) | ≥0.5 |
| 5 | Same category + subset match | Все слова совпадают |

**Нормализация:**
- Убирает generic suffixes: tool, platform, software, solution, ...
- Убирает generic modifiers: ai-powered, cloud-based, advanced, ...
- Работает для English и Russian

### 5.4 Категории

9 валидных категорий с маппингом:

```
AI & ML ← ai, ml, artificial intelligence, machine learning
SaaS ← saas, software
FinTech ← fintech, finance, financial
EdTech ← edtech, education, learning
HealthTech ← healthtech, health, healthcare, medical, wellness
E-commerce ← ecommerce, commerce, retail
Technology ← tech, technology (default)
Business ← business, enterprise
Mobile Apps ← mobile, app
```

---

## 6. Пайплайн 2: Evidence Analysis (6 блоков)

> 📋 Подробная документация: см. `TrendHunter_Research_Documentation_FULL.md`

### 6.1 Обзор блоков

| Block | Файл | Строк | Вопрос | Время |
|-------|------|-------|--------|-------|
| 1 — Problem | `evidence/problem/route.ts` | 851 | Люди реально страдают? | ~15-20 сек |
| 2 — Demand | `evidence/demand/route.ts` | 1152 | Есть спрос купить? | ~15-20 сек |
| 3 — Sellability | `evidence/sellability/route.ts` | 1171 | Есть путь к деньгам? | ~25-35 сек |
| 4 — Market Occupation | `evidence/market-occupation/route.ts` | 405 | Где конкуренты слепые? | ~25-35 сек |
| 5 — Economics | `evidence/economics/route.ts` | — | Математика сходится? | IN DEV |
| 6 — Design Analysis | `evidence/design-analysis/route.ts` | 366 | Дизайн конкурентов | ~10-15 сек (фоновый) |

### 6.2 Зависимости между блоками

```
Block 1 (Problem) ─────────────────┐
                                   │ PARALLEL (Wave 1)
Block 2 (Demand) ──────────────────┤
                                   │
         ┌─────────────────────────┘
         │
Block 3 (Sellability) ◄── Block 1 + Block 2     ┐
                                                 │ SEQUENTIAL (Wave 2)
Block 4 (Market Occupation) ◄── Block 2          ┤
                                                 │
Block 6 (Design Analysis) ◄── Block 4 (BACKGROUND)
```

### 6.3 Выход каждого блока

Все блоки возвращают единую структуру `BlockOutput`:

```typescript
{
  block_number: number,     // 1-6
  block_type: string,       // "problem" | "demand" | ...
  diagnosis: "green" | "yellow" | "red",
  score: number,            // 0-10
  conflict_weight: number,  // 1-3 (вес для Synthesis)
  key_factors: string[],
  key_metric: string,
  block_context: { ... }    // Детальные данные (разные для каждого блока)
}
```

### 6.4 SerpAPI бюджет

| Блок | SerpAPI вызовов | Бесплатные API |
|------|----------------|----------------|
| Block 1 (Problem) | ~6 | HackerNews Algolia, StackExchange |
| Block 2 (Demand) | ~4 | Google Trends |
| Block 3 (Sellability) | ~6 | — |
| Block 4 (Occupation) | ~5 | — |
| Block 6 (Design) | 0 | Direct HTTP fetch |
| **TOTAL** | **~21** | 3 бесплатных API |

---

## 7. Пайплайн 3: AI Synthesis (3 агента)

### 7.1 Обзор

| Параметр | Значение |
|----------|----------|
| Endpoint | `/api/deep-analysis` |
| Файл | `deep-analysis/route.ts` (653 строки) |
| Модель | GPT-4o-mini (все 3 агента) |
| Время | ~35-45 сек |

### 7.2 Источники данных (приоритет)

1. **Evidence blocks** (если загружены):
   - `problem.who_hurts.complaints[]`
   - `occupation.why_gaps_exist.negative_reviews[]`
   - `occupation.why_gaps_exist.unmet_needs[]`

2. **Fallback** (если Evidence не загружен):
   - Direct fetch: Reddit, HN, Quora, StackOverflow

### 7.3 Три агента

```
Promise.all([
  OPTIMIST → Видит потенциал, доказывает каждую боль
  SKEPTIC  → Ищет контраргументы, слепые зоны
  ARBITER  → Синтезирует, выносит вердикт + priority_actions
])
```

### 7.4 Коррекция уверенности

| Data Points | Confidence Factor |
|-------------|------------------|
| ≥25 | 1.0x (полная уверенность) |
| ≥15 | 0.85-0.95x |
| ≥8 | 0.7-0.8x |
| <8 | 0.5x (низкая уверенность) |

**Подсчёт data points:**
- Evidence mode: `complaints + (negative_reviews × 2) + (unmet_needs × 1.5)`
- Fallback mode: `reddit + hn + quora + stackoverflow`

### 7.5 Выход

```typescript
{
  main_pain: string,
  key_pain_points: Array<{ point: string, confidence: number }>,
  target_audience: {
    primary: string,
    segments: TargetSegment[]
  },
  risks: string[],
  opportunities: string[]
}
```

---

## 8. Пайплайн 4: MVP Generation

### 8.1 Два этапа

```
Пользователь нажимает "Создать проект"
  │
  ├─ Этап 1: Product Spec (/api/product-spec)
  │   ├→ Input: trend + analysis + evidence + design_analysis
  │   ├→ GPT-4o-mini → ProductSpecification
  │   ├→ Feature Extractor: pains → features
  │   └→ Output: spec с derived_features
  │
  └─ Этап 2: Code Generation (/api/generate-code)
      ├→ Mode "blocks" (FAST ~30 сек) — assembleProject()
      ├→ Mode "claude" (SLOW ~50 мин) — deprecated
      └→ Optional: GitHub deploy + Vercel deploy
```

### 8.2 Product Spec (`/api/product-spec`, 824 строки)

**Контекст (всё что собрано ранее):**
- complaints (жалобы с Reddit/Quora/HN)
- negative_reviews (негативные отзывы конкурентов)
- unmet_needs (неудовлетворённые потребности)
- pricing_data (цены конкурентов)
- ai_synthesis (консенсус 3 агентов)
- design_analysis (палитра, типография)

**Feature Extractor (встроен):**

```typescript
// Каждая фича привязана к РЕАЛЬНОЙ боли
{
  pain_source: "G2 reviews",          // откуда пришла боль
  pain_quote: "Setup takes 3 hours",  // цитата
  solution: "3-step onboarding wizard", // наше решение
  implementation_hint: "Multi-step form with progress bar",
  priority: "must_have"               // must_have | should_have | nice_to_have
}
```

**Ключевые правила:**
- ALL output in ENGLISH
- value_proposition: MAX 6-8 слов
- primary_output: 1-3 слова (label кнопки)
- Нет fake statistics
- Цены на основе competitor data

### 8.3 Code Generation (`/api/generate-code`, 287 строк)

**Режим "blocks" (основной):**

```
assembleProject(product_spec)
  │
  ├─ Step 1: buildContext()
  │   └→ BlockContext + ContentProfile + DesignSystem
  │
  ├─ Step 2: selectBlocks()
  │   ├→ project_type compatibility
  │   ├→ tech_triggers (auth? stripe? supabase?)
  │   ├→ feature_triggers (keyword match)
  │   └→ auto-includes (foundation, core UI, pages, APIs)
  │
  ├─ Step 3: topologicalSort()
  │   └→ Kahn's algorithm, aggregators в конец
  │
  ├─ Step 4: executeBlocks()
  │   └→ ~40 блоков → ~50 файлов
  │
  ├─ Step 5: findGaps()
  │   └→ derived_features без покрытия
  │
  └─ Step 6: gapFiller()
      └→ Claude генерирует код для пропусков
```

**GitHub Deploy:**
```
addFilesToGitHub(files, repo, token)
  └→ Git Data API pipeline:
      1. Create blobs (content → SHA)
      2. Create tree (file structure)
      3. Create commit (tree → commit)
      4. Update ref (main → new commit)
```

### 8.4 Block Assembly System

**~150 блоков по категориям:**

| Категория | Примеры блоков | Кол-во |
|-----------|---------------|--------|
| foundation/ | package.json, tsconfig, tailwind, env, readme | ~8 |
| auth/ | supabase-auth, login-page, auth-callback | ~3 |
| database/ | supabase-client, types, migrations | ~3 |
| ui/ | button, card, modal, table, chart, sidebar, header, footer, form-* | ~15 |
| features/ | multi-language (636 ключей), dark-mode, notifications, search, export, stripe | ~10 |
| pages/ | dashboard, create (3 архетипа), settings, landing, pricing | ~5 |
| api/ | CRUD routes, webhooks, stripe, ai-api | ~5 |
| project-types/ | marketplace-*, pwa-* | ~3 |

**ContentProfile — ключ к адаптации:**

```typescript
// Определяется один раз, читается всеми блоками
{
  entityName: "Invoice" | "Quiz" | "Report",
  tracksMoney: boolean,     // dashboard: revenue vs activity
  formType: 'sender-recipient' | 'single-input' | 'data-entry',
  hasLineItems: boolean,
  hasCurrency: boolean,
  settingsTabs: ['business', 'defaults', 'payment']
}
```

### 8.5 Два уровня генерации

| Level | Output | Время | Стоимость | Готовность |
|-------|--------|-------|-----------|-----------|
| Level 1 | MVP spec (~10 файлов) | 2-3 мин | $1-2 | 10% |
| **Level 2** | Functional Prototype (~50 файлов) | 15-20 мин | $5-10 | 70-80% |
| Level 3 | Production-Ready | 45-60 мин | $20-40 | 95% (🔮 Future) |

---

## 9. Пайплайн 5: Business Intelligence

### 9.1 Investments (Venture)

| Параметр | Значение |
|----------|----------|
| Endpoint | `/api/business/investments` |
| Данные | SerpAPI: funding rounds, active VCs |
| Выход | investment_hotness (0-10), recent_rounds[], active_funds[] |

### 9.2 Leads (Clients)

| Параметр | Значение |
|----------|----------|
| Endpoint | `/api/business/clients` |
| Данные | SerpAPI + LinkedIn queries |
| Выход | companies[], decision_makers[], outreach_sequences[] |

---

## 10. Страницы (Pages)

### 10.1 Landing — `page.tsx` (~33 строки)

```
Server Component
  └→ loadTrendsFromFile() — читает data/trends.json напрямую
      └→ <ShowcaseClient initialTrends={...} lastUpdated={...} />
          └→ Фильтры по категориям + поиск + карточки трендов
```

> ⚠️ НЕ fetch('/api/trends') — избегает self-fetch deadlock в dev

### 10.2 Trend Detail — `trends/[id]/page.tsx` (2000+ строк)

**Самый сложный файл в проекте.** Client Component.

**Навигация (7 разделов):**

```typescript
type FlowStep = 'overview' | 'evidence' | 'action-plan' | 'monitoring' | 'research' | 'business' | 'project'
```

**Sub-tabs для каждого раздела:**

| FlowStep | Sub-tabs |
|----------|---------|
| evidence | analysis, problem, demand, sellability, occupation, economics, tech |
| action-plan | plan, calculator, scenarios, survey, gtm, differentiation, report |
| business | venture, leads |

**Data Flow:**

```
1. GET /api/trends → find by id → показать обзор
2. User → "Evidence" → POST /api/evidence/{block} × 4-6
3. User → "Анализ" → POST /api/deep-analysis → 3 агента
4. User → "Бизнес" → POST /api/business/{venture|clients}
5. User → "Проект" → POST /api/product-spec → POST /api/generate-code
```

### 10.3 Остальные страницы

| Страница | Путь | Назначение |
|----------|------|-----------|
| Admin | `/admin` | Управление трендами, пользователями |
| Projects | `/projects` | Список проектов пользователя |
| Project Detail | `/projects/[id]` | Детали проекта |
| Favorites | `/favorites` | Избранные тренды |
| Niche Research | `/niche-research` | Ручное исследование ниши |
| Survey | `/survey` | Опросы пользователей |

---

## 11. Компоненты

### 11.1 Layout

| Компонент | Назначение |
|-----------|-----------|
| Header.tsx | Навигация, auth status |
| Sidebar.tsx | Боковая панель (mobile) |
| Footer.tsx | Подвал |
| AuthProvider.tsx | NextAuth SessionProvider |

### 11.2 Showcase (главная)

| Компонент | Назначение |
|-----------|-----------|
| ShowcaseClient.tsx | Карточки трендов с фильтрами |
| TrendCard.tsx | Карточка одного тренда |
| CategoryFilter.tsx | Фильтр по категориям |
| SearchBar.tsx | Поиск по трендам |

### 11.3 Evidence Blocks (визуализация)

| Компонент | Evidence Block |
|-----------|---------------|
| RealProblemBlock.tsx | Block 1 — Problem |
| DemandGrowthBlock.tsx | Block 2 — Demand |
| SellabilityBlock.tsx | Block 3 — Sellability |
| MarketOccupationBlock.tsx | Block 4 — Market Occupation |

### 11.4 Utility

| Компонент | Назначение |
|-----------|-----------|
| TrendChat.tsx | AI чат на странице тренда |
| ProjectIterateChat.tsx | AI чат для итерации проекта |
| LoadingSpinner.tsx | Индикатор загрузки |
| ErrorBoundary.tsx | Обработка ошибок |

---

## 12. Core библиотеки

### 12.1 `data-fetchers.ts` (1516 строк) — САМЫЙ БОЛЬШОЙ ФАЙЛ

**14 источников данных:**

| Источник | API | SerpAPI? | Что возвращает |
|----------|-----|---------|---------------|
| Reddit | SerpAPI site:reddit.com | ✅ 1 | subreddit, score, comments |
| HackerNews | Algolia API | ❌ FREE | points |
| StackOverflow | StackExchange API | ❌ FREE | votes, answers |
| Twitter/X | SerpAPI site:x.com | ✅ 1 | tweets |
| Quora | SerpAPI site:quora.com | ✅ 1 | answers |
| G2 | SerpAPI site:g2.com | ✅ 1 | ratings |
| Capterra | SerpAPI site:capterra.com | ✅ 1 | ratings |
| Trustpilot | SerpAPI site:trustpilot.com | ✅ 1 | ratings |
| ProductHunt | SerpAPI site:producthunt.com | ✅ 1 | upvotes |
| YouTube | YouTube Data API | ❌ FREE | views, published_at |
| GitHub | GitHub API | ❌ FREE | stars, language |
| IndieHackers | SerpAPI | ✅ 1 | funding mentions |
| Google News | SerpAPI | ✅ 1 | news articles |
| Google Trends | Google Trends API | ❌ FREE | interest, growth, queries |

**Ключевой принцип:** ВСЕ данные из реальных API, НИКАКИХ галлюцинаций.

**Каждый fetcher возвращает:**
```typescript
{
  data: T[],
  source: string,
  query_used: string,
  fetched_at: string,
  serpapi_calls_used: number  // Для бюджетирования
}
```

### 12.2 `ai.ts` (254 строки)

| Экспорт | Назначение |
|---------|-----------|
| `isAIConfigured()` | Проверка OPENAI_API_KEY |
| `callAI(options)` | Универсальный AI вызов |
| `callAIJson<T>(options)` | JSON response parsing |
| `analyzePainPoints(trend, context)` | Боли, сегменты, риски |
| `researchNiche(niche)` | Keywords, subreddits, hypothesis |

> ⚠️ `generatePitchDeck`, `analyzeCompetitors` УДАЛЕНЫ — генерировали галлюцинации.

### 12.3 `openai.ts` (341 строка)

| Экспорт | Назначение |
|---------|-----------|
| `callOpenAI(messages, config)` | Exponential backoff (3 retry, 60s timeout) |
| `callAgent(systemPrompt, userPrompt)` | Wrapper |
| `parseJSONResponse<T>(response)` | Извлечение JSON из markdown |
| `classifyError(error)` | Error classification |

**Error mapping:**
- `429` → rate_limit_exceeded
- `401` → invalid_api_key
- `413` → context_length_exceeded
- `500/502/503` → server_error
- timeout → timeout
- network → network_error

### 12.4 `auth-helpers.ts` (48 строк)

```typescript
getAuthUser() → { id: string, email: string } | null
emailToUuid(email) → string  // SHA-256 → UUID v5-like
```

---

## 13. Типы данных

### 13.1 `trend.ts` (46 строк)

Основные поля + расширения по фазам:

| Фаза | Поля |
|------|------|
| Core | id, title, category, popularity_score, growth_rate, why_trending, status |
| Enrichment | competition_level, entry_cost_estimate, monthly_searches |
| Phase 2.0 | data_confidence, growth_rate_source, growth_rate_verified |
| Phase 2.1 | sentiment { positive, negative, neutral, sample_quotes } |
| Phase 2.2 | difficulty_score (1-10), difficulty_reasoning |
| Phase 2.3 | quick_verdict { decision: go/no_go/pivot/more_data, summary } |
| Phase 2.5 | region (global/us/eu/asia/ru) |

### 13.2 `analysis.ts` (68 строк)

Типы для 6-блочной системы + AI Synthesis:

```
ConflictType → existential | operational | manageable | none
BlockOutput → diagnosis + score + conflict_weight + block_context
Conflict → weight + type + pair + mechanism
SkepticOutput → points[] (конфликты) ИЛИ blind_spots[] (скрытые риски)
OptimistOutput → neutralizations[] (нейтрализации угроз)
ArbitratorOutput → verdict_type + condition + actions[] + confidence
```

### 13.3 `analysis-context.ts` (386 строк)

**Кумулятивный контекст — 8 этапов:**

```
Этап 1: TrendContext        → id, title, category
Этап 2: AnalysisData        → main_pain, segments, risks
Этап 3: SourcesData         → reddit, google_trends, youtube
Этап 4: CompetitionData     → competitors, market_gaps, positioning
Этап 5: VentureData         → funding_rounds, active_funds, investment_hotness
Этап 6: LeadsData           → companies, linkedin_queries, directories
Этап 7: PitchData           → slides, key_metrics (TAM/SAM/SOM)
Этап 8: ProjectData         → mvp_features, tech_stack, milestones
```

**Вспомогательные функции:**
- `createInitialContext(trend)` → начальный контекст
- `isStageCompleted(context, stage)` → boolean
- `getNextStage(context)` → number | null
- `formatContextForPrompt(context)` → string для AI

---

## 14. Переменные окружения

### 14.1 Обязательные

```bash
# AI
OPENAI_API_KEY=sk-...           # GPT-4o / GPT-4o-mini
ANTHROPIC_API_KEY=sk-ant-...    # Claude (генерация кода)
SERPAPI_API_KEY=...              # SerpAPI (сбор данных)

# Auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### 14.2 Опциональные

```bash
# Vercel KV (Redis)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Other
CRON_SECRET=...                 # Cron job авторизация
YOUTUBE_API_KEY=...             # YouTube Data API
GITHUB_TOKEN=...                # GitHub project export
```

---

## 15. Инфраструктура

### 15.1 Vercel

| Параметр | Значение |
|----------|----------|
| План | Hobby (бесплатный) |
| Function timeout | **10 секунд** |
| Cron jobs | 1 (`/api/cron/scan` ежедневно 6:00 UTC) |
| KV | Redis для хранения трендов |

> ⚠️ **10-секундный лимит** — критическое ограничение.
> Evidence блоки работают 15-35 секунд каждый.
> AI Synthesis — 35-45 секунд.
> Для production нужен Vercel Pro (60s timeout) или Edge Runtime.

### 15.2 Next.js Config

```typescript
// next.config.ts (19 строк)
{
  images: {
    remotePatterns: [
      { hostname: 'lh3.googleusercontent.com' },  // Google avatars
      { hostname: 'avatars.githubusercontent.com' }, // GitHub avatars
    ]
  }
}
```

---

## 16. Полная карта API Routes (73 endpoints)

### 16.1 Auth

| Метод | Endpoint | Назначение |
|-------|----------|-----------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth Google OAuth |

### 16.2 Trends

| Метод | Endpoint | Назначение |
|-------|----------|-----------|
| GET | `/api/trends` | Читать тренды |
| POST | `/api/trends` | Добавить с дедупликацией |
| PUT | `/api/trends` | Заменить все (enrichment) |
| DELETE | `/api/trends?id=xxx` | Удалить один |
| DELETE | `/api/trends?clear=true` | Очистить все |
| POST | `/api/scan-trends` | Сканировать Google Trends |
| GET | `/api/cron/scan` | Cron trigger |

### 16.3 Evidence

| Метод | Endpoint | Block | Строк |
|-------|----------|-------|-------|
| POST | `/api/evidence/problem` | 1 — Problem | 851 |
| POST | `/api/evidence/demand` | 2 — Demand | 1152 |
| POST | `/api/evidence/sellability` | 3 — Sellability | 1171 |
| POST | `/api/evidence/market-occupation` | 4 — Market Occupation | 405 |
| POST | `/api/evidence/economics` | 5 — Economics | IN DEV |
| POST | `/api/evidence/design-analysis` | 6 — Design Analysis | 366 |

### 16.4 Analysis & Generation

| Метод | Endpoint | Назначение | Строк |
|-------|----------|-----------|-------|
| POST | `/api/deep-analysis` | AI Synthesis (3 агента) | 653 |
| POST | `/api/product-spec` | Спецификация MVP | 824 |
| POST | `/api/generate-code` | Генерация кода | 287 |

### 16.5 GitHub

| Метод | Endpoint | Назначение |
|-------|----------|-----------|
| GET | `/api/github/repos` | Список репозиториев |
| POST | `/api/github/issues` | Создать issue |
| POST | `/api/github/issues/bulk` | Bulk create issues |

### 16.6 Admin & Other

| Метод | Endpoint | Назначение |
|-------|----------|-----------|
| * | `/api/admin/*` | Admin endpoints |
| * | `/api/projects/*` | Project CRUD |
| * | `/api/favorites/*` | Favorites CRUD |

---

## 17. Known Limitations & Future Work

### 17.1 Текущие ограничения

| # | Ограничение | Влияние | Решение |
|---|------------|---------|---------|
| 1 | Vercel Hobby 10s timeout | Evidence блоки и Synthesis не укладываются | Vercel Pro или Edge Runtime |
| 2 | Evidence results не персистятся | Повторные SerpAPI вызовы при перезагрузке | Кэш в Supabase (block_results) |
| 3 | Block 5 (Economics) не работает | CAC, market size расчёты неполные | В разработке |
| 4 | Нет middleware.ts | Auth проверка в каждом route отдельно | Добавить middleware |
| 5 | trend_id = "trend-{ts}-{idx}" | Не UUID, не совместим с Supabase FK | Работает для KV storage |
| 6 | NextAuth ≠ Supabase Auth | Несовместимость с файлом RESEARCH_SECTION_FULL_v2.ts | Адаптировать при интеграции |

### 17.2 IN DEVELOPMENT

- [ ] Block 5 — Unit Economics (CAC, market size, scalability)
- [ ] Параметризация контентных блоков (plan file exists)
- [ ] Кэширование Evidence results в Supabase
- [ ] Middleware для protected routes

### 17.3 FUTURE VISION

| Level | Output | Время | Стоимость | Готовность | Статус |
|-------|--------|-------|-----------|-----------|--------|
| Level 1 | MVP spec (~10 файлов) | 2-3 мин | $1-2 | 10% | ✅ DONE |
| Level 2 | Functional Prototype (~50 файлов) | 15-20 мин | $5-10 | 70-80% | ✅ DONE |
| Level 3 | Production-Ready | 45-60 мин | $20-40 | 95% | 🔮 Future |

---

## 18. Статистика проекта

| Метрика | Значение |
|---------|----------|
| API routes | 73 |
| Pages | 8 |
| Lib files | 140+ |
| Components | 45+ |
| Block files | 150+ |
| Type files | 3 |
| Total TypeScript | ~15,000+ строк |

**TOP-10 файлов по размеру:**

| # | Файл | Строк |
|---|------|-------|
| 1 | `data-fetchers.ts` | 1,516 |
| 2 | `evidence/sellability/route.ts` | 1,171 |
| 3 | `evidence/demand/route.ts` | 1,152 |
| 4 | `evidence/problem/route.ts` | 851 |
| 5 | `product-spec/route.ts` | 824 |
| 6 | `deep-analysis/route.ts` | 653 |
| 7 | `block-assembler.ts` | 624 |
| 8 | `trends/route.ts` | 422 |
| 9 | `market-occupation/route.ts` | 405 |
| 10 | `analysis-context.ts` | 386 |

---

*TrendHunter AI · Полная техдокументация · Production v1.0 · Все разделы*
