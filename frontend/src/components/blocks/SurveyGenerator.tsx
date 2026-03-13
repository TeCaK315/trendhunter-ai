'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import EvidenceBadge from '../EvidenceBadge';
import Papa from 'papaparse';

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

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  remaining_today: number;
  survey_url: string;
  errors?: string[];
}

interface AggregatedAnswer {
  question_id: string;
  total_answers: number;
  choice_counts: Record<string, number>;
  scale_values: number[];
  scale_average: number | null;
  text_answers: string[];
}

interface ResponseData {
  survey_id: string;
  total_responses: number;
  aggregated: AggregatedAnswer[];
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

// Persist key based on trend title
function getStorageKey(trendTitle: string) {
  return `survey_${trendTitle.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_').substring(0, 40)}`;
}

function loadPersistedState(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function persistState(key: string, data: Record<string, unknown>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

export default function SurveyGenerator({ trendTitle, evidenceData }: Props) {
  const storageKey = getStorageKey(trendTitle);
  const cached = useRef(loadPersistedState(storageKey)).current;

  const [survey, setSurvey] = useState<SurveyData | null>(cached?.survey || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Survey automation state
  const [activeTab, setActiveTab] = useState<'survey' | 'send' | 'results'>(cached?.activeTab || 'survey');
  const [surveyId, setSurveyId] = useState<string | null>(cached?.surveyId || null);
  const [emails, setEmails] = useState<string[]>(cached?.emails || []);
  const [csvFileName, setCsvFileName] = useState<string>(cached?.csvFileName || '');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(cached?.sendResult || null);
  const [responses, setResponses] = useState<ResponseData | null>(cached?.responses || null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist important state to localStorage
  useEffect(() => {
    persistState(storageKey, {
      survey, activeTab, surveyId, emails, csvFileName, sendResult, responses,
    });
  }, [storageKey, survey, activeTab, surveyId, emails, csvFileName, sendResult, responses]);

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
      setSurveyId(null); // Reset saved survey
      setSendResult(null);
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

  // Save survey and send emails
  const saveSurveyAndSend = async () => {
    if (!survey || emails.length === 0) return;
    setSending(true);
    setError(null);

    try {
      // Step 1: Save survey if not saved yet
      let sid = surveyId;
      if (!sid) {
        const saveRes = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend_id: trendTitle,
            title: survey.title,
            description: survey.description,
            questions: survey.questions,
            target_icp: buildICP(),
          }),
        });
        const saveData = await saveRes.json();
        if (!saveData.success) throw new Error(saveData.error || 'Failed to save survey');
        sid = saveData.survey_id;
        setSurveyId(sid);
      }

      // Step 2: Send emails
      const sendRes = await fetch('/api/send-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: sid,
          emails,
          subject: `Опрос: ${trendTitle}`,
          sender_name: 'TrendHunter AI',
          trend_title: trendTitle,
        }),
      });
      const sendData = await sendRes.json();
      if (sendRes.status === 429) {
        setError(`Дневной лимит исчерпан. Осталось: ${sendData.remaining_today}`);
        return;
      }
      if (!sendRes.ok) throw new Error(sendData.error || 'Failed to send');

      setSendResult(sendData);
      setActiveTab('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    if (!surveyId) return;
    setResponsesLoading(true);
    try {
      const res = await fetch(`/api/survey-responses?survey_id=${surveyId}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      }
    } catch { /* ignore */ }
    finally { setResponsesLoading(false); }
  }, [surveyId]);

  // Auto-refresh responses every 30 sec
  useEffect(() => {
    if (activeTab !== 'results' || !surveyId) return;
    fetchResponses();
    const interval = setInterval(fetchResponses, 30000);
    return () => clearInterval(interval);
  }, [activeTab, surveyId, fetchResponses]);

  // CSV upload handler
  const handleCSVUpload = (file: File) => {
    setCsvFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        const foundEmails: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const row of results.data as string[][]) {
          for (const cell of row) {
            if (typeof cell === 'string' && emailRegex.test(cell.trim())) {
              foundEmails.push(cell.trim().toLowerCase());
            }
          }
        }
        setEmails([...new Set(foundEmails)]);
      },
      error: () => {
        setError('Ошибка парсинга CSV файла');
      },
    });
  };

  // Build ICP from evidence
  const buildICP = (): string => {
    const parts: string[] = [];
    const segment = evidenceData.sellability?.market_segment?.segment_type;
    if (segment) parts.push(`Сегмент: ${segment}`);
    const complaints = evidenceData.problem?.who_hurts?.complaints || [];
    if (complaints.length > 0) {
      const topPains = complaints.slice(0, 3).map((c: any) => c.text?.substring(0, 60)).filter(Boolean);
      if (topPains.length > 0) parts.push(`Боли: ${topPains.join('; ')}`);
    }
    const median = evidenceData.sellability?.average_ticket?.median_price;
    if (median) parts.push(`Бюджет: ~$${median}/мес`);
    return parts.join(' | ') || 'Не определён';
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

  // ICP data
  const icpSegment = evidenceData.sellability?.market_segment?.segment_type || '—';
  const icpMedianPrice = evidenceData.sellability?.average_ticket?.median_price;
  const icpComplaints = (evidenceData.problem?.who_hurts?.complaints || []).slice(0, 3);
  const icpCompetitors = (evidenceData.occupation?.competitors_exist?.competitors || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Опрос + Рассылка</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Генерация опросника, автоматическая рассылка по email и сбор ответов.
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

      {/* ICP Card */}
      {(icpSegment !== '—' || icpComplaints.length > 0) && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h3 className="font-semibold text-white text-sm">Портрет целевой аудитории (ICP)</h3>
            <EvidenceBadge type="calculated" label="Из Evidence" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 mb-1">Сегмент</div>
              <div className="text-sm font-medium text-white">{icpSegment}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 mb-1">Бюджет</div>
              <div className="text-sm font-medium text-white">{icpMedianPrice ? `~$${icpMedianPrice}/мес` : '—'}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
              <div className="text-[10px] text-zinc-500 mb-1">Топ боли</div>
              <div className="text-xs text-zinc-300 line-clamp-2">
                {icpComplaints.length > 0
                  ? icpComplaints.map((c: any) => c.text?.substring(0, 40) + '...').join('; ')
                  : '—'}
              </div>
            </div>
          </div>
          {icpCompetitors.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-500">Конкуренты:</span>
              {icpCompetitors.map((c: any, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
          {/* Tabs: Survey | Send | Results */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-1">
            {([
              { id: 'survey' as const, label: 'Опросник', icon: '📝' },
              { id: 'send' as const, label: 'Рассылка', icon: '📧' },
              { id: 'results' as const, label: 'Результаты', icon: '📊', badge: responses?.total_responses },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-zinc-800/50 text-white border-b-2 border-indigo-500'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Survey */}
          {activeTab === 'survey' && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-wrap gap-3">
                <div className="flex items-center gap-6 flex-wrap">
                  <Stat label="Вопросов" value={survey.questions.length} />
                  <Stat label="Жалоб" value={survey.evidence_coverage.complaints_used} />
                  <Stat label="Конкурентов" value={survey.evidence_coverage.competitors_used} />
                  <Stat label="Сегмент" value={survey.target_segment} />
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    copied ? 'bg-green-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                  }`}
                >
                  {copied ? '✓ Скопировано' : '📋 Копировать'}
                </button>
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
            </div>
          )}

          {/* Tab: Send */}
          {activeTab === 'send' && (
            <div className="space-y-4">
              {/* CSV Upload */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📧</span>
                  <h3 className="font-semibold text-white">Email рассылка</h3>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCSVUpload(file);
                  }}
                />

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCSVUpload(file);
                  }}
                  className="border-2 border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  {emails.length === 0 ? (
                    <>
                      <span className="text-3xl block mb-3">📄</span>
                      <p className="text-sm text-white font-medium">
                        Загрузите CSV файл с email адресами
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Перетащите файл сюда или нажмите для выбора
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-2">
                        Поддержка: .csv, .txt — алгоритм автоматически найдёт все email адреса
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl block mb-3">✅</span>
                      <p className="text-sm text-white font-medium">
                        {csvFileName}
                      </p>
                      <p className="text-xs text-green-400 mt-1">
                        Найдено {emails.length} уникальных email адресов
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-2">
                        Нажмите чтобы загрузить другой файл
                      </p>
                    </>
                  )}
                </div>

                {/* Manual email input */}
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 mb-2">Или введите email через запятую:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const newEmails = input.value.split(/[,;\s]+/).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
                          if (newEmails.length > 0) {
                            setEmails(prev => [...new Set([...prev, ...newEmails.map(e => e.trim().toLowerCase())])]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector('input[placeholder*="email1"]') as HTMLInputElement;
                        if (input) {
                          const newEmails = input.value.split(/[,;\s]+/).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
                          if (newEmails.length > 0) {
                            setEmails(prev => [...new Set([...prev, ...newEmails.map(e => e.trim().toLowerCase())])]);
                            input.value = '';
                          }
                        }
                      }}
                      className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Добавить
                    </button>
                  </div>
                </div>

                {/* Email count + send button */}
                {emails.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-white font-medium">{emails.length} email</span>
                      <button
                        onClick={() => { setEmails([]); setCsvFileName(''); }}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Очистить
                      </button>
                    </div>
                    <button
                      onClick={saveSurveyAndSend}
                      disabled={sending}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {sending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Отправляю...
                        </>
                      ) : (
                        <>📧 Разослать опрос</>
                      )}
                    </button>
                  </div>
                )}

                {/* Send result */}
                {sendResult && (
                  <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">✅</span>
                      <span className="text-sm font-medium text-green-400">Рассылка завершена</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-green-400">{sendResult.sent}</div>
                        <div className="text-[10px] text-zinc-500">Отправлено</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-400">{sendResult.failed}</div>
                        <div className="text-[10px] text-zinc-500">Ошибок</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-zinc-400">{sendResult.remaining_today}</div>
                        <div className="text-[10px] text-zinc-500">Осталось сегодня</div>
                      </div>
                    </div>
                    {sendResult.survey_url && (
                      <div className="mt-3 p-2 bg-zinc-800/50 rounded-lg">
                        <p className="text-[10px] text-zinc-500 mb-1">Ссылка на опрос (для ручного распространения):</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-indigo-300 flex-1 truncate">{sendResult.survey_url}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(sendResult.survey_url);
                            }}
                            className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-[10px] transition-colors"
                          >
                            Копировать
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rate limit info */}
                <p className="text-[10px] text-zinc-600 mt-3">
                  Лимит: 100 email/день (Resend free tier). Письма отправляются от onboarding@resend.dev.
                </p>
              </div>
            </div>
          )}

          {/* Tab: Results */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {!surveyId ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
                  <span className="text-4xl block mb-3">📊</span>
                  <p className="text-sm text-white font-medium">Нет данных</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Сначала разошлите опрос через вкладку "Рассылка"
                  </p>
                </div>
              ) : (
                <>
                  {/* Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      label="Ответов"
                      value={responses?.total_responses || 0}
                      icon="📝"
                    />
                    <MetricCard
                      label="Отправлено"
                      value={sendResult?.sent || emails.length || 0}
                      icon="📧"
                    />
                    <MetricCard
                      label="Response Rate"
                      value={`${
                        (sendResult?.sent || emails.length) > 0
                          ? Math.round(((responses?.total_responses || 0) / (sendResult?.sent || emails.length)) * 100)
                          : 0
                      }%`}
                      icon="📈"
                    />
                    <MetricCard
                      label="Статус"
                      value={responsesLoading ? 'Обновляю...' : 'Активен'}
                      icon="🟢"
                    />
                  </div>

                  {/* Refresh button */}
                  <div className="flex justify-end">
                    <button
                      onClick={fetchResponses}
                      disabled={responsesLoading}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs transition-colors flex items-center gap-1"
                    >
                      {responsesLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Обновить
                    </button>
                  </div>

                  {/* Per-question breakdown */}
                  {responses && responses.aggregated.length > 0 && (
                    <div className="space-y-3">
                      {responses.aggregated.map((agg) => {
                        const question = survey.questions.find(q => String(q.id) === agg.question_id);
                        if (!question) return null;

                        return (
                          <div key={agg.question_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                            <p className="text-sm text-white mb-3">
                              <span className="text-zinc-500 font-mono text-xs mr-2">#{agg.question_id}</span>
                              {question.question}
                            </p>
                            <p className="text-[10px] text-zinc-500 mb-2">{agg.total_answers} ответов</p>

                            {/* Choice breakdown (bar chart) */}
                            {Object.keys(agg.choice_counts).length > 0 && (
                              <div className="space-y-1.5">
                                {Object.entries(agg.choice_counts)
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([option, count]) => {
                                    const percent = agg.total_answers > 0
                                      ? Math.round((count / agg.total_answers) * 100)
                                      : 0;
                                    return (
                                      <div key={option} className="flex items-center gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between text-xs mb-0.5">
                                            <span className="text-zinc-300 truncate max-w-[200px]">{option}</span>
                                            <span className="text-zinc-500">{count} ({percent}%)</span>
                                          </div>
                                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-indigo-500 rounded-full transition-all"
                                              style={{ width: `${percent}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Scale average */}
                            {agg.scale_average !== null && (
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-indigo-400">{agg.scale_average}</span>
                                <span className="text-xs text-zinc-500">/ 10 среднее</span>
                                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full"
                                    style={{ width: `${(agg.scale_average / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Text answers */}
                            {agg.text_answers.length > 0 && (
                              <div className="space-y-1.5">
                                {agg.text_answers.slice(0, 5).map((text, i) => (
                                  <div key={i} className="bg-zinc-800/30 rounded-lg px-3 py-2">
                                    <p className="text-xs text-zinc-300">"{text}"</p>
                                  </div>
                                ))}
                                {agg.text_answers.length > 5 && (
                                  <p className="text-[10px] text-zinc-500">
                                    ...и ещё {agg.text_answers.length - 5} ответов
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No responses yet */}
                  {responses && responses.total_responses === 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
                      <span className="text-3xl block mb-2">⏳</span>
                      <p className="text-sm text-white">Ответов пока нет</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Данные обновляются автоматически каждые 30 секунд
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

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
