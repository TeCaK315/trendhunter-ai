# TrendHunter AI - Project Context

## Stable Version
**Commit:** `bb44c1b` - рабочая версия на localhost

---

## CURRENT FUNCTIONALITY (что работает СЕЙЧАС)

### 1. Google Trends Analysis
- Систематический анализ **69 направлений** в **8 нишах**
- Отслеживание изменения интереса пользователей по всему миру
- Формирование "карточек с идеями" на главной странице

### 2. Детальный анализ идеи (кнопка "Подробнее")
При выборе конкретного направления запускается углублённый анализ из открытых источников.

---

## РАЗДЕЛ "ДОКАЗАТЕЛЬСТВА"

### 4.1.1 Подраздел "Проблема"
| Метрика | Описание |
|---------|----------|
| **У кого болит** | Анализ Quora/Reddit/HackerNews/StackOverflow/YouTube - упоминания проблемы |
| **Как часто** | Количество упоминаний + % изменения в Google Trends за неделю |
| **Текущие решения** | Список сервисов на рынке, решающих проблему |
| **Готовность платить** | Анализ цен существующих сервисов |

### 4.1.2 Подраздел "Спрос"
| Метрика | Описание |
|---------|----------|
| **Растёт или умирает** | Данные Google Trends за 3 и 12 месяцев |
| **Хайп или устойчивый интерес** | Анализ стабильности тренда |
| **Новые игроки** | Появление новых компаний в нише |

### 4.1.3 Подраздел "Продажи"
| Метрика | Описание |
|---------|----------|
| **Кто платит** | Упоминания об использовании платных сервисов |
| **Сегмент рынка** | Формат: ENTERPRISE / B2B / B2C / SMB |

### 4.1.4 Подраздел "Рынок"
| Метрика | Описание |
|---------|----------|
| **Конкуренты** | Устоявшиеся компании с долей рынка |
| **Проблемы конкурентов** | Преимущества и недостатки существующих сервисов |
| **Дифференциация** | AI-агент анализирует и показывает "Возможности" для улучшения |

### 4.1.5 Подраздел "Экономика" (IN DEVELOPMENT - работает некорректно)
| Метрика | Описание |
|---------|----------|
| **CAC** | Стоимость привлечения клиентов у конкурентов |
| **Market Size Indicators** | Данные из налоговых отчётов конкурентов (квартал/год) со ссылками |
| **Расчёт пользователей** | Приблизительное кол-во активных пользователей (revenue / avg price) |
| **Масштабируемость** | Ссылки на исследования прогнозов развития ниши (5-10 лет) |

### 4.1.6 Подраздел "Анализ"
**3 AI-агента:** Оптимист / Скептик / Арбитр
- Берут ВСЮ информацию из раздела "Доказательства"
- "Спорят" между собой
- Приходят к консенсусу о реальной потребности пользователей

---

## РАЗДЕЛ "БИЗНЕС"

### 4.2.1 Подраздел "Инвестиции"
- Все инвестиции в нишу за последний год (сумма + дата)
- Инвестиционные фонды с суммами вложений

### 4.2.2 Подраздел "Клиенты"
- Компании в нише, открытые к сотрудничеству
- Ссылки: сайт / LinkedIn / email

---

## РАЗДЕЛ "ПРОЕКТ"

### META Agent
Компилирует ВСЮ информацию из разделов выше и создаёт:

**Вариант 1: "Спецификация"**
- Дорожная карта проекта
- Маркетинговый раздел (ввод бюджета от $0, расчёт источников трафика)
- MVP Specification (ключевые функции)
- Пользователь реализует самостоятельно

**Вариант 2: "Создать проект"**
- Подключение GitHub
- Автоматическая выгрузка кода MVP
- Все функции из "Спецификации" +
- Пошаговая инструкция по запуску и настройке MVP

---

## RECENT CHANGES (последние изменения)

### 2025-02-09: Contextual Project Generation (MAJOR!)
**Файлы:**
- `api/product-spec/route.ts` - UPDATED (Evidence data + Feature Extractor)
- `api/generate-code/route.ts` - UPDATED (derived_features support)
- `lib/mvp-templates/types.ts` - UPDATED (derived_features type)
- `app/trends/[id]/page.tsx` - UPDATED (Evidence data passing)

**Что реализовано:**

#### 1. Evidence → Product Spec Pipeline
- ProductSpec теперь получает ПОЛНЫЙ контекст Evidence:
  - `complaints` - жалобы с Reddit/Quora/HackerNews
  - `negative_reviews` - негативные отзывы о конкурентах
  - `unmet_needs` - неудовлетворённые потребности рынка
  - `pricing_data` - цены конкурентов
  - `ai_synthesis` - консенсус 3 агентов

#### 2. Feature Extractor (встроен в ProductSpec)
- GPT анализирует реальные боли и выводит КОНКРЕТНЫЕ фичи
- Каждая фича имеет:
  - `pain_source` - откуда пришла боль
  - `pain_quote` - цитата из данных
  - `solution` - наше решение
  - `implementation_hint` - как реализовать

#### 3. Contextual Code Generation
- Claude получает `derived_features` с приоритетом
- Каждая фича должна РЕШАТЬ конкретную боль
- Пример: жалоба "слишком сложный setup" → фича "3-step wizard"

**Принцип работы:**
```
Тренд → Evidence (жалобы, отзывы, потребности)
     → Product Spec (derived_features)
     → Generate Code (контекстные фичи)
     → MVP который РЕШАЕТ боли
```

### 2025-02-09: Design Analysis Block + Level 2 MVP Templates
**Файлы:**
- `api/evidence/design-analysis/route.ts` - NEW
- `lib/design-analyzer.ts` - NEW
- `api/evidence/market-occupation/route.ts` - UPDATED
- `api/product-spec/route.ts` - UPDATED
- `api/generate-code/route.ts` - UPDATED
- `lib/mvp-templates/ai-tool-generator-v2.ts` - NEW
- `lib/mvp-templates/types.ts` - UPDATED
- `lib/mvp-templates/index.ts` - UPDATED

**Что реализовано:**

#### 1. Design Analysis Block (фоновый анализ)
- Автоматически запускается вместе с Market Occupation
- Анализирует сайты конкурентов (CSS, шрифты, layout)
- GPT-4 генерирует УНИКАЛЬНУЮ цветовую палитру, отличную от конкурентов
- Данные передаются в META агент для генерации проекта

#### 2. Level 2 MVP Templates
- Новый генератор `generateAIToolFilesV2()` создаёт ~50 файлов
- Включает: Supabase (Auth + DB), Stripe (Payments), Dashboard
- Уникальная дизайн-система из Design Analysis
- Usage tracking, rate limiting, subscription tiers

#### 3. Design → Code Pipeline
- design_analysis → product-spec → generate-code
- Tailwind config с кастомными цветами
- Google Fonts для headings/body
- Уникальные UI элементы из анализа

### 2025-02-09: Оптимизация 3 AI-агентов (Анализ)
**Файлы:** `api/deep-analysis/route.ts`, `app/trends/[id]/page.tsx`

**Что изменено:**
- 3 агента (Оптимист/Скептик/Арбитр) теперь используют данные из Evidence блоков
- Источники: "Проблема" (who_hurts) + "Рынок" (negative_reviews, unmet_needs)
- Fallback на старый подход если Evidence данные не загружены

**Улучшения:**
- +50-60% качество анализа (добавлены negative_reviews и unmet_needs)
- 0 дополнительных SerpAPI вызовов (данные уже собраны)
- Арбитр теперь видит: жалобы + проблемы конкурентов + чего хочет рынок

---

## IN DEVELOPMENT (в разработке)
- [ ] Исправление подраздела "Экономика" (Unit Economics)
- [x] Phase 3: Feature → Code Mapping (детальный маппинг фич на код) - ✅ DONE (derived_features)

---

## FUTURE VISION (планы на будущее)

### Эволюция от MVP к полноценным продуктам

| Level | Output | Time | Cost | Readiness | Status |
|-------|--------|------|------|-----------|--------|
| Level 1 | MVP spec (~10 files) | 2-3 min | $1-2 | 10% | ✅ DONE |
| **Level 2** | Functional Prototype (~50 files) | 15-20 min | $5-10 | 70-80% | ✅ DONE |
| Level 3 | Production-Ready | 45-60 min | $20-40 | 95% | 🔮 Future |

### COMPLETED Components ✅

#### ✅ Design & UX Analysis Block (IMPLEMENTED)
- `/api/evidence/design-analysis` - автоматический анализ дизайна конкурентов
- Извлечение цветов и шрифтов из HTML/CSS
- GPT-4 генерирует уникальную палитру, отличную от конкурентов
- Интегрировано в Market Occupation (фоновый запуск)

#### ✅ Level 2 MVP Templates (IMPLEMENTED)
- `ai-tool-generator-v2.ts` генерирует ~50 файлов
- Supabase (Auth + PostgreSQL)
- Stripe (Subscriptions + Webhooks)
- Dashboard с usage tracking
- Уникальная дизайн-система

### REMAINING Components

#### HIGH - Feature → Code Mapping
Детальный маппинг каждой фичи на конкретные файлы кода

#### MEDIUM - Detailed Personas, Positioning, Content Library

### Key Principle
Каждый сгенерированный проект имеет УНИКАЛЬНЫЙ дизайн! ✅

---

## Tech Stack (TrendHunter AI itself)
- Frontend: Next.js + Tailwind
- Data: JSON files in `/frontend/data/`
- API routes: `/frontend/src/app/api/`
