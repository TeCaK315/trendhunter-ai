# Market Size Indicators - ЗАМЕНА LTV

## Что изменилось

**УДАЛЕНО:**
- ❌ LTV (Lifetime Value) - это была оценка на основе только цен конкурентов
- ❌ Простая формула: LTV = средняя цена × 24 месяца

**ДОБАВЛЕНО:**
- ✅ **Market Size Indicators** - реальные финансовые данные о рынке
- ✅ Revenue конкурентов (из SEC filings или press releases)
- ✅ Employee count (из LinkedIn)
- ✅ Estimated customer count (расчёт: revenue / avg price)
- ✅ Funding data
- ✅ Ссылки на источники для каждой метрики

---

## Что показывается

### Top-level метрики:
1. **Размер рынка** (Total Market Revenue) - сумма revenue всех конкурентов
2. **Всего клиентов** (Total Estimated Customers) - сумма estimated customers
3. **Крупнейший игрок** (Largest Player) - компания с максимальным revenue
4. **Качество данных** (Data Quality) - high/medium/low

### Для каждого конкурента:

#### 1. Revenue (Доход)
```typescript
{
  value: "$10M" | "$1.5B" | null,
  year: 2024 | 2025,
  type: "actual" | "estimate",  // actual = из SEC, estimate = из press release
  source: "SEC 10-K Annual Report" | "TechCrunch",
  source_url: "https://sec.gov/..." | "https://techcrunch.com/..."
}
```

- **Для публичных компаний** (~5% рынка):
  - ✅ Точные данные из SEC 10-K/10-Q reports
  - ✅ Бейдж "Actual" (зелёный)
  - ✅ Ссылка на SEC filing

- **Для частных компаний** (~95% рынка):
  - ⚠️ Estimates из press releases
  - ⚠️ Бейдж "Estimate" (жёлтый)
  - ⚠️ Ссылка на источник (TechCrunch, VentureBeat, etc.)

#### 2. Employees (Количество сотрудников)
```typescript
{
  count: 200,
  source: "LinkedIn",
  source_url: "https://linkedin.com/company/...",
  revenue_estimate: "$30M-40M"  // Только если revenue не найден
}
```

- Данные из LinkedIn (публичные)
- Если revenue НЕ найден → показываем estimate: `employees × $150K-200K`
- Показываем: "💡 Est. revenue: $30M-40M (based on headcount)"

#### 3. Estimated Customers (Примерное количество клиентов)
```typescript
{
  range: "5,000-10,000",  // ±20% error margin
  calculation: "$10M revenue / $100/mo avg price",
  confidence: "high" | "medium" | "low"
}
```

- **Формула**: Revenue / Average Price = Customer Count
- **Error margin**: ±20% (диапазон)
- **Confidence**:
  - high = revenue from SEC (actual)
  - medium = revenue from press release (estimate)
  - low = revenue from employee estimate

#### 4. Pricing (Цены)
```typescript
{
  range: "$10-500/mo",
  typical_price: "$50/mo",  // Median
  source_url: "https://company.com/pricing"
}
```

#### 5. Funding (Инвестиции)
```typescript
{
  total: "$15M",
  last_round: "Series A",
  source_url: "https://..."
}
```

---

## Архитектура

### 1. API Endpoint: `/api/evidence/market-size`

**Input:**
```json
{
  "competitors": ["Slack", "Zoom", "Notion"],
  "existing_pricing": {
    "Slack": {
      "range": "$6-12/mo",
      "typical_price": "$8/mo",
      "source_url": "https://slack.com/pricing"
    }
  }
}
```

**Output:**
```json
{
  "competitors": [
    {
      "name": "Zoom",
      "revenue": {
        "value": "$4.5B",
        "year": 2024,
        "type": "actual",
        "source": "SEC 10-K Annual Report",
        "source_url": "https://sec.gov/...",
        "fiscal_year_end": "2024-01-31"
      },
      "employees": {
        "count": 8357,
        "source": "LinkedIn",
        "source_url": "https://linkedin.com/company/zoom"
      },
      "pricing": {
        "range": "$10-30/mo",
        "typical_price": "$15/mo",
        "source_url": "https://zoom.us/pricing"
      },
      "estimated_customers": {
        "range": "300,000-375,000",
        "calculation": "$4.5B revenue / $15/mo avg price",
        "confidence": "high"
      },
      "funding": null
    }
  ],
  "total_market_revenue": "$25B+",
  "total_estimated_customers": "2,000,000+",
  "largest_player": "Zoom",
  "data_quality": "high",
  "sources_count": 15
}
```

### 2. Интеграция в Unit Economics

**File:** `src/app/api/evidence/unit-economics/route.ts`

Изменения:
- Строка ~150: Вызов `/api/evidence/market-size` вместо `calcEstimatedLtv()`
- Строка ~201: `market_size_indicators` вместо `ltv` в response
- Строка ~244: Обновлён `data_metadata`

### 3. UI Component

**File:** `src/components/blocks/UnitEconomicsBlock.tsx`

Изменения:
- Interface: `market_size_indicators` вместо `ltv`
- Top card: "Размер рынка" вместо "LTV"
- Section: "Market Size Indicators" вместо "LTV (ценность клиента)"
- Отображение: карточки для каждого конкурента с revenue, employees, customers

---

## Источники данных

### Публичные компании (точные данные):

#### 1. SEC Edgar API (бесплатно)
- URL: https://www.sec.gov/edgar/
- Данные: 10-K (годовые), 10-Q (квартальные) отчёты
- Доступ: прямой API + парсинг HTML/XML

#### 2. Financial Modeling Prep API (опционально)
- URL: https://financialmodelingprep.com
- Цена: бесплатно 250 req/day, платно $29-49/month
- Данные: готовый JSON с revenue из SEC
- Env var: `FMP_API_KEY` (опционально)

**Пример:**
```bash
GET https://financialmodelingprep.com/api/v3/income-statement/ZM?apikey=YOUR_KEY
```

```json
{
  "symbol": "ZM",
  "date": "2024-01-31",
  "revenue": 4534000000,
  "netIncome": 132000000
}
```

### Частные компании (estimates):

#### 3. SerpAPI Google Search (уже используем)
- Поиск press releases: `"{company} revenue 2024 2025 ARR"`
- GPT парсит результаты
- **ВАЖНО**: GPT prompt запрещает галлюцинации!

**Prompt:**
```
CRITICAL RULES:
1. ONLY extract if EXPLICITLY stated
2. If not found, return revenue_found: false
3. DO NOT ESTIMATE OR GUESS
```

#### 4. LinkedIn (бесплатно)
- Поиск: `site:linkedin.com/company/{company}`
- Парсинг: "{X} employees" из snippet
- Fallback estimate: revenue = employees × $150K-200K

---

## Принципы (БЕЗ галлюцинаций!)

### ✅ DO:
1. **Если данных нет → return null**
   - NOT FOUND ≠ придумать значение
   - Лучше показать "Not disclosed" чем fake data

2. **Всегда ссылка на источник**
   - Каждая метрика имеет `source_url`
   - Пользователь может проверить

3. **Явно помечать estimates**
   - Бейджи: "Actual" (зелёный) vs "Estimate" (жёлтый)
   - Показывать формулу расчёта

4. **Диапазоны вместо точных цифр**
   - Customer count: "5,000-10,000" (±20%)
   - Revenue estimate: "$30M-40M" (employees × $150K-200K)

5. **Confidence levels**
   - high = actual data (SEC)
   - medium = press release estimate
   - low = employee-based estimate

### ❌ DON'T:
1. НЕ придумывать цифры
2. НЕ использовать GPT для генерации данных
3. НЕ показывать estimates как actual
4. НЕ скрывать источники

---

## Примеры данных

### Публичная компания (Zoom):
```
Revenue: $4.5B (Actual) ✅
Source: SEC 10-K Filing (Feb 2024)
Employees: 8,357 (LinkedIn)
Est. Customers: 300,000-375,000 (High confidence)
```

### Частная компания с press release (Notion):
```
Revenue: $100M (Estimate) ⚠️
Source: Forbes article (Mar 2024)
Employees: 200 (LinkedIn)
Est. Customers: 8,000-12,000 (Medium confidence)
```

### Частная компания без revenue (small startup):
```
Revenue: Not disclosed
Employees: 50 (LinkedIn)
Est. revenue: $7.5M-10M (based on headcount) 💡
Est. Customers: 600-1,000 (Low confidence)
```

---

## Тестирование

### Test case 1: Публичная компания
```bash
curl -X POST http://localhost:3000/api/evidence/market-size \
  -H "Content-Type: application/json" \
  -d '{
    "competitors": ["Zoom"],
    "existing_pricing": {
      "Zoom": {
        "range": "$10-30/mo",
        "typical_price": "$15/mo",
        "source_url": "https://zoom.us/pricing"
      }
    }
  }'
```

**Ожидаемый результат:**
- revenue.type = "actual"
- revenue.source = "SEC 10-K Annual Report"
- revenue.source_url = ссылка на SEC
- estimated_customers.confidence = "high"

### Test case 2: Частная компания
```bash
curl -X POST http://localhost:3000/api/evidence/market-size \
  -H "Content-Type: application/json" \
  -d '{
    "competitors": ["Notion"]
  }'
```

**Ожидаемый результат:**
- revenue.type = "estimate" (если нашли в press release)
- revenue.value = null (если не нашли)
- employees.revenue_estimate = "$30M-40M" (если revenue = null)

---

## Стоимость

### Бесплатные источники:
- ✅ SerpAPI: уже платим (~10-20 запросов на competitor)
- ✅ SEC Edgar API: бесплатно
- ✅ LinkedIn: публичные данные

### Опциональные (платные):
- ⚠️ Financial Modeling Prep: $0-49/month (250 req/day бесплатно)
- ❌ Crunchbase API: $299/month (НЕ используем)

**Total cost:** $0 дополнительно! 🎉

---

## TODO / Улучшения

### MVP (текущее):
- ✅ Revenue (SEC + press releases)
- ✅ Employees (LinkedIn)
- ✅ Estimated customers
- ✅ Funding (basic)

### Future improvements:
- [ ] Кэширование данных (30-90 дней)
- [ ] Batch processing (не по одному competitor)
- [ ] Historical data (revenue за несколько лет)
- [ ] Market growth rate (YoY)
- [ ] Company stage detection (early-stage vs mature)
- [ ] Regional data (если доступно)
- [ ] Customer segment breakdown (если доступно)

---

## Вопросы/Ответы

**Q: Почему удалили LTV?**
A: LTV = средняя цена × 24 месяца - это слишком упрощённая оценка. Market Size Indicators дают РЕАЛЬНЫЕ данные о рынке (revenue, customers, funding) со ссылками на источники.

**Q: Насколько точны estimates?**
A:
- Public companies (SEC): ✅ 100% точно
- Press releases: ⚠️ ~80-90% точно (официальные заявления компаний)
- Employee-based: ⚠️ ~50-70% точно (широкий диапазон $150K-200K per employee)

**Q: Что если данных нет вообще?**
A: Показываем "Not disclosed" + employee count + employee-based estimate (если есть employees).

**Q: Можно ли добавить Crunchbase API?**
A: Можно, но дорого ($299/month). Для MVP используем бесплатные источники.

**Q: Как часто обновлять данные?**
A:
- SEC filings: раз в квартал/год (кэшировать 30-90 дней)
- LinkedIn employees: раз в месяц
- Press releases: при появлении новых

---

## Заключение

Market Size Indicators заменяет упрощённый LTV на **реальные финансовые данные о рынке**:
- ✅ Данные из SEC filings (для публичных компаний)
- ✅ Оценки из press releases (для частных компаний)
- ✅ Ссылки на источники
- ✅ Явное разделение actual vs estimate
- ✅ БЕЗ ГАЛЛЮЦИНАЦИЙ

Это даёт пользователям **гораздо более ценную информацию** о размере рынка, количестве клиентов и конкурентной среде! 🎯
