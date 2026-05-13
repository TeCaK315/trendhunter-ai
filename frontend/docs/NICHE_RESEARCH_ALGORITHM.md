# Раздел "Исследование ниши" — детальный алгоритм работы

Документ описывает полный пайплайн раздела `/niche-research` — пользователь руками вводит описание ниши, система собирает реальные данные из Reddit/YouTube/Google Trends, прогоняет через двух AI-агентов (Оптимист и Скептик) с третьим как Арбитр, и возвращает структурированный анализ ниши с обоснованными болями, аудиторией и рекомендациями. Каждый шаг привязан к конкретному файлу и функции.

---

## Что это вообще такое

Это альтернативная точка входа в продукт. На главной странице `/` пользователь смотрит готовые тренды из автоматического сбора (`/api/trends` через Vercel KV), но если своя идея ниши пришла извне — он идёт в `/niche-research` и руками описывает её. Система сама собирает первичные данные о нише из открытых источников и проводит глубокий анализ через несколько AI агентов, спорящих между собой.

Раздел физически живёт в `src/app/niche-research/page.tsx` (996 строк, client component). Иконка в левом сайдбаре — лупа, переводится как "Исследование ниши" / "Niche Research" (в `Sidebar.tsx:46-54`, labelKey `nicheResearch`). Это второй пункт в секции "Обзор" сайдбара после "Поток идей".

В отличие от раздела "Тренды" где пользователь только потребляет готовый контент, здесь он сам формулирует запрос и получает персонализированный анализ под конкретную нишу. Результат сохраняется в `localStorage.trendhunter_favorites` (как обычный тренд с пометкой `source: custom_niche_research`) и в `localStorage.niche_research_history` (отдельный список последних 20 анализов).

После анализа пользователь видит три вкладки результатов: Research (боли, аудитория, риски), Business (возможности, доход, инвестиции), Solutions (рекомендованные продукты). Может тут же сгенерировать ProductSpec через `/api/product-spec` — это даст быстрый переход к разделу "Проект" без необходимости проходить полный путь Evidence → Strategy.

---

## Высокоуровневый поток

Когда пользователь жмёт "Анализировать", фронтенд (`niche-research/page.tsx:210` функция `handleSubmit`) делает два последовательных POST запроса.

Первый — на `/api/niche-sources` с body `{ niche, description, keywords }`. Этот эндпоинт собирает реальные данные из трёх источников параллельно: Reddit (через SerpAPI search по сайту reddit.com), YouTube (через YouTube Data API), Google Trends (через SerpAPI engine google_trends). После сбора всех трёх — синхронно прогоняет результаты через GPT-4o для генерации synthesis (key insights, sentiment, content gaps, recommended angles). Возвращает `{ sources: { reddit, youtube, google_trends, synthesis } }`.

Второй — на `/api/niche-deep-analysis` с body `{ niche, description, targetAudience?, existingProblems?, sources }` (sources из шага 1). Этот эндпоинт сначала проверяет что данных достаточно (минимум 3 сигнала из суммы Reddit+YouTube+GoogleTrends), потом параллельно запускает двух агентов GPT-4o: Оптимист (ищет почему ниша сработает) и Скептик (ищет почему провалится). Когда оба ответили, запускает третьего агента — Арбитр — который синтезирует противоположные мнения в финальный объективный анализ. Возвращает `{ analysis: ArbitrationResult, raw_analyses: { optimist, skeptic } }`.

После получения analysis фронтенд сохраняет результат в localStorage (favorites + history) и переключает UI на состояние results. Пользователь видит три вкладки с детализацией. Опционально жмёт "Сгенерировать ProductSpec" → переход к разделу "Проект".

В сумме два запроса с параллелизмом внутри каждого: первый ~10-20 секунд (зависит от SerpAPI/YouTube задержек), второй ~30-60 секунд (три последовательных GPT-4o вызова, два из которых параллельно). Полный цикл от нажатия до результата — обычно 40-80 секунд.

Параллельно есть третий эндпоинт `/api/niche-research/route.ts` (66 строк) — это **legacy** упрощённый вариант одного агента без сбора реальных данных. Он вызывается из старых мест в коде (как fallback) но в новом UI на странице `niche-research/page.tsx` не используется. Сохранён для обратной совместимости.

---

## Шаг 1. Сбор данных из открытых источников

Файл: `src/app/api/niche-sources/route.ts` (480 строк).

На входе — `{ niche, description, keywords[] }`. На выходе — три блока данных и synthesis.

Сначала формируется массив поисковых запросов: основной `niche` плюс первые 2 keywords если переданы. Все три источника запрашиваются параллельно через `Promise.all`.

**Reddit** через функцию `fetchRedditPosts(query)` (строка 57). Использует SerpAPI Google search engine с запросом `site:reddit.com+{query}`. Это даёт топ-20 результатов из Google индекса по сабреддитам. Для каждого результата извлекается title, subreddit (парсится из URL), score (если есть), количество комментариев, ссылка на пост, snippet текста. Запросов делается до 2 (по двум разным keywords чтобы захватить разные углы). Результаты дедуплицируются по URL. Если SERPAPI_KEY не задан — возвращается ошибка с пустым массивом, остальные источники продолжают работать.

**YouTube** через функцию `fetchYouTubeVideos(query)` (строка 149). Прямой запрос к YouTube Data API v3 endpoint `/youtube/v3/search` с параметрами `part=snippet, type=video, maxResults=15, order=relevance`. Возвращает свежие видео по запросу с title, channelTitle, description, publishedAt, thumbnail. Если YOUTUBE_API_KEY не задан или квота превышена (10000 запросов/день бесплатно) — возвращается ошибка с пустым массивом видео.

**Google Trends** через функцию `fetchGoogleTrends(query)` (строка 238). Использует SerpAPI engine `google_trends` который под капотом делает скрейп trends.google.com. Сначала пробует основной запрос как есть, если данных нет — генерирует варианты через `generateQueryVariants` (например `niche + project management`, `automation tool`, `productivity` — добавляет популярные суффиксы). Возвращает growth_rate (процент роста за 12 месяцев), related_queries (что ещё ищут вокруг этой темы), interest_timeline (точки графика по неделям).

После всех трёх запросов данные комбинируются. Reddit посты из разных query объединяются в единый список с дедупом по URL, обрезка до топ-15 по relevance (порядок прихода). Communities (сабреддиты) собираются в Set, обрезка до 8. YouTube — топ-15. Google Trends — один объект с growth_rate.

Финальный шаг — `generateSynthesis(niche, description, sources)` (строка 311). Это вызов GPT-4o с промптом который читает все собранные данные и формирует резюме: `key_insights[]` (3-5 главных выводов из данных), `sentiment_summary` (положительный/негативный/смешанный), `content_gaps[]` (о чём в источниках не говорят но должны), `recommended_angles[]` (как позиционировать продукт). Это синтез нужен чтобы упростить дальнейшую работу AI-агентов на следующем шаге — у них будет краткая выжимка вместо ~50 raw записей.

В ответ клиенту возвращается `{ success: true, sources: { reddit, youtube, google_trends, synthesis }, queries_used, collected_at, warnings }`. Если каких-то API ключей нет — в warnings будет список missingKeys, но сам ответ всё равно успешный. Это design decision: даже частичные данные (только YouTube без Reddit) лучше чем полный fail.

---

## Шаг 2. Глубокий анализ через трёх агентов

Файл: `src/app/api/niche-deep-analysis/route.ts` (426 строк).

На входе — `{ niche, description, targetAudience?, existingProblems?, sources }`. На выходе — структурированный ArbitrationResult со всеми полями для UI.

Сначала идёт guard на минимум данных (строка 280). Считается `totalSourceSignals = redditPostsCount + youtubeVideosCount + (hasGoogleTrends ? 1 : 0)`. Если меньше 3 — эндпоинт **не запускает агентов**, возвращает `success: true, insufficient_data: true, analysis: null` с детализацией почему. Это экономит токены OpenAI и предотвращает фантазирование AI на пустых данных. UI показывает пользователю что нужно собрать больше данных перед глубоким анализом.

Если данных достаточно — формируется `userPrompt` который идёт всем трём агентам. В промпте: название ниши, описание, опционально targetAudience и existingProblems от пользователя, и большой блок `sourcesText` отформатированный через `formatSourcesForPrompt(sources)` — структурированно перечислены все Reddit посты с цитатами, YouTube видео с описаниями, Google Trends растущие запросы, и synthesis из шага 1.

**Шаг 2.1 — Параллельно запускаются Оптимист и Скептик** (строка 318 через `Promise.all`).

Оптимист (`OPTIMIST_PROMPT`, строка ~85) — это инвестор который видел 100+ успешных стартапов. Его задача найти боли с позиции "почему это сработает". Жёсткое правило в промпте: использовать ТОЛЬКО предоставленные данные как доказательства, не придумывать посты, URL или статистику. Возвращает JSON со структурой `{ pains: [{ pain, evidence[], target_audience, willingness_to_pay, reasoning }], overall_assessment }`.

Скептик (`SKEPTIC_PROMPT`, строка 120) — инвестор который видел 1000+ провальных стартапов. Его задача для каждой боли указать почему предыдущие решения НЕ сработали. То же жёсткое правило про реальные данные. Та же структура JSON ответа но с критическим уклоном — каждое evidence должно содержать контраргумент или причину провала.

Оба агента работают на GPT-4o через `runAgent(systemPrompt, userPrompt)` (строка 229) — это обёртка над `callAgent` из `src/lib/openai.ts`. Параллельный запуск экономит секунд 30-40 (вместо последовательно). Если хотя бы один упал — эндпоинт возвращает 500 с описанием ошибки, дальше не идёт.

**Шаг 2.2 — Арбитр синтезирует** (строка 350).

После успешных ответов Оптимиста и Скептика их ответы парсятся через `parseJSONResponse` (вытаскивает JSON из markdown-блоков если AI обернул) и передаются в третий промпт.

Арбитр (`ARBITER_PROMPT`, строка 152) — Senior Product Strategist с 20+ лет опыта. Задача — синтезировать оба мнения в объективный анализ. Жёсткие правила: не добавлять боли которых нет в анализах оптимиста и скептика, не придумывать размеры рынка/доход/стоимость разработки (если нет реальных данных — поле должно быть "Требует валидации"), confidence низкий если данных мало.

Возвращает большой JSON `ArbitrationResult` со всеми полями для UI. Главные блоки: `main_pain` (одна центральная боль), `confidence` (1-10), `key_pain_points[]` (массив с verdict для каждой боли + аргументы за/против), `target_audience` (primary + сегменты с size, willingness_to_pay, where_to_find, communication_channels), `risks[]`, `opportunities[]` (с potential_revenue, time_to_market), `recommended_solutions[]` (тип SaaS/app/automation, mvp_features, monetization), `final_recommendation` (стоит ли заходить в нишу), `analysis_metadata` (короткие саммари оптимиста/скептика, consensus_reached, depth, sources_used).

После арбитража эндпоинт возвращает `{ success: true, analysis: ArbitrationResult, raw_analyses: { optimist, skeptic }, metadata: { parallel_time_ms, arbitration_time_ms, total_time_ms } }`. raw_analyses сохраняется чтобы пользователь мог увидеть исходные мнения каждого агента до синтеза — это даёт прозрачность принятия решения.

---

## Шаг 3. UI и сохранение результатов

Файл: `src/app/niche-research/page.tsx` (996 строк, client component).

Состояние страницы управляется через `step: 'form' | 'collecting' | 'analyzing' | 'results'` (строка 131). При каждом переходе обновляется текст прогресса в `stepProgress`.

**State 'form'** (строка 409+) — простая форма с четырьмя полями: niche (обязательно), description (обязательно), targetAudience (опционально), existingProblems (опционально, comma-separated keywords). Кнопка "Анализировать" дизейблится если niche или description пустые. Локализация всех лейблов через `useTranslations()`.

**State 'collecting'** (строка 385) — экран загрузки с двумя точками: первая зелёная "Собираем данные...", вторая серая "Глубокий анализ..." (ещё не начался). Пользователь видит что происходит.

**State 'analyzing'** (строка 385+) — то же что 'collecting' но первая точка зелёная (готово), вторая мигающая индиго (в процессе).

**State 'results'** (строка 522+) — основной экран с результатами. Сверху три вкладки переключаемые через `resultsTab: 'research' | 'business' | 'solutions'`.

Вкладка **Research** (строка 560+) показывает: главная боль (`main_pain` крупным шрифтом + confidence percent), список ключевых болей `key_pain_points[]` (для каждой — verdict, аргументы за/против в две колонки, severity и confidence бейджи), целевая аудитория с сегментами (primary + сегменты с size, willingness_to_pay, communication_channels), список рисков.

Вкладка **Business** (строка 711+) показывает: opportunities[] (карточки с potential_revenue, time_to_market, implementation_difficulty), final_recommendation (большой блок с финальным вердиктом стоит/не стоит), analysis_metadata (короткие саммари позиций оптимиста и скептика, был ли consensus, использованные источники).

Вкладка **Solutions** (строка 839+) показывает: recommended_solutions[] карточки (type, description, mvp_features bullet list, estimated_cost, monetization). Под этим блок "Сгенерировать MVP Spec" с кнопкой которая вызывает `/api/product-spec` и сохраняет ответ в локальный state. Если ProductSpec уже сгенерирован — рендерится через компонент `<ProductSpecPreview />` с возможностью перейти в раздел "Проект".

При получении `deepAnalysis` срабатывает `useEffect` на строке 148 который вызывает `saveToFavorites()`. Эта функция строит объект Trend с полем `source: 'custom_niche_research'` и `data_confidence: 'ai_generated'` (отличает от автоматически найденных трендов с `data_confidence: 'real'`). Сохраняет два места в localStorage: `trendhunter_favorites` (общий список со всеми трендами включая автоматические) и `niche_research_history` (отдельный лог последних 20 ручных анализов с timestamp). Поле `id` формируется как `niche-${Date.now()}` — отличается префиксом от `trend-${...}` для автоматических.

Пользователь может позже найти этот анализ либо в `/favorites` (если оставил в избранном), либо в `/lk/research` (где недавно мы переделали под чтение из `block_results` + `strategy_sessions` + `data/trends.json` — но `niche-${...}` записи там не отображаются потому что у них нет block_results).

Это **architectural gap**: записи из niche-research живут только в localStorage, а ЛК показывает только записи из БД. Пользователь который сделал анализ через `/niche-research` но потом не запустил Evidence/Strategy — потеряет этот анализ при переходе в ЛК или при очистке localStorage.

---

## Шаг 4. Опциональная генерация ProductSpec

После получения analysis пользователь во вкладке Solutions может нажать "Сгенерировать ProductSpec". Это вызывает `generateProductSpec()` (строка 298+).

Функция формирует payload для `/api/product-spec` из имеющихся данных: trend (id, title=niche, category='Custom Niche', why_trending=description), analysis (main_pain, key_pain_points как массив строк, target_audience). НЕ передаётся `trend_id` потому что это не сохранённый в БД тренд — просто localStorage запись. Это значит что в `getStrategyDataForSpec()` не зайдёт ветка чтения Стратегии, и ProductSpec будет основан только на raw deep analysis без структурированного контекста S0-S5.

Полученный ProductSpec сохраняется в local state `productSpec` и рендерится через `<ProductSpecPreview />` компонент — простая визуализация всех полей spec в карточках. Дальше пользователь может вручную пойти в раздел "Проект" и подставить этот spec в `/api/generate-code` — но прямой кнопки "Создать код" из niche-research пока нет, переход требует ручных действий.

Это второй **architectural gap**: niche-research → ProductSpec → ??? . Между шагом получения spec и реальной генерацией кода нет UI-моста. Пользователь должен скопировать spec, перейти в раздел "Проект", вставить его. Логичное расширение — добавить кнопку "Создать MVP" прямо рядом с ProductSpec preview, которая запускает `/api/generate-code` с автоматической передачей текущего spec.

---

## Что может пойти не так и где

Несколько типичных точек отказа в этой цепочке.

**Отсутствие API ключей.** SERPAPI_KEY (платный) и YOUTUBE_API_KEY (бесплатный с квотой) проверяются на старте `niche-sources/route.ts`. Если оба отсутствуют — реальных данных не будет вообще, только Google Trends если он сам как-то отработает. Дальше `niche-deep-analysis` сработает guard на `totalSourceSignals < 3` и вернёт insufficient_data без запуска агентов. Пользователь увидит сообщение "Недостаточно данных для глубокого анализа" — это правильное поведение, но в UI оно сейчас отображается как ошибка а не как actionable hint "добавьте ключи в env или попробуйте более популярную нишу".

**Rate limits.** SerpAPI free tier — 100 поисков/месяц, легко выгорает на тестах. YouTube API — 10000 unit/день (один search = 100 unit, то есть 100 запросов/день максимум). OpenAI rate limits (зависят от plan, для Tier 1 это ~3 RPM на gpt-4o). При выгорании `runAgent` вернёт error через `formatErrorForUser`, эндпоинт ответит 500.

**Парсинг JSON от LLM.** Все три агента возвращают JSON в произвольной обёртке (markdown code blocks, текст до/после). `parseJSONResponse` пытается извлечь — ищет первую `{`, последнюю `}`, парсит. Иногда GPT возвращает невалидный JSON (незакрытая скобка, trailing comma) — функция вернёт null, эндпоинт ответит "Не удалось распознать ответ AI". Часто помогает retry, но автоматического retry в коде нет — пользователь должен сам нажать кнопку повторно.

**Несогласованность анализов.** Оптимист и Скептик могут найти разные боли которые не пересекаются. Арбитр должен синтезировать но иногда выбирает одну сторону полностью игнорируя другую. В UI вкладка `analysis_metadata` показывает короткие саммари обеих позиций и `consensus_reached` (boolean) — пользователь видит был ли реальный консенсус или это "победа" одной точки зрения.

**Generic data на маленьких нишах.** Для широких ниш типа "fitness" или "food" — Reddit/YouTube возвращают тысячи записей, анализ получается насыщенным. Для узких типа "saliva sample collection for genetic testing in cattle" — реальных данных почти нет, агенты получают слабый контекст и фантазируют либо отказываются работать. Архитектурно это правильно (guard на minimum data), но UX страдает.

**Storage limits.** localStorage в браузерах ограничен ~5-10 MB. Один deep analysis с raw_analyses + sources весит ~30-100 KB. После 50-100 анализов localStorage может переполниться. Сейчас history обрезается до 20 (`history.slice(0, 20)` в строке 207), но favorites не обрезаются — могут разрастись.

---

## Что не реализовано или плохо работает

**Связь с разделами Evidence/Strategy/Project.** Сейчас `/niche-research` живёт изолированно. Анализ сохраняется в localStorage, не попадает в Supabase `block_results` (где живут результаты Evidence для автоматических трендов). Из-за этого пользователь который сделал niche-research потом не может пройти Evidence по этой нише через стандартный поток — нужно сначала "конвертировать" в формат block_results. Никакой конвертации нет — user должен начинать всё заново через `/trends/[id]` интерфейс с автоматическим трендом.

**Persistence в БД.** Все результаты niche-research только в браузере. Если пользователь зашёл с другого устройства — анализов не увидит. Логичное расширение — записывать в новую Supabase таблицу `custom_niche_research` с user_id, niche, description, analysis (jsonb), sources (jsonb), created_at. Тогда же можно интегрировать с `/lk/research`.

**Reasoning loops.** Оптимист и Скептик работают одним проходом каждый. Идея спора — заложена в названии но реализована номинально. Можно сделать настоящий debate: Оптимист отвечает, Скептик читает ответ и отвечает на конкретные тезисы оптимиста, Оптимист контратакует, и так 2-3 раунда до сходимости. Сейчас они оба видят только raw данные и не видят аргументы друг друга — Арбитр читает оба ответа но без того чтобы агенты сами реагировали на оппонента.

**Источники данных.** Только Reddit + YouTube + Google Trends. Не используются: Twitter/X (там много жалоб), HackerNews (для tech ниш — золото), ProductHunt (видны прямые конкуренты), G2/Capterra (отзывы на B2B продукты), Statista (размеры рынков). Каждый дополнительный источник — это +1 функция в `niche-sources/route.ts` и больше параллельных fetch.

**Кэширование.** Один и тот же niche+description сейчас прогоняется через все API заново на каждый запрос. SerpAPI стоит денег за каждый поиск. Логично кешировать `sources` по hash(niche+description) на 24-48 часов — анализы редко меняются за день. Можно добавить через Vercel KV или Supabase таблицу `niche_sources_cache`.

**Promote to project.** После генерации ProductSpec нет одной кнопки которая бы запустила полный pipeline → создала GitHub repo → задеплоила на Vercel. Пользователь должен ручками идти в раздел "Проект" и снова стартовать. Это особенно странно потому что в разделе "Проект" есть тот же ProductSpec уже на руках.

**Editable analysis.** AI ответил, пользователь видит результат — но не может его поправить. Если в "main_pain" Арбитр написал что-то неточное — пользователь не отредактирует. Логично сделать анализ редактируемым (как Notion document) и сохранять как user_edited версию рядом с ai_generated.

---

## Карта файлов

Точки входа API: `src/app/api/niche-sources/route.ts` (480 строк, сбор реальных данных), `src/app/api/niche-deep-analysis/route.ts` (426 строк, три агента), `src/app/api/niche-research/route.ts` (66 строк, legacy один агент без сбора данных).

Главная UI страница: `src/app/niche-research/page.tsx` (996 строк, client component с четырьмя состояниями form/collecting/analyzing/results и тремя вкладками результатов).

AI обёртки: `src/lib/openai.ts` (callAgent, parseJSONResponse, formatErrorForUser, типы OpenAIError) — общая инфраструктура для GPT вызовов. `src/lib/ai.ts` (researchNiche function для legacy режима).

Утилиты: `src/lib/storage.ts` (getItem/setItem обёртки над localStorage с try/catch и JSON serialization), `src/lib/rateLimit.ts` (in-memory rate limiter по IP, RATE_LIMITS.analysis = N запросов в окно).

i18n: ключи `nicheResearch.*` в `src/lib/i18n/translations.ts` для ru и en (subtitle, collectingData, expertAnalysis, analysisComplete, savedToFavorites, fillNicheAndDescription, error и т.д.).

UI helpers: `<ProductSpecPreview />` компонент в `src/components/ProductSpecPreview.tsx` — визуализация ProductSpec результата. `<LanguageSwitcher />` для переключения языка в шапке.

ENV переменные нужные для работы:
- `OPENAI_API_KEY` (обязательно — GPT-4o для агентов и synthesis)
- `SERPAPI_KEY` (для Reddit и Google Trends)
- `YOUTUBE_API_KEY` (для YouTube видео)

Все три могут отсутствовать частично — система деградирует gracefully, но качество анализа снижается пропорционально количеству недоступных источников.
