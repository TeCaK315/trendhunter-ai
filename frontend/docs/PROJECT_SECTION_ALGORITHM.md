# Раздел "Проект" — детальный алгоритм работы

Документ описывает полный пайплайн от нажатия пользователем кнопки "Создать проект" до публично доступного MVP на Vercel. Каждый шаг привязан к конкретному файлу и функции в кодовой базе.

---

## Что это вообще такое

Раздел "Проект" — последний шаг воронки TrendHunter AI. Пользователь уже прошёл Исследование (Evidence по 6 блокам), пройдена Стратегия (5 блоков S0-S5), есть данные в `block_results` и `block_decisions`. Пользователь нажимает "Создать проект" — получает готовый Next.js MVP, развёрнутый на Vercel под уникальным URL, с подтянутыми позиционированием, болями ниши, ценами под сегмент.

Раздел физически живёт в `/lk/projects` и `/trends/[id]` (вкладка `currentStep === 'project'`). Сама генерация — это серия HTTP-вызовов к нашим API, которые внутри обращаются к Claude API и собирают код из ~118 готовых блоков.

---

## Высокоуровневый поток

Когда пользователь жмёт кнопку "Создать проект", происходит следующая последовательность.

Сначала фронтенд (`src/app/trends/[id]/page.tsx`) собирает payload с данными ниши и отправляет POST запрос на `/api/product-spec`. Этот эндпоинт читает результаты Стратегии из Supabase, строит структурированный промпт, обращается к Claude и получает обратно объект `ProductSpecification` — формальное описание продукта со всеми полями: целевая аудитория, монетизация, технические требования, derived features из реальных болей пользователей.

После получения ProductSpec фронтенд делает второй POST запрос на `/api/generate-code`. Этот эндпоинт берёт ProductSpec и вызывает `assembleProject()` из блочной системы. Ассемблер выбирает нужные блоки из 118 доступных, склеивает их в полноценный Next.js проект (~50-70 файлов), прогоняет через `quickSyntaxCheck` для отлова известных багов, и если включены опции `github_repo` и `auto_deploy` — пушит файлы в GitHub репозиторий и триггерит Vercel deployment.

В итоге пользователь получает три артефакта: спецификация в локальном state клиента, GitHub репозиторий с исходниками, и работающий публично доступный URL на Vercel — обычно за 30-90 секунд после нажатия кнопки.

---

## Шаг 1. Генерация ProductSpec

Файл: `src/app/api/product-spec/route.ts` (968 строк).

На вход приходит body с минимум двумя обязательными полями: `trend` (объект ниши с title, category, why_trending) и `analysis` (с main_pain, key_pain_points, target_audience). Опциональные но критичные: `trend_id` (если передан, эндпоинт прочитает данные Стратегии из БД) и `user_inputs` (дополнительные инструкции от пользователя).

Если передан `trend_id`, вызывается `getStrategyDataForSpec(trendId, userId)` — функция читает из таблицы `strategy_sessions` последнюю completed/active сессию для этой ниши и пользователя, затем из `block_decisions` для каждого из пяти блоков S0/S1/S2/S3/S5 пытается достать поля. Чтение идёт через chain fallback: сначала смотрит в `decision.fields` (старый формат v3 со структурированными полями типа `positioning_angle`, `client_profile_short`), если пусто — в `raw_output`, если и там пусто — в `translated_output.specific` по конкретному пути, например для positioning это `S0.specific.positioning_quote`. Это нужно потому что Стратегия v4.1 пишет данные в translated_output, а старый билд читал только из decision.fields — без fallback chain получался null во всех слотах.

Извлечённые из Стратегии 14 полей форматируются в текстовый блок `СТРАТЕГИЧЕСКИЙ КОНТЕКСТ` и подмешиваются в промпт для Claude. Также в промпт идут данные из Evidence (жалобы пользователей, отзывы конкурентов, неудовлетворённые потребности), описание тренда и пользовательские инструкции. Промпт получается длинный (3-5 KB), его обрабатывает Claude Sonnet с timeout 60 секунд.

Claude возвращает JSON со структурой `ProductSpecification`. Внутри есть поля: `user_input` (тип ввода, обязательные поля формы), `user_output` (что генерирует продукт, value_proposition, primary_output), `magic_location` (где происходит "магия" — AI analysis, calculation, etc.), `monetization` (модель, тарифы), `technical_requirements` (auth_required, database_required, apis_needed), `mvp_complexity`, `generation_approach` (saas/marketplace), и главное — `derived_features` — массив фич, каждая со связкой "источник боли → цитата → наше решение → подсказка по реализации".

После получения ответа от Claude эндпоинт делает Feature Extractor проход — если в derived_features меньше 3 элементов, дополняет их данными из Evidence напрямую (complaints, negative_reviews, unmet_needs). Это страховка чтобы продукт не получился слишком generic.

В ответ клиенту возвращается `{ product_spec, strategy_session_id, metadata: { has_strategy_data, mvp_complexity, generation_approach } }`. ProductSpec обычно весит 5-15 KB JSON.

---

## Шаг 2. Сборка проекта из блоков

Файл: `src/app/api/generate-code/route.ts` (286 строк), главная логика в `src/lib/blocks/block-assembler.ts` (~600 строк).

Эндпоинт принимает body с `spec` (минимум project_name), `product_spec` (полный объект из шага 1), опционально `project_type` (saas/marketplace/pwa), `github_repo`, `auto_deploy`, `mode` (blocks или claude). По умолчанию mode=blocks — это быстрый путь через блочный ассемблер. Альтернатива mode=claude вызывает legacy `generateCodeWithClaude()` — медленный пайплайн Architect → Coder → Reviewer на чистом Claude.

В блочном режиме вызывается `assembleProject({ product_spec, project_name, project_type })`. Внутри ассемблера сначала строится `BlockContext` — большой объект который видит каждый блок при генерации. Контекст содержит: project_name и slug, design system (палитра цветов и шрифты, либо взятые из product_spec.design_system либо дефолтные), derived_features, конфигурация Supabase/Stripe/Auth, env_vars, dependencies, content profile, и два важных поля для маршрутизации блоков — `project_type` (saas/marketplace/pwa) и `project_style` (wizard/dashboard/catalog/form-tool).

`project_type` определяется через `inferProjectType(spec)` — простая логика: если generation_approach='marketplace' или в подсказках видны mobile/offline — возвращается соответствующий тип, иначе дефолт saas. Это влияет на фильтрацию блоков по полю `project_types` в манифесте.

`project_style` определяется через `inferProjectStyle(spec)` — keyword-based детектор. Сканирует value_proposition, primary_output, magic_location.description и derived_features на наличие слов. Если находит invoice/receipt/quote/bill/document/pdf — возвращает form-tool. Если setup/integration/connect/configure/automation/workflow/onboarding/wizard/step-by-step/guided — возвращает wizard. Если catalog/library/search/browse/marketplace/directory — catalog. Иначе дефолт dashboard.

Также строится `ContentProfile` через `buildContentProfile(spec, primaryOutput)` — детектит tracksMoney (есть ли поля price/amount/cost), hasRecipientFields (client/recipient/customer), hasLineItems (item/product + quantity), и определяет formType: sender-recipient (для invoice-подобных), single-input (для одного большого поля), data-entry (для динамических форм). Также генерируются statuses под продукт (для tracksMoney это draft/sent/unpaid/paid/overdue, для остальных другой набор).

Дальше вызывается `selectBlocks(ctx)` — главная функция выбора. Перебирает все 118 блоков из BLOCKS_MANIFEST и для каждого решает включать или нет. Логика следующая. Сначала фильтр по project_type — если у блока в манифесте указан конкретный список типов и текущий не входит, блок пропускается. Дальше по нескольким критериям выставляется флаг shouldInclude. Foundation блоки (package.json, tsconfig, next.config, layout, global css) включаются всегда. Tech triggers смотрят на product_spec.technical_requirements: если auth_required в спеке и в блоке есть trigger 'auth_required' — включаем, аналогично для database_required и apis_needed. Feature triggers ищут совпадения по keywords между списком триггеров блока и текстом derived_features (склеенные feature_name + solution + implementation_hint, всё в lowercase). Stripe-блоки включаются если monetization.model не равен free_with_ads. Core UI (header, footer, dashboard-nav и т.п.) и core pages (landing, dashboard, create, analysis, settings, history, legal) включаются всегда. Финансовые страницы (page/clients, page/reports) — только если contentProfile.tracksMoney=true.

После базового отбора применяются project_style overrides. Для wizard стиля принудительно включается feature/interactive-wizard и принудительно исключаются feature/invoice-generator, feature/pdf-export, feature/financial-calculator. Для form-tool — наоборот, исключается wizard, включается invoice-generator. Для dashboard — исключаются и wizard и form-tool блоки. Для catalog overrides пока не настроены.

Финальный шаг отбора — резолв транзитивных зависимостей. У каждого блока в манифесте есть поле `depends_on` со списком других блоков-зависимостей. Рекурсивно для каждого выбранного блока подтягиваются его зависимости. Это даёт финальный набор блоков.

Дальше идёт `topologicalSort(selectedBlockIds)` — сортировка чтобы блоки с зависимостями выполнялись после своих зависимостей. Также блоки-агрегаторы (foundation/app-providers, foundation/package-json, foundation/env-example, foundation/readme) принудительно перемещаются в конец — они читают данные накопленные другими блоками (общий список dependencies, env vars).

Последний этап — выполнение блоков. Для каждого id из отсортированного списка вызывается `getBlock(id)` (получает entry из manifest), потом через BLOCK_LOADERS map делается dynamic import соответствующего .block.ts файла, вызывается `default(ctx)` — функция блока возвращает объект `Record<string, string>` где ключи это пути файлов, значения — содержимое. Все накопленные файлы мерджатся в `allFiles`.

Результат `assembleProject()` возвращает объект с полями files (записанный merged Record), blocks_used (массив id блоков), custom_files (если что-то добавлял gap-filler), total_files, assembly_time_ms, claude_calls (обычно 0 в чистом блочном режиме, больше нуля если gap-filler работал).

---

## Шаг 3. Валидация перед деплоем

Файл: `src/lib/blocks/validate.ts`.

Сразу после assembleProject в generate-code/route.ts вызывается `quickSyntaxCheck(generatedFiles)`. Это быстрая проверка без запуска tsc — миллисекунды на 70 файлов. Цель — поймать классы багов которые мы реально видели на проде.

Первая проверка — tsconfig target. Если в generatedFiles есть tsconfig.json, парсится, читается compilerOptions.target. Если значение не входит в whitelist (es2017/es2018/es2019/es2020/es2021/es2022/esnext) — добавляется ошибка. Это страховка от случая когда блок tsconfig.block.ts откатят обратно на es5 — Set spread, async/await, Object.entries и куча других ES2015+ фичей перестанут работать.

Вторая проверка — undeclared template variables. Перебираются все .ts/.tsx файлы. Для каждого из девяти "подозрительных" имён переменных (editMode, docNumber, lineItems, recipient, taxRate, discount, submitting, notes, setNotes — это все переменные которые в invoice-template объявлены через useState и могут случайно попасть в шаблон wizard или другой архетип) проверяется: если переменная упоминается в JSX как `{varName}` или `{varName ?` или `{varName.x}`, и при этом в этом же файле она нигде не объявлена через const/let/var/function/useState pattern — добавляется ошибка с указанием файла, строки и текста. Это та самая проверка которая поймала бы баг с editMode из wizard в недавнем тесте.

Третья проверка — brace balance. Если разница между количеством { и } в файле больше 10 — добавляется ошибка. Это эвристика для отлова грубо сломанного JSX.

Если массив errors не пустой — generate-code эндпоинт возвращает HTTP 422 с полями `success: false, error: 'Generated project failed pre-deploy validation', validation_errors: [{ file, line, message }]`. GitHub push в этом случае не выполняется — пользователь получает сообщение о проблеме до того как сломанный код попадёт в репозиторий.

Зачем валидировать так консервативно (только 9 заранее известных переменных) — потому что false positive дороже false negative в этом контексте. Если валидатор отвергнет рабочую генерацию, пользователь не получит проект вообще. Если упустит редкий баг, тот будет пойман на следующем шаге — Vercel build.

---

## Шаг 4. Push в GitHub

Если валидация прошла, код переходит к деплою. Условие выполнения — пользователь передал `github_repo` в body запроса, и в cookies есть `github_token` (httpOnly, ставится после OAuth callback из `/api/auth/github/callback`).

Если оба условия выполнены, вызывается `getGitHubUsername(token)` — простой GET на api.github.com/user, возвращает login. Дальше `addFilesToGitHub(token, username, repoName, files)` — функция использует Git Data API чтобы пушнуть все файлы одним коммитом.

Алгоритм пуша. Сначала находится base branch — пробуется main, потом master. Получается commit SHA текущего HEAD. Дальше для каждого файла создаётся blob через POST /git/blobs с base64-кодированным контентом — это даёт SHA блоба. После создания всех блобов делается один POST /git/trees с массивом всех blob refs — получается tree SHA. Дальше POST /git/commits с tree SHA, parent commit SHA и сообщением — получается новый commit SHA. Финальный шаг — PATCH /git/refs/heads/main с новым commit SHA, ref обновляется атомарно.

Преимущество Git Data API над созданием файлов по одному (PUT /repos/{owner}/{repo}/contents/{path}) — один коммит вместо ~70, нет rate limit проблем, всё выглядит как нормальный push. Недостаток — репозиторий должен уже существовать и иметь хотя бы одну ветку. Если репо пустой — будет ошибка "Could not find base branch".

Результат `addFilesToGitHub` — объект `{ success, filesCreated, errors[] }`. Если success=false, в логи пишется warn `[generate-code] GitHub push failed:` и github_url остаётся undefined. Если success=true, github_url формируется как https://github.com/{username}/{repoName} и кладётся в финальный response.

---

## Шаг 5. Деплой на Vercel

Если в дополнение к github_repo передан `auto_deploy: true` и в cookies есть `vercel_token` (поставлен через Vercel OAuth callback) — после успешного push идёт деплой.

Файл: `src/lib/vercel.ts`, функция `deployFromGitHub(token, projectName, gitRepoUrl, branch='main')`.

Сначала вызывается `createVercelProject(token, projectName, { repo, type: 'github' })` — POST на api.vercel.com/v9/projects. Это создаёт пустой Vercel проект с привязкой к GitHub репозиторию. Возвращает projectId.

Сразу после создания проекта делается PATCH на /v9/projects/{projectId} с body `{ ssoProtection: null, passwordProtection: null }`. Это отключает Deployment Protection — без этого PATCH сгенерированный сайт был бы доступен только владельцу Vercel-аккаунта, и пользователь не смог бы показать его клиентам без передачи bypass token. Если у OAuth токена нет scope projects:write — PATCH вернёт 403 и в логи пишется warning, но сам деплой не блокируется.

Дальше пауза 2 секунды чтобы Vercel настроил Git-интеграцию, и POST на /v13/deployments с body `{ name, gitSource: { type: github, org, repo, ref: 'main' }, projectSettings: { framework: 'nextjs', installCommand: 'npm install', buildCommand: 'npm run build', outputDirectory: '.next' } }`. Это явно триггерит deployment с принудительной настройкой framework=nextjs — без этого Vercel иногда не определяет тип проекта корректно.

Если deploy POST вернул 200 — функция возвращает `{ success: true, deploymentId, deploymentUrl: 'https://${deployment.url}', projectUrl: 'https://${cleanProjectName}.vercel.app' }`. Здесь важно различение двух URL. `deploymentUrl` — это реальный адрес конкретного билда вида `workflow-test-abc123-username.vercel.app`, он начинает работать сразу после создания deployment записи, даже пока build идёт (Vercel показывает progress page). `projectUrl` — это короткий alias по имени проекта, он работает только после первого успешного билда и присвоения alias.

В generate-code/route.ts мы выбираем `vercel_url = deployResult.deploymentUrl` если есть, иначе fallback на projectUrl с warning в логи. Это правильный приоритет — раньше использовали projectUrl и пользователи видели 404 пока build не завершится, или вечно если build падал.

Если первый POST на /v13/deployments не сработал — функция делает fallback через GET /v6/deployments?projectId с задержкой 5 секунд, ищет недавно созданный deployment. Если и там нет — возвращает success=true но с error message "Project created but deployment did not start" — это плохой паттерн (success не должен быть true при ошибке), но пока оставлен из соображений совместимости.

В финальный response generate-code попадают поля: success, files_generated, files_pushed, github_url, vercel_url, blocks_used, custom_files, claude_calls, generated_at.

---

## Что может пойти не так и где

Есть несколько типичных точек отказа в этой цепочке.

Первая — отсутствие данных Стратегии. Если у пользователя нет завершённой стратегии для этой ниши, getStrategyDataForSpec вернёт null и в промпт Claude не попадут позиционирование, профиль клиента, канал привлечения. Сгенерированный продукт будет generic — заголовок типа "Smart Result for Your Business", фичи без привязки к нише, дефолтный pricing. Это не баг а фича — продукт всё равно сгенерируется, но без ниши-специфики. Нужно явно объяснять пользователю в UI что для качественной генерации нужна пройденная Стратегия.

Вторая — мусорный ProductSpec от Claude. Иногда Claude возвращает derived_features=[] или value_proposition с чисто generic-текстом. В коде есть страховка — Feature Extractor пытается восстановить фичи из Evidence напрямую если массив пуст. Но если и Evidence слабый, продукт получается без actionable содержания. Лог `[product-spec] No derived_features — Evidence данные не были предоставлены` появляется в server console.

Третья — генерация невалидного TypeScript кода. Это самая частая проблема. Блочные генераторы (.block.ts файлы) — статические шаблоны с template literals, в них могут быть опечатки или утечки переменных между архетипами. Gap-filler через Claude генерирует код "по смыслу" и часто придумывает имена пропов которые не совпадают с интерфейсами компонентов из блоков (классический пример — onFileSelect vs onUpload в FileUpload). Защита — quickSyntaxCheck для известных паттернов, и FileUploadProps теперь принимает все возможные имена пропов через aliases. Но новые баги такого рода будут появляться и требовать точечных фиксов.

Четвёртая — GitHub push errors. Самые частые: репо не существует (404), репо есть но пустой без веток (Could not find base branch), rate limit от GitHub API (60 запросов/час для unauthenticated, 5000 для OAuth), некорректный токен после revoke. Логи `[generate-code] GitHub push failed:` с массивом errors из ответов API.

Пятая — Vercel deployment failures. Build падает чаще всего из-за TypeScript ошибок в сгенерированном коде (Vercel run prod-mode build с строгим tsc, не как dev). Иногда из-за missing env vars (Supabase keys нужны как Build-time для server components, отсутствуют в свежем проекте). Иногда из-за конфликта имени проекта (workflow-test уже занят кем-то — Vercel автоматически добавит суффикс). Vercel Dashboard → проект → Deployments → Build Logs — единственный способ диагностики.

---

## Что в этом флоу ещё не реализовано

Есть несколько очевидных пробелов которые видно даже из текущей структуры.

Между ProductSpec и Block Assembly нет промежуточного слоя который позволял бы пользователю редактировать спеку. Сейчас pipe идёт автоматически: получили product_spec → сразу в assembleProject. Если Claude ошибся с целевой аудиторией или монетизацией — пользователь не может это поправить, генерируется как есть. Логичное расширение — UI редактор ProductSpec между шагами.

inferProjectStyle поддерживает только 4 стиля и работает по простому keyword detection. Реальное многообразие продуктов больше — chat-based продукты (типа AI assistant с одним диалогом), data viewer (только просмотр без create), embed widget (компонент для встраивания на чужой сайт), API-only product (только REST endpoints без UI). Текущая логика всё это сворачивает в дефолтный dashboard.

Catalog style существует в типах, но в selectBlocks для него нет overrides. То есть catalog проект сгенерируется примерно так же как dashboard — нет блоков для grid карточек, поиска по списку, фильтрации, сортировки. Это требует написания нескольких новых блоков (catalog-grid, catalog-filter, catalog-detail-page) и подключения их в логику выбора.

Validation сейчас ловит только 9 типов известных багов. Любой новый паттерн утечки переменных или missing prop даст ошибку только на Vercel build. Долгосрочное решение — реальный tsc --skipLibCheck в temp директории на сервере перед push. Это медленнее (~5-10 секунд при отсутствии node_modules), но ловит абсолютно всё что упадёт на Vercel.

Vercel deploy не ждёт завершения build. Возвращается deploymentUrl сразу после POST на /deployments, а build может занимать 1-3 минуты. Пользователь видит "сайт готов" но при открытии получает Building page или 502. Расширение — после POST poll-ить статус deployment через GET /v13/deployments/{id} каждые 5 секунд до READY или ERROR, и только тогда возвращать ответ клиенту. Минус — увеличит время ответа эндпоинта.

GitHub repo нужно создавать вручную перед запуском generate-code. Это рассчитано на сценарий "пользователь подключил аккаунт, создал пустой репо в их UI, запустил генерацию". Альтернатива — наш эндпоинт сам создаёт репо через POST /user/repos если его нет. Это удобнее для пользователя но требует scope repo:write в OAuth и явного диалога подтверждения "создать репозиторий с именем X".

После деплоя нет feedback loop. Пользователь получает URL, идёт смотреть, видит баг — но эта информация никуда не возвращается. Нет механизма который позволил бы пользователю одной кнопкой "пересоздать с фиксом X" — только запустить весь pipeline заново. Расширение — interactive iteration где можно подсветить проблемный кусок UI и попросить регенерировать конкретный блок.

---

## Карта файлов на одном экране

Точки входа: `src/app/api/product-spec/route.ts` и `src/app/api/generate-code/route.ts`.

Главная логика блочной сборки: `src/lib/blocks/block-assembler.ts` (assembleProject, selectBlocks, inferProjectType, inferProjectStyle, buildContentProfile), `src/lib/blocks/blocks-manifest.ts` (метаданные всех 118 блоков), `src/lib/blocks/types.ts` (BlockContext, ProjectStyle, ContentProfile).

Сами блоки лежат в `src/lib/blocks/{foundation,auth,database,ui,features,pages,project-types,api,custom}/*.block.ts`. Каждый файл экспортирует `default function generate(ctx: BlockContext): BlockResult` которая возвращает Record<string, string> — путь файла в сгенерированном проекте → его содержимое.

Валидация: `src/lib/blocks/validate.ts` (quickSyntaxCheck).

Деплой: `src/lib/vercel.ts` (deployFromGitHub, createVercelProject), GitHub push inline в `generate-code/route.ts` (addFilesToGitHub).

Auth для GitHub/Vercel OAuth — `src/app/api/auth/{github,vercel}/{callback,user,logout}/route.ts`. Токены хранятся в httpOnly cookies (`github_token`, `vercel_token`).

UI раздела — `src/app/lk/projects/page.tsx` (705 строк, список созданных проектов, кнопки подключения GitHub) и `src/app/trends/[id]/page.tsx` (currentStep === 'project', 3895 строка и далее, две кнопки Landing Page / Full MVP).
