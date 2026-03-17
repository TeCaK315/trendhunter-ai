'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, Download, RefreshCw, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

/* ─── Types ─── */
interface AnalysisResult {
  [key: string]: any;
}

/* ─── Main Page ─── */
export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <AnalysisContent />
    </Suspense>
  );
}

function AnalysisContent() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('Подготавливаем данные...');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    const steps = [
      'Подготавливаем данные...',
      'Отправляем на анализ...',
      'AI обрабатывает запрос...',
      'Формируем результат...',
    ];
    let step = 0;
    const interval = setInterval(() => {
      step = Math.min(step + 1, steps.length - 1);
      setLoadingText(steps[step]);
    }, 2500);

    try {
      // Build request body from query params
      const q = searchParams.get('q');
      const body: Record<string, any> = {};

      if (q) {
        body.input = q;
        body.q = q;
      } else {
        // Multi-field: collect all params
        searchParams.forEach((value, key) => {
          if (key !== 'id') body[key] = value;
        });
        if (!body.input && Object.keys(body).length > 0) {
          body.input = Object.values(body).join(' ');
        }
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка анализа');
      }

      const data = await res.json();
      setResult(data.analysis || data);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [searchParams]);

  const loadSavedAnalysis = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (dbError || !data) throw new Error('Анализ не найден');
      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      loadSavedAnalysis(id);
    } else if (searchParams.toString()) {
      runAnalysis();
    }
  }, [searchParams, runAnalysis, loadSavedAnalysis]);

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f0f23' }}>
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse"
            style={{ background: '#6366f120' }}
          >
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#6366f1' }} />
          </div>
          <p className="text-lg font-medium mb-2" style={{ color: '#e2e8f0' }}>
            {loadingText}
          </p>
          <p className="text-sm" style={{ color: '#e2e8f050' }}>
            Это может занять до 30 секунд
          </p>
        </div>
      </div>
    );
  }

  /* ─── Error State ─── */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f0f23' }}>
        <div className="max-w-md text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: '#ef444420' }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: '#ef4444' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#e2e8f0' }}>
            Ошибка
          </h2>
          <p className="mb-6" style={{ color: '#e2e8f070' }}>{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => runAnalysis()}
              className="px-6 py-2.5 rounded-xl font-medium text-white flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <RefreshCw className="w-4 h-4" /> Повторить
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-2.5 rounded-xl font-medium border flex items-center gap-2"
              style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
            >
              <ArrowLeft className="w-4 h-4" /> Назад
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── No Result ─── */
  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f0f23' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: '#e2e8f070' }}>Нет данных для отображения</p>
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-xl font-medium text-white inline-flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Вернуться к анализу
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Result Display ─── */
  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg hover:opacity-80 transition-colors"
              style={{ background: '#6366f110' }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#6366f1' }} />
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
                Результат
              </h1>
              <p className="text-sm" style={{ color: '#e2e8f050' }}>
                AI analyzes market data and generates strategic insights
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80"
              style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
            >
              <RefreshCw className="w-4 h-4" /> Новый анализ
            </button>
          </div>
        </div>

        {/* Result Content */}
        <ResultRenderer data={result} />

        {/* History Link */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="text-sm inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: '#6366f1' }}
          >
            <Clock className="w-3.5 h-3.5" /> Посмотреть все анализы
          </Link>
        </div>
      </div>
    </div>
  );
}


/* ─── Report Renderer ─── */
function ResultRenderer({ data }: { data: any }) {
  const title = data.title || 'Отчёт';
  const executiveSummary = data.executive_summary || '';
  const sections = data.sections || [];
  const conclusion = data.conclusion || '';
  const recommendations = data.recommendations || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="rounded-2xl border p-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
        <h2 className="text-xl font-heading font-bold mb-3" style={{ color: '#e2e8f0' }}>{title}</h2>
        {executiveSummary && (
          <p className="text-sm leading-relaxed" style={{ color: '#e2e8f080' }}>{executiveSummary}</p>
        )}
      </div>

      {/* Sections */}
      {sections.map((section: any, i: number) => (
        <div key={i} className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2" style={{ color: '#e2e8f0' }}>
            <span className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {i + 1}
            </span>
            {section.heading}
          </h3>
          <p className="text-sm leading-relaxed mb-3" style={{ color: '#e2e8f080' }}>{section.content}</p>
          {section.key_points && section.key_points.length > 0 && (
            <ul className="space-y-1.5">
              {section.key_points.map((point: string, j: number) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                  <span style={{ color: '#e2e8f070' }}>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Conclusion */}
      {conclusion && (
        <div className="rounded-2xl border p-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
          <h3 className="font-heading font-semibold mb-2" style={{ color: '#e2e8f0' }}>Заключение</h3>
          <p className="text-sm" style={{ color: '#e2e8f080' }}>{conclusion}</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
          <h3 className="font-heading font-semibold mb-3" style={{ color: '#e2e8f0' }}>Рекомендации</h3>
          <ul className="space-y-2">
            {recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                <span style={{ color: '#e2e8f080' }}>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
