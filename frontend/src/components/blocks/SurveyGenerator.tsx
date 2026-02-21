'use client';

import React, { useState } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface SurveyQuestion {
  id: number;
  category: 'demographics' | 'current_solution' | 'pain_points' | 'pricing' | 'willingness' | 'closing';
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'open_text';
  options?: string[];
  evidence_source?: string;
  required: boolean;
}

interface SurveyData {
  title: string;
  description: string;
  target_segment: string;
  questions: SurveyQuestion[];
  distribution_channels: DistributionChannel[];
  export_formats: {
    plain_text: string;
    google_forms_url: string;
  };
  evidence_coverage: {
    complaints_used: number;
    competitors_used: number;
    prices_used: number;
  };
  generated_at: string;
}

interface DistributionChannel {
  channel: string;
  platform: string;
  reason: string;
  evidence: string;
  action: string;
  estimated_responses: string;
  estimated_cost: string;
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  trendTitle: string;
  evidenceData: Record<string, any>;
}

const categoryLabels: Record<string, { label: string; icon: string; color: string }> = {
  demographics: { label: 'Демография', icon: '👤', color: 'text-blue-400' },
  current_solution: { label: 'Текущее решение', icon: '🔧', color: 'text-purple-400' },
  pain_points: { label: 'Боли и проблемы', icon: '🎯', color: 'text-red-400' },
  pricing: { label: 'Ценообразование', icon: '💰', color: 'text-yellow-400' },
  willingness: { label: 'Готовность платить', icon: '💳', color: 'text-green-400' },
  closing: { label: 'Завершение', icon: '📩', color: 'text-zinc-400' },
};

export default function SurveyGenerator({ trendTitle, evidenceData }: Props) {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/survey-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trendTitle,
          evidenceData: {
            problem: evidenceData.problem || null,
            demand: evidenceData.demand || null,
            sellability: evidenceData.sellability || null,
            occupation: evidenceData.occupation || null,
            economics: evidenceData.economics || null,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSurvey(data);
      setExpandedCategory(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!survey) return;
    try {
      await navigator.clipboard.writeText(survey.export_formats.plain_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = survey.export_formats.plain_text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Check if we have enough data
  const hasComplaints = (evidenceData.problem?.who_hurts?.complaints?.length || 0) > 0;
  const hasCompetitors = (evidenceData.occupation?.competitors_exist?.competitors?.length || 0) > 0;
  const hasPricing = (evidenceData.sellability?.average_ticket?.competitor_prices?.length || 0) > 0;
  const evidenceCount = [hasComplaints, hasCompetitors, hasPricing].filter(Boolean).length;

  // Group questions by category
  const groupedQuestions = survey?.questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, SurveyQuestion[]>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Customer Discovery Survey</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Опросник для валидации гипотез. Вопросы строятся из реальных жалоб и конкурентных данных.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {survey ? 'Обновить' : 'Сгенерировать опросник'}
        </button>
      </div>

      {/* Evidence coverage */}
      <div className="flex items-center gap-2 flex-wrap">
        <EvidenceBadge type="calculated" label="Детерминированная генерация" />
        {hasComplaints && <EvidenceBadge type="real_data" label={`${evidenceData.problem.who_hurts.complaints.length} жалоб`} />}
        {hasCompetitors && <EvidenceBadge type="real_data" label={`${evidenceData.occupation.competitors_exist.competitors.length} конкурентов`} />}
        {hasPricing && <EvidenceBadge type="real_data" label={`${evidenceData.sellability.average_ticket.competitor_prices.length} цен`} />}
      </div>

      {/* Data availability notice */}
      {!survey && !loading && evidenceCount < 2 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-sm text-yellow-300">
            Мало Evidence данных ({evidenceCount}/3). Опросник будет более общим.
          </p>
          <p className="text-xs text-yellow-400/70 mt-1">
            Для более точных вопросов запустите блоки: Проблема, Конкуренция, Продажи.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Survey content */}
      {survey && (
        <>
          {/* Stats bar */}
          <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-6">
              <Stat label="Вопросов" value={survey.questions.length} />
              <Stat label="Жалоб использовано" value={survey.evidence_coverage.complaints_used} />
              <Stat label="Конкурентов" value={survey.evidence_coverage.competitors_used} />
              <Stat label="Цен. точек" value={survey.evidence_coverage.prices_used} />
              <Stat label="Сегмент" value={survey.target_segment} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                }`}
              >
                {copied ? '✓ Скопировано' : '📋 Копировать всё'}
              </button>
            </div>
          </div>

          {/* Questions grouped by category */}
          <div className="space-y-3">
            {Object.entries(groupedQuestions).map(([category, questions]) => {
              const config = categoryLabels[category] || { label: category, icon: '?', color: 'text-white' };
              const isExpanded = expandedCategory === null || expandedCategory === category;

              return (
                <div key={category} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{config.icon}</span>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-xs text-zinc-500">{questions.length} вопросов</span>
                    </div>
                    <span className="text-zinc-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-4">
                      {questions.map((q) => (
                        <QuestionCard key={q.id} question={q} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Distribution Channels */}
          {survey.distribution_channels.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📡</span>
                  <h3 className="font-semibold text-white">Каналы распространения</h3>
                  <span className="text-xs text-zinc-500 ml-2">Подобраны автоматически из Evidence</span>
                </div>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {survey.distribution_channels.map((ch, i) => (
                  <ChannelCard key={i} channel={ch} index={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Plain text preview */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <PlainTextPreview text={survey.export_formats.plain_text} onCopy={copyToClipboard} copied={copied} />
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function ChannelCard({ channel: ch, index }: { channel: DistributionChannel; index: number }) {
  const priorityConfig = {
    high: { label: 'Высокий', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    medium: { label: 'Средний', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    low: { label: 'Низкий', color: 'text-zinc-400', bg: 'bg-zinc-700/30 border-zinc-600/20' },
  };
  const prio = priorityConfig[ch.priority];

  const platformIcons: Record<string, string> = {
    reddit: '🟠', linkedin: '🔵', producthunt: '🟧', hacker_news: '🟧',
    youtube: '🔴', indiehackers: '🟣', facebook: '🔵', twitter: '🐦',
    email: '📧', google: '🔍',
  };

  return (
    <div className="p-4 hover:bg-zinc-800/20 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-lg">{platformIcons[ch.platform] || '📌'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{index}. {ch.channel}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${prio.bg} ${prio.color}`}>
              {prio.label}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{ch.reason}</p>
          <div className="mt-2 bg-zinc-800/50 rounded-lg p-2.5 text-xs">
            <p className="text-indigo-300 font-medium">{ch.action}</p>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
            <span>Ожидаемо: <span className="text-zinc-300">{ch.estimated_responses}</span></span>
            <span>Бюджет: <span className="text-zinc-300">{ch.estimated_cost}</span></span>
            <span>Источник: {ch.evidence}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function QuestionCard({ question: q }: { question: SurveyQuestion }) {
  const typeIcon = q.type === 'single_choice' ? '○' : q.type === 'multiple_choice' ? '☐' : q.type === 'scale' ? '📏' : '✏️';

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-zinc-600 font-mono mt-0.5">{q.id}.</span>
        <div className="flex-1">
          <p className="text-sm text-white">
            {q.question}
            {q.required && <span className="text-red-400 ml-1">*</span>}
          </p>

          {q.options && (
            <div className="mt-2 space-y-1">
              {q.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-600 mt-0.5">{typeIcon}</span>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          )}

          {q.type === 'open_text' && !q.options && (
            <div className="mt-2 border-b border-zinc-700 w-full max-w-md" />
          )}

          {q.evidence_source && (
            <div className="mt-2">
              <EvidenceBadge type="real_data" label={q.evidence_source} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlainTextPreview({ text, onCopy, copied }: { text: string; onCopy: () => void; copied: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>📝</span>
          <span className="font-medium text-white">Текстовая версия (для Google Forms / Typeform)</span>
        </div>
        <span className="text-zinc-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-4">
          <div className="flex justify-end mb-2">
            <button
              onClick={onCopy}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                copied ? 'bg-green-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'
              }`}
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-950 rounded-lg p-4 max-h-96 overflow-y-auto">
            {text}
          </pre>
        </div>
      )}
    </>
  );
}
