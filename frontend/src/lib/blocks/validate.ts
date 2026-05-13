/**
 * Быстрая проверка сгенерированных файлов перед деплоем.
 * Ловит реальные баги которые мы видели:
 *  — invoice-template переменные просочившиеся в wizard страницу
 *    (editMode, docNumber, lineItems, recipient, taxRate, discount)
 *  — Использование переменных без useState/const декларации в том же файле
 *
 * Не запускает tsc (нет node_modules в temp), но 80% реальных
 * ошибок ловит за миллисекунды.
 */

export interface ValidationError {
  file: string
  line?: number
  message: string
}

const SUSPICIOUS_VARS = [
  'editMode',
  'docNumber',
  'lineItems',
  'recipient',
  'taxRate',
  'discount',
  'submitting',
  'notes',
  'setNotes',
] as const

/** Проверяет что переменная декларирована в файле как useState/const/let/var/function */
function isDeclaredInFile(content: string, varName: string): boolean {
  const patterns = [
    new RegExp(`\\b(?:const|let|var)\\s+\\[?\\s*${varName}\\b`),
    new RegExp(`\\bfunction\\s+${varName}\\b`),
    new RegExp(`\\b${varName}\\s*[:=]\\s*`),                   // destructured / property
    new RegExp(`useState[^()]*\\([^)]*\\)\\s*;?\\s*$`, 'm'),   // useState без явного имени — пропускаем
  ]
  // Conservative: ищем именно `[varName, ...]` (useState pattern) или `const varName`
  if (new RegExp(`\\bconst\\s+\\[\\s*${varName}\\s*,`).test(content)) return true
  if (new RegExp(`\\b(?:const|let|var)\\s+${varName}\\b`).test(content)) return true
  if (new RegExp(`\\bfunction\\s+${varName}\\b`).test(content)) return true
  if (new RegExp(`\\b(?:props|args)\\.${varName}\\b`).test(content)) return true
  if (new RegExp(`\\b${varName}\\s*:\\s*[A-Za-z]`).test(content)) return true  // type annotation in destructure
  return patterns.some(() => false) // explicit fallthrough — keep conservative
}

/** Находит строки где используется `{varName}` в JSX */
function findJsxUsages(content: string, varName: string): Array<{ line: number; text: string }> {
  const lines = content.split('\n')
  const out: Array<{ line: number; text: string }> = []
  // Match {varName} or {varName.something} or {varName ? ... } or {varName && ...}
  const re = new RegExp(`\\{\\s*${varName}\\b`)
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) out.push({ line: i + 1, text: lines[i].trim().slice(0, 120) })
  }
  return out
}

/**
 * Главная проверка: все известные suspicious vars должны либо быть декларированы
 * в файле, либо не упоминаться в JSX.
 */
export function quickSyntaxCheck(files: Record<string, string>): ValidationError[] {
  const errors: ValidationError[] = []

  // tsconfig.json target must be >= es2017 (Set iteration, async/await, etc.)
  const tsconfigContent = files['tsconfig.json']
  if (tsconfigContent) {
    try {
      const cfg = JSON.parse(tsconfigContent) as { compilerOptions?: { target?: string } }
      const target = (cfg.compilerOptions?.target ?? '').toLowerCase()
      const allowed = ['es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'esnext']
      if (target && !allowed.includes(target)) {
        errors.push({
          file: 'tsconfig.json',
          message: `Unsupported target '${target}' — Set/Map iteration requires es2017+`,
        })
      }
    } catch {
      errors.push({ file: 'tsconfig.json', message: 'Invalid JSON in tsconfig.json' })
    }
  }

  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) continue

    for (const varName of SUSPICIOUS_VARS) {
      const usages = findJsxUsages(content, varName)
      if (usages.length === 0) continue
      if (isDeclaredInFile(content, varName)) continue

      // Variable used in JSX but never declared — likely template-leak bug
      for (const u of usages.slice(0, 3)) {
        errors.push({
          file: filePath,
          line: u.line,
          message: `'${varName}' used in JSX but not declared in file: ${u.text}`,
        })
      }
    }

    // Trivial brace balance heuristic — only catch huge mismatches (>10 diff)
    const opens = (content.match(/\{/g) ?? []).length
    const closes = (content.match(/\}/g) ?? []).length
    if (Math.abs(opens - closes) > 10) {
      errors.push({
        file: filePath,
        message: `Brace mismatch: ${opens} '{' vs ${closes} '}' (diff ${opens - closes})`,
      })
    }
  }

  return errors
}
