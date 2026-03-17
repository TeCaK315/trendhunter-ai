import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const primaryOutput = ctx.safe.primaryOutput || 'Analysis';

  return {
    'src/components/CsvUploader.tsx': `'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, ChevronDown, Loader2 } from 'lucide-react';

interface CsvUploaderProps {
  onProcess: (rows: Record<string, string>[], column: string) => void;
  processing?: boolean;
}

export default function CsvUploader({ onProcess, processing }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [selectedCol, setSelectedCol] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\\n').filter(l => l.trim());
    if (lines.length < 2) return;

    // Simple CSV parser (handles quoted fields)
    function parseLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if ((ch === ',' || ch === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headerRow = parseLine(lines[0]);
    setHeaders(headerRow);
    setSelectedCol(headerRow[0] || '');

    const dataLines = lines.slice(1);
    const previewRows = dataLines.slice(0, 5).map(l => parseLine(l));
    setPreview(previewRows);

    const parsed = dataLines.map(l => {
      const cells = parseLine(l);
      const obj: Record<string, string> = {};
      headerRow.forEach((h, i) => { obj[h] = cells[i] || ''; });
      return obj;
    });
    setAllRows(parsed);
  }, []);

  function handleFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) parseCSV(text);
    };
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      handleFile(f);
    }
  }

  function reset() {
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setAllRows([]);
    setSelectedCol('');
  }

  return (
    <div className="space-y-6">
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? '${t.primary}' : '${t.primary40}',
            background: dragOver ? '${t.primary10}' : 'transparent',
          }}
        >
          <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: '${t.primary}' }} />
          <p className="text-lg font-semibold mb-2" style={{ color: '${t.text}' }}>
            Перетащите CSV файл сюда
          </p>
          <p className="text-sm" style={{ color: '${t.text70}' }}>
            или нажмите для выбора файла
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <div>
          {/* File info */}
          <div className="flex items-center justify-between p-4 rounded-xl mb-4" style={{ background: '${t.primary10}' }}>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6" style={{ color: '${t.primary}' }} />
              <div>
                <p className="font-medium" style={{ color: '${t.text}' }}>{file.name}</p>
                <p className="text-sm" style={{ color: '${t.text70}' }}>
                  {allRows.length} строк, {headers.length} колонок
                </p>
              </div>
            </div>
            <button onClick={reset} className="p-2 rounded-lg hover:opacity-70" style={{ color: '${t.text70}' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border mb-4" style={{ borderColor: '${t.primary40}' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '${t.primary10}' }}>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} className="border-t" style={{ borderColor: '${t.primary20}' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2 max-w-[200px] truncate" style={{ color: '${t.text80}' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Column selector */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium" style={{ color: '${t.text}' }}>
              Колонка для анализа:
            </label>
            <div className="relative">
              <select
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="appearance-none px-4 py-2 pr-10 rounded-xl border text-sm font-medium"
                style={{ borderColor: '${t.primary40}', background: '${t.primary10}', color: '${t.text}' }}
              >
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '${t.text70}' }} />
            </div>
          </div>

          {/* Process button */}
          <button
            onClick={() => onProcess(allRows, selectedCol)}
            disabled={processing || !selectedCol}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-2"
            style={{ background: '${t.gradientPrimary}' }}
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-5 h-5" />
                Анализировать {allRows.length} строк
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
`,

    'src/app/api/batch-analyze/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { items, column, userId } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const systemPrompt = \`You are a batch processor. For each input, provide a brief analysis.
Return a JSON object: { "category": string, "priority": "high"|"medium"|"low", "summary": string, "suggestion": string }\`;

    // Process in batches of 5
    const batchSize = 5;
    const results: any[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item: any) => {
        const input = item[column] || JSON.stringify(item);
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${apiKey}\`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: input },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
              max_tokens: 300,
            }),
          });

          if (!res.ok) {
            return { input, error: 'API error', result: null };
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || '{}';

          let parsed;
          try {
            parsed = JSON.parse(content);
          } catch {
            parsed = { summary: content };
          }

          return { input, result: parsed, error: null };
        } catch (err) {
          return { input, error: String(err), result: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Save batch result to Supabase
    if (supabaseUrl && supabaseKey && userId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('analyses').insert({
          user_id: userId,
          input: \`Batch: \${items.length} items from column "\${column}"\`,
          input_type: 'csv_batch',
          result: { batch_results: results, total: items.length },
          tokens_used: 0,
        });
      } catch (e) {
        console.error('Failed to save batch result:', e);
      }
    }

    return NextResponse.json({
      results,
      total: items.length,
      processed: results.filter(r => r.result).length,
      errors: results.filter(r => r.error).length,
    });
  } catch (err) {
    console.error('Batch analyze error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
`,

    'src/app/dashboard/batch/page.tsx': `'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileSpreadsheet, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import CsvUploader from '@/components/CsvUploader';

interface BatchResult {
  input: string;
  result: any;
  error: string | null;
}

export default function BatchPage() {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const supabase = createClient();

  async function handleProcess(rows: Record<string, string>[], column: string) {
    setProcessing(true);
    setProgress({ done: 0, total: rows.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows,
          column,
          userId: user?.id,
        }),
      });

      if (!res.ok) throw new Error('Batch processing failed');

      const data = await res.json();
      setResults(data.results || []);
      setProgress({ done: data.processed || 0, total: data.total || 0 });
    } catch (err) {
      console.error('Batch error:', err);
    } finally {
      setProcessing(false);
    }
  }

  function exportCSV() {
    if (results.length === 0) return;

    const headers = ['Input', 'Category', 'Priority', 'Summary', 'Suggestion', 'Error'];
    const rows = results.map(r => [
      r.input || '',
      r.result?.category || '',
      r.result?.priority || '',
      r.result?.summary || '',
      r.result?.suggestion || '',
      r.error || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <FileSpreadsheet className="w-7 h-7" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>
            Пакетная обработка
          </h1>
        </div>

        {/* Description */}
        <p className="text-sm mb-6" style={{ color: '${t.text70}' }}>
          Загрузите CSV файл, выберите колонку для анализа, и система обработает каждую строку с помощью AI.
          Результаты можно экспортировать обратно в CSV.
        </p>

        {/* Uploader */}
        <CsvUploader onProcess={handleProcess} processing={processing} />

        {/* Progress */}
        {processing && (
          <div className="mt-6 p-4 rounded-xl" style={{ background: '${t.primary10}' }}>
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '${t.primary}' }} />
              <span className="font-medium" style={{ color: '${t.text}' }}>
                Обработка данных...
              </span>
            </div>
            <div className="w-full h-3 rounded-full" style={{ background: '${t.primary20}' }}>
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: progress.total > 0 ? \`\${(progress.done / progress.total) * 100}%\` : '0%',
                  background: '${t.gradientPrimary}',
                }}
              />
            </div>
            <p className="text-sm mt-2" style={{ color: '${t.text70}' }}>
              {progress.done} / {progress.total} обработано
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !processing && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold" style={{ color: '${t.text}' }}>
                Результаты ({results.filter(r => r.result).length}/{results.length})
              </h2>
              <button
                onClick={exportCSV}
                className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80 transition-all"
                style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
              >
                <Download className="w-4 h-4" />
                Экспорт CSV
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '${t.primary40}' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '${t.primary10}' }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>Ввод</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>Категория</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>Приоритет</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>Результат</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: '${t.primary20}' }}>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: '${t.text80}' }}>
                        {r.input}
                      </td>
                      <td className="px-4 py-3" style={{ color: '${t.text80}' }}>
                        {r.result?.category || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {r.result?.priority && (
                          <span
                            className="px-2 py-1 rounded-lg text-xs font-semibold"
                            style={{
                              background: r.result.priority === 'high' ? '#fee2e2'
                                : r.result.priority === 'medium' ? '#fef3c7' : '#dcfce7',
                              color: r.result.priority === 'high' ? '#dc2626'
                                : r.result.priority === 'medium' ? '#d97706' : '#16a34a',
                            }}
                          >
                            {r.result.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[300px]" style={{ color: '${t.text80}' }}>
                        <p className="truncate">{r.result?.summary || r.error || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.result ? (
                          <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
                        ) : (
                          <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`,
  };
}
