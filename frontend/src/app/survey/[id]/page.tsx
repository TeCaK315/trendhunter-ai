'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface SurveyQuestion {
  id: number;
  category: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'open_text';
  options?: string[];
  required: boolean;
}

interface SurveyData {
  survey_id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

export default function SurveyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.id as string;
  const token = searchParams.get('token') || 'anonymous';

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const res = await fetch(`/api/surveys?survey_id=${surveyId}`);
        if (!res.ok) throw new Error('Survey not found');
        const data = await res.json();
        setSurvey(data);
      } catch {
        setError('Опрос не найден или ссылка недействительна.');
      } finally {
        setLoading(false);
      }
    }
    fetchSurvey();
  }, [surveyId]);

  const setAnswer = (qId: number, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [String(qId)]: value }));
    setValidationErrors(prev => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
  };

  // Parse max choices from question text (e.g. "до 3", "выберите до 3", "up to 3")
  const getMaxChoices = (question: string): number | null => {
    const ruMatch = question.match(/до\s+(\d+)/i);
    if (ruMatch) return parseInt(ruMatch[1]);
    const enMatch = question.match(/up\s+to\s+(\d+)/i);
    if (enMatch) return parseInt(enMatch[1]);
    return null;
  };

  const toggleMultiChoice = (qId: number, option: string, questionText: string) => {
    const maxChoices = getMaxChoices(questionText);
    setAnswers(prev => {
      const current = (prev[String(qId)] as string[]) || [];
      if (current.includes(option)) {
        // Always allow deselect
        return { ...prev, [String(qId)]: current.filter(o => o !== option) };
      }
      // Enforce max choices limit
      if (maxChoices && current.length >= maxChoices) {
        return prev; // Don't add more
      }
      return { ...prev, [String(qId)]: [...current, option] };
    });
    setValidationErrors(prev => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!survey) return;

    // Validate required fields
    const errors = new Set<number>();
    for (const q of survey.questions) {
      if (q.required) {
        const answer = answers[String(q.id)];
        if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && answer.trim() === '')) {
          errors.add(q.id);
        }
      }
    }

    if (errors.size > 0) {
      setValidationErrors(errors);
      // Scroll to first error
      const firstError = document.querySelector('[data-validation-error="true"]');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/survey-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survey_id: surveyId,
          token,
          answers,
          completed_at: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (res.status === 409) {
        setSubmitted(true); // Already submitted
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="text-center">
          <span className="text-5xl block mb-4">😔</span>
          <h1 className="text-xl font-semibold text-white mb-2">Ошибка</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <span className="text-6xl block mb-6">🎉</span>
          <h1 className="text-2xl font-bold text-white mb-3">Спасибо за участие!</h1>
          <p className="text-zinc-400">
            Ваши ответы записаны. Они помогут нам лучше понять потребности рынка.
          </p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  // Group questions by category
  const categories: Record<string, SurveyQuestion[]> = {};
  for (const q of survey.questions) {
    if (!categories[q.category]) categories[q.category] = [];
    categories[q.category].push(q);
  }

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    demographics: { label: 'О вас', icon: '👤' },
    current_solution: { label: 'Текущее решение', icon: '🔧' },
    pain_points: { label: 'Проблемы', icon: '🎯' },
    pricing: { label: 'Ценообразование', icon: '💰' },
    willingness: { label: 'Готовность платить', icon: '💳' },
    closing: { label: 'Завершение', icon: '📩' },
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <div className="bg-gradient-to-b from-indigo-500/10 to-transparent">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <span className="text-4xl block mb-4">📝</span>
          <h1 className="text-2xl font-bold text-white mb-2">{survey.title}</h1>
          {survey.description && (
            <p className="text-zinc-400 text-sm">{survey.description}</p>
          )}
          <p className="text-zinc-500 text-xs mt-4">
            {survey.questions.length} вопросов • ~2-3 минуты
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 pb-12 space-y-6">
        {Object.entries(categories).map(([category, questions]) => {
          const config = categoryLabels[category] || { label: category, icon: '📋' };
          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2 pt-4">
                <span className="text-lg">{config.icon}</span>
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{config.label}</h2>
              </div>

              {questions.map((q) => {
                const hasError = validationErrors.has(q.id);
                return (
                  <div
                    key={q.id}
                    data-validation-error={hasError ? 'true' : 'false'}
                    className={`bg-zinc-900/50 border rounded-xl p-5 transition-colors ${
                      hasError ? 'border-red-500/50' : 'border-zinc-800'
                    }`}
                  >
                    <p className="text-sm text-white mb-3">
                      {q.question}
                      {q.required && <span className="text-red-400 ml-1">*</span>}
                    </p>
                    {hasError && (
                      <p className="text-xs text-red-400 mb-2">Это обязательный вопрос</p>
                    )}

                    {/* Single Choice */}
                    {q.type === 'single_choice' && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, opt)}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors w-full text-left"
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              answers[String(q.id)] === opt
                                ? 'border-indigo-500 bg-indigo-500'
                                : 'border-zinc-600'
                            }`}>
                              {answers[String(q.id)] === opt && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-sm text-zinc-300">{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Multiple Choice */}
                    {q.type === 'multiple_choice' && q.options && (() => {
                      const maxChoices = getMaxChoices(q.question);
                      const currentSelected = ((answers[String(q.id)] as string[]) || []);
                      const limitReached = maxChoices ? currentSelected.length >= maxChoices : false;
                      return (
                      <div className="space-y-2">
                        {limitReached && (
                          <p className="text-xs text-amber-400">Выбрано максимум ({maxChoices})</p>
                        )}
                        {q.options!.map((opt) => {
                          const selected = currentSelected.includes(opt);
                          const disabled = limitReached && !selected;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMultiChoice(q.id, opt, q.question)}
                              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors w-full text-left ${
                                disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                selected
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-zinc-600'
                              }`}>
                                {selected && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-sm text-zinc-300">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      );
                    })()}

                    {/* Scale */}
                    {q.type === 'scale' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                          <button
                            key={val}
                            onClick={() => setAnswer(q.id, String(val))}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                              answers[String(q.id)] === String(val)
                                ? 'bg-indigo-500 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <div className="flex justify-between w-full text-[10px] text-zinc-500 mt-1 px-1">
                          <span>Совсем нет</span>
                          <span>Максимально</span>
                        </div>
                      </div>
                    )}

                    {/* Open Text */}
                    {q.type === 'open_text' && (
                      <textarea
                        value={(answers[String(q.id)] as string) || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="Ваш ответ..."
                        rows={3}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 resize-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Submit */}
        <div className="pt-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-wait text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Отправляю...
              </>
            ) : (
              'Отправить ответы'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-zinc-600">
            Powered by TrendHunter AI
          </p>
        </div>
      </div>
    </div>
  );
}
