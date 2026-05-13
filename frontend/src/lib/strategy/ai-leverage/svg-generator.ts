/**
 * TrendHunter AI — SVG Generator v2
 * src/lib/strategy/ai-leverage/svg-generator.ts
 *
 * Изменения v2 (из аудита GPT + DeepSeek + Copilot):
 * - escapeSVG() для всех строк перед вставкой в XML (CRITICAL, все три)
 * - wrapSVGText: ограничение 3 строками чтобы не выходить за rect (все три)
 * - Фиксированная стартовая позиция вместо математики (Gemini)
 */

import type { TaskId } from './task-library'

// ─────────────────────────────────────────────────────────────
// XML ESCAPE (CRITICAL FIX)
// ─────────────────────────────────────────────────────────────

/**
 * Экранирует спецсимволы XML/SVG.
 * Обязательно применять ко ВСЕМ строкам из пользовательских данных
 * перед вставкой в SVG шаблон.
 *
 * Опасные символы: & < > " '
 * Пример: "HR & Recruitment" → "HR &amp; Recruitment"
 */
function escapeSVG(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface SVGFlowParams {
  tool_name: string
  task_id: TaskId
  niche: string
  input_label: string
  action_label: string
  output_label: string
}

// ─────────────────────────────────────────────────────────────
// FLOW TEMPLATES
// ─────────────────────────────────────────────────────────────

const FLOW_TEMPLATES: Record<TaskId, (niche: string) => {
  input: string
  action: string
  output: string
}> = {
  market_research:      (n) => ({
    input:  `Запрос: "${n} market"`,
    action: 'Deep Research сотен источников',
    output: `Размер рынка, тренды, боли в ${n}`,
  }),
  competitor_analysis:  (n) => ({
    input:  `Сайты конкурентов в ${n}`,
    action: 'Авто-мониторинг изменений',
    output: 'Алерт: новая цена/фича/позиционирование',
  }),
  positioning_research: (n) => ({
    input:  `"${n} positioning"`,
    action: 'Анализ 100+ материалов',
    output: 'Незанятые ниши и позиции',
  }),
  social_listening:     (n) => ({
    input:  `Reddit + форумы про ${n}`,
    action: 'Sentiment + паттерн анализ',
    output: 'ТОП боли аудитории с частотой',
  }),
  icp_research:         (n) => ({
    input:  `Профили в ${n} сообществах`,
    action: 'Кластеризация по болям',
    output: 'Профиль первого клиента с триггером',
  }),
  prospecting:          (n) => ({
    input:  `Фильтр: должность + ${n}`,
    action: 'Обогащение из 75+ источников',
    output: '50 контактов с email за 10 мин',
  }),
  personalized_outreach:(n) => ({
    input:  'Список контактов + шаблон',
    action: 'AI персонализация + прогрев',
    output: 'Отправлено 100 писем, reply rate ≥15%',
  }),
  lead_qualification:   (n) => ({
    input:  'Лид ответил на сообщение',
    action: 'BANT квалификация агентом',
    output: 'Горячий / тёплый / холодный',
  }),
  mvp_building:         (n) => ({
    input:  `Описание функции для ${n}`,
    action: 'Генерация кода / no-code',
    output: 'Рабочий прототип за 2-3 дня',
  }),
  content_creation:     (n) => ({
    input:  `Тема: боль в ${n}`,
    action: 'AI пишет в твоём стиле',
    output: 'Пост запланирован на пик активности',
  }),
  revenue_tracking:     (n) => ({
    input:  'Действия пользователей',
    action: 'Трекинг воронки + kill switch',
    output: 'Дашборд: конверсия, MRR, churn',
  }),
  funnel_optimization:  (n) => ({
    input:  'Сессии + события пользователей',
    action: 'AI анализ точек отвала',
    output: 'Где и почему уходят + рекомендации',
  }),
}

// ─────────────────────────────────────────────────────────────
// SVG TEXT WRAP
// ─────────────────────────────────────────────────────────────

/**
 * Переносит текст в SVG с ограничением по строкам.
 *
 * v2 fix:
 * - MAX_LINES = 3 (rect height 72px, lineHeight 13 → 3 строки влезают)
 * - Фиксированный startY для первой строки (не сложная математика)
 * - Длинное слово обрезается с '…'
 *
 * ВАЖНО: escapeSVG() применяется ДО вызова этой функции.
 * Здесь не экранируем чтобы не двойной-эскейп.
 */
function wrapSVGText(
  text: string,
  x: number,
  firstLineY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
): string {
  const charsPerLine = Math.floor(maxWidth / 6.5) // 6.5px на символ при font-size 11
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (lines.length >= maxLines) break

    // Слово длиннее строки — обрезаем
    const safeWord = word.length > charsPerLine
      ? word.slice(0, charsPerLine - 1) + '…'
      : word

    const testLine = currentLine ? `${currentLine} ${safeWord}` : safeWord

    if (testLine.length > charsPerLine && currentLine) {
      lines.push(currentLine)
      currentLine = safeWord
    } else {
      currentLine = testLine
    }
  }

  // Добавляем последнюю строку
  if (currentLine && lines.length < maxLines) {
    // Если это последняя строка и остались слова — ставим …
    const remaining = words.slice(
      words.findIndex(w => currentLine.startsWith(w)) + currentLine.split(' ').length
    )
    if (remaining.length > 0 && lines.length === maxLines - 1) {
      currentLine = currentLine.length > charsPerLine - 1
        ? currentLine.slice(0, charsPerLine - 2) + '…'
        : currentLine + '…'
    }
    lines.push(currentLine)
  }

  // Генерируем tspan'ы
  // firstLineY — Y первой строки, последующие смещаются на lineHeight
  return lines.map((line, i) =>
    `<tspan x="${x}" ${i === 0 ? `y="${firstLineY}"` : `dy="${lineHeight}"`} text-anchor="middle">${line}</tspan>`
  ).join('')
}

// ─────────────────────────────────────────────────────────────
// TOOL SVG CARD
// ─────────────────────────────────────────────────────────────

function generateToolSVG(params: SVGFlowParams): string {
  const { tool_name, input_label, action_label, output_label } = params

  // v2: escapeSVG применяется ЗДЕСЬ — один раз на входе
  // wrapSVGText получает уже экранированный текст
  const safeToolName  = escapeSVG(tool_name).slice(0, 22)
  const safeInput     = escapeSVG(input_label).slice(0, 100)
  const safeAction    = escapeSVG(action_label).slice(0, 100)
  const safeOutput    = escapeSVG(output_label).slice(0, 100)

  // Первые строки текста начинаются на Y=58 (нижняя половина блока 24..96)
  const TEXT_START_Y = 58

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="520" height="120">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M2 2L8 5L2 8" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <!-- ВХОДИТ -->
  <rect x="4" y="24" width="140" height="72" rx="8" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="1"/>
  <text x="74" y="42" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#6B7280">ВХОДИТ</text>
  <text font-family="system-ui,sans-serif" font-size="11" fill="#111827">
    ${wrapSVGText(safeInput, 74, TEXT_START_Y, 130, 14, 3)}
  </text>

  <!-- Стрелка 1 -->
  <line x1="148" y1="60" x2="178" y2="60" stroke="#9CA3AF" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- ДЕЛАЕТ -->
  <rect x="182" y="14" width="156" height="92" rx="10" fill="#EFF6FF" stroke="#3B82F6" stroke-width="1.5"/>
  <text x="260" y="32" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#2563EB">${safeToolName}</text>
  <text font-family="system-ui,sans-serif" font-size="11" fill="#1E40AF">
    ${wrapSVGText(safeAction, 260, TEXT_START_Y - 4, 144, 14, 3)}
  </text>

  <!-- Стрелка 2 -->
  <line x1="342" y1="60" x2="372" y2="60" stroke="#9CA3AF" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- ВЫДАЁТ -->
  <rect x="376" y="24" width="140" height="72" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1"/>
  <text x="446" y="42" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#16A34A">ВЫДАЁТ</text>
  <text font-family="system-ui,sans-serif" font-size="11" fill="#111827">
    ${wrapSVGText(safeOutput, 446, TEXT_START_Y, 130, 14, 3)}
  </text>
</svg>`
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export function generateCardSVG(params: {
  tool_name: string
  task_id: TaskId
  niche: string
}): string {
  const { tool_name, task_id, niche } = params

  const template = FLOW_TEMPLATES[task_id]
  if (!template) return generateFallbackSVG(escapeSVG(tool_name))

  // Шаблон вызывается с RAW нишей — escape происходит в generateToolSVG
  const flow = template(niche)

  return generateToolSVG({
    tool_name,
    task_id,
    niche,
    input_label:  flow.input,
    action_label: flow.action,
    output_label: flow.output,
  })
}

function generateFallbackSVG(safeToolName: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 80" width="520" height="80">
  <rect x="4" y="4" width="512" height="72" rx="8" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="1"/>
  <text x="260" y="44" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#6B7280">
    ${safeToolName} — автоматизирует задачу
  </text>
</svg>`
}

export function generateAITeamSVG(params: {
  tools: { name: string; url: string; cost_monthly: number | null; used_in_blocks: string[] }[]
  total_paid_monthly: number
  total_traditional_cost: number
  savings_monthly: number
}): string {
  const { tools, total_paid_monthly, total_traditional_cost, savings_monthly } = params

  const COLS = 4
  const CARD_W = 110
  const CARD_H = 52
  const GAP_X = 12
  const GAP_Y = 10
  const PADDING = 16

  const rows = Math.ceil(tools.length / COLS)
  const svgW = COLS * CARD_W + (COLS - 1) * GAP_X + PADDING * 2
  const svgH = rows * CARD_H + (rows - 1) * GAP_Y + PADDING * 2 + 80

  const toolCards = tools.map((tool, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = PADDING + col * (CARD_W + GAP_X)
    const y = PADDING + row * (CARD_H + GAP_Y)

    // v2: escapeSVG для всех строк из данных
    const safeName = escapeSVG(tool.name)
    const safeBlocks = escapeSVG(tool.used_in_blocks.join(', '))
    const costText = tool.cost_monthly === 0 || tool.cost_monthly === null
      ? 'Бесплатно'
      : `$${tool.cost_monthly}/мес`

    return `
  <g>
    <rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="6" fill="#F8FAFF" stroke="#DBEAFE" stroke-width="1"/>
    <text x="${x + CARD_W / 2}" y="${y + 18}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#1E40AF">
      ${safeName.length > 14 ? safeName.slice(0, 13) + '…' : safeName}
    </text>
    <text x="${x + CARD_W / 2}" y="${y + 32}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#6B7280">${safeBlocks}</text>
    <text x="${x + CARD_W / 2}" y="${y + 44}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="600" fill="${tool.cost_monthly === 0 || tool.cost_monthly === null ? '#16A34A' : '#374151'}">${costText}</text>
  </g>`
  }).join('')

  const summaryY = PADDING + rows * (CARD_H + GAP_Y) + 10
  const summarySection = `
  <line x1="${PADDING}" y1="${summaryY}" x2="${svgW - PADDING}" y2="${summaryY}" stroke="#E5E7EB" stroke-width="1"/>
  <text x="${PADDING}" y="${summaryY + 20}" font-family="system-ui,sans-serif" font-size="11" fill="#6B7280">
    AI стек: <tspan font-weight="700" fill="#1E40AF">$${total_paid_monthly}/мес</tspan>
  </text>
  <text x="${PADDING}" y="${summaryY + 38}" font-family="system-ui,sans-serif" font-size="11" fill="#6B7280">
    Традиционный подход: <tspan font-weight="700" fill="#374151">$${total_traditional_cost.toLocaleString()}/мес</tspan>
  </text>
  <text x="${svgW - PADDING}" y="${summaryY + 29}" text-anchor="end" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#16A34A">
    Экономия: $${savings_monthly.toLocaleString()}/мес
  </text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
  ${toolCards}
  ${summarySection}
</svg>`
}
