'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface TrendSnapshot {
  date: string;
  google_trends_value: number;
  reddit_mentions: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  new_competitors_found: number;
  new_launches: number;
  competitor_price_changes: Array<{ name: string; old: string; new: string }>;
}

interface CompetitorPriceRecord {
  competitor: string;
  prices: Array<{ amount: string; plan: string; period: string }>;
  pricing_url: string;
  fetched_at: string;
}

interface TrendMonitor {
  trend_id: string;
  trend_title: string;
  created_at: string;
  last_checked: string;
  check_interval_days: number;
  status: 'active' | 'paused' | 'alert';
  alert_threshold: number;
  snapshots: TrendSnapshot[];
  current_trend: 'rising' | 'stable' | 'declining';
  change_percent: number;
  alert_message?: string;
  sources: {
    google_trends_url: string;
    reddit_search_url: string;
  };
  tracked_competitors: string[];
  price_history: CompetitorPriceRecord[][];
}

interface DigestItem {
  type: string;
  severity: 'info' | 'warning' | 'opportunity';
  title: string;
  detail: string;
  evidence: string;
  delta?: string;
}

interface DigestData {
  trend_id: string;
  trend_title: string;
  period: string;
  items: DigestItem[];
  summary: string;
  recommendation: string;
  snapshots: TrendSnapshot[];
}

interface Props {
  trendId: string;
  trendTitle: string;
  evidenceData?: Record<string, any>;
}

export default function MonitoringDashboard({ trendId, trendTitle, evidenceData }: Props) {
  const [monitor, setMonitor] = useState<TrendMonitor | null>(null);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await fetch(`/api/trend-monitor?trend_id=${trendId}`);
      const data = await res.json();
      if (data.success && data.monitor) {
        setMonitor(data.monitor);
      } else {
        setMonitor(null);
      }
    } catch {
      setMonitor(null);
    } finally {
      setLoading(false);
    }
  }, [trendId]);

  useEffect(() => {
    fetchMonitor();
  }, [fetchMonitor]);

  // Extract competitor names from evidence data
  const competitorNames: string[] = React.useMemo(() => {
    const competitors = evidenceData?.occupation?.competitors_exist?.competitors || [];
    return competitors.map((c: any) => c.name).filter(Boolean).slice(0, 5);
  }, [evidenceData]);

  const performAction = async (action: string) => {
    setActionLoading(action);
    setError(null);
    try {
      const payload: Record<string, any> = {
        action,
        trend_id: trendId,
        trend_title: trendTitle,
      };
      // Pass competitor names when creating monitor
      if (action === 'create' && competitorNames.length > 0) {
        payload.competitor_names = competitorNames;
      }
      const res = await fetch('/api/trend-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');

      if (data.monitor) setMonitor(data.monitor);
      if (data.digest) setDigest(data.digest);

      if (action === 'delete') {
        setMonitor(null);
        setDigest(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not monitoring yet
  if (!monitor) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Мониторинг тренда</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Отслеживайте изменения: Google Trends, Reddit, новые конкуренты, запуски на Product Hunt.
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📡</div>
          <h3 className="text-lg font-semibold text-white mb-2">Мониторинг не активен</h3>
          <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
            Включите мониторинг, чтобы отслеживать еженедельные изменения: рост/падение тренда,
            новые конкуренты, запуски, упоминания в Reddit.
          </p>
          <button
            onClick={() => performAction('create')}
            disabled={actionLoading === 'create'}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            {actionLoading === 'create' && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Включить мониторинг
          </button>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  // Monitoring active
  const statusConfig = {
    active: { label: 'Активен', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    paused: { label: 'Пауза', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    alert: { label: 'Алерт!', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };
  const status = statusConfig[monitor.status];

  const trendIcon = monitor.current_trend === 'rising' ? '📈' : monitor.current_trend === 'declining' ? '📉' : '➡️';

  const timeSinceCheck = getTimeSince(monitor.last_checked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Мониторинг тренда</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Еженедельное отслеживание изменений рынка
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EvidenceBadge type="real_data" label="SerpAPI данные" />
          {digest && <EvidenceBadge type="ai_synthesis" label="AI рекомендация" />}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Status bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            <span className="text-sm text-zinc-400">
              Последняя проверка: <span className="text-zinc-300">{timeSinceCheck}</span>
            </span>
            <span className="text-sm text-zinc-400">
              {trendIcon} {monitor.current_trend === 'rising' ? 'Растёт' : monitor.current_trend === 'declining' ? 'Падает' : 'Стабильно'}
              {monitor.change_percent !== 0 && (
                <span className={monitor.change_percent > 0 ? 'text-green-400' : 'text-red-400'}>
                  {' '}{monitor.change_percent > 0 ? '+' : ''}{monitor.change_percent}%
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => performAction('check-full')}
              disabled={actionLoading !== null}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {actionLoading === 'check-full' && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Проверить сейчас
            </button>
            <button
              onClick={() => performAction(monitor.status === 'paused' ? 'resume' : 'pause')}
              disabled={actionLoading !== null}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
            >
              {monitor.status === 'paused' ? '▶ Возобновить' : '⏸ Пауза'}
            </button>
            <button
              onClick={() => {
                if (confirm('Удалить мониторинг этого тренда?')) {
                  performAction('delete');
                }
              }}
              disabled={actionLoading !== null}
              className="px-3 py-2 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 rounded-lg text-sm transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>

        {/* Alert message */}
        {monitor.alert_message && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300">{monitor.alert_message}</p>
          </div>
        )}
      </div>

      {/* Digest */}
      {digest && digest.items.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h3 className="font-semibold text-white">Дайджест</h3>
                <span className="text-xs text-zinc-500">{digest.period}</span>
              </div>
              <span className="text-xs text-zinc-500">{digest.summary}</span>
            </div>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {digest.items.map((item, i) => (
              <DigestItemCard key={i} item={item} />
            ))}
          </div>

          {/* AI Recommendation */}
          {digest.recommendation && (
            <div className="p-4 border-t border-zinc-800 bg-indigo-500/5">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">💡</span>
                <div>
                  <p className="text-xs text-indigo-400 font-medium mb-1">Рекомендация</p>
                  <p className="text-sm text-zinc-300">{digest.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No digest yet - prompt to check */}
      {!digest && monitor.snapshots.length <= 1 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-sm text-zinc-400">
            Первый snapshot сохранён. Нажмите "Проверить сейчас" для получения дайджеста с изменениями.
          </p>
        </div>
      )}

      {/* Trend Chart */}
      {monitor.snapshots.length >= 2 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <h3 className="font-semibold text-white">График тренда</h3>
              <span className="text-xs text-zinc-500">{monitor.snapshots.length} проверок</span>
            </div>
          </div>
          <div className="p-4">
            <TrendChart snapshots={monitor.snapshots} />
          </div>
        </div>
      )}

      {/* Price History */}
      {monitor.price_history && monitor.price_history.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="font-semibold text-white">История цен конкурентов</h3>
                <span className="text-xs text-zinc-500">{monitor.tracked_competitors?.length || 0} конкурентов</span>
              </div>
              <EvidenceBadge type="real_data" label="SerpAPI pricing" />
            </div>
          </div>
          <div className="p-4 space-y-4">
            {(monitor.tracked_competitors || []).map((comp) => {
              // Get price history for this competitor across snapshots
              const compHistory = monitor.price_history
                .map((snapshot, idx) => {
                  const record = snapshot.find(r => r.competitor === comp);
                  return record ? { ...record, snapshotIndex: idx } : null;
                })
                .filter(Boolean) as (CompetitorPriceRecord & { snapshotIndex: number })[];

              if (compHistory.length === 0) return null;

              const latest = compHistory[compHistory.length - 1];
              const previous = compHistory.length >= 2 ? compHistory[compHistory.length - 2] : null;

              // Detect change for this competitor
              let priceChange: { direction: 'up' | 'down' | 'same'; percent: number } | null = null;
              if (previous && latest.prices.length > 0 && previous.prices.length > 0) {
                const currVal = parseFloat(latest.prices[0].amount.replace(/[^0-9.]/g, ''));
                const prevVal = parseFloat(previous.prices[0].amount.replace(/[^0-9.]/g, ''));
                if (!isNaN(currVal) && !isNaN(prevVal) && prevVal > 0) {
                  const pct = ((currVal - prevVal) / prevVal) * 100;
                  priceChange = {
                    direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'same',
                    percent: Math.round(Math.abs(pct)),
                  };
                }
              }

              return (
                <div key={comp} className="bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{comp}</span>
                    {priceChange && priceChange.direction !== 'same' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        priceChange.direction === 'up'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {priceChange.direction === 'up' ? '↑' : '↓'} {priceChange.percent}%
                      </span>
                    )}
                  </div>
                  {latest.prices.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {latest.prices.slice(0, 4).map((p, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-zinc-900/50 rounded text-zinc-300">
                          {p.plan ? `${p.plan}: ` : ''}{p.amount}{p.period ? `/${p.period}` : '/мес'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">Цены не найдены</span>
                  )}
                  {latest.pricing_url && (
                    <a
                      href={latest.pricing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
                    >
                      Источник →
                    </a>
                  )}
                  <div className="text-[10px] text-zinc-600 mt-1">
                    Обновлено: {new Date(latest.fetched_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    {' '}| {compHistory.length} проверок
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Snapshot History */}
      {monitor.snapshots.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-white">История проверок</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs text-zinc-500 font-normal px-4 py-2">Дата</th>
                  <th className="text-right text-xs text-zinc-500 font-normal px-4 py-2">Google Trends</th>
                  <th className="text-right text-xs text-zinc-500 font-normal px-4 py-2">Reddit</th>
                  <th className="text-right text-xs text-zinc-500 font-normal px-4 py-2">Конкуренты</th>
                  <th className="text-right text-xs text-zinc-500 font-normal px-4 py-2">Запуски</th>
                  <th className="text-right text-xs text-zinc-500 font-normal px-4 py-2">Цены</th>
                  <th className="text-center text-xs text-zinc-500 font-normal px-4 py-2">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {[...monitor.snapshots].reverse().map((snap, i) => {
                  const prev = monitor.snapshots[monitor.snapshots.length - 2 - i];
                  const gtDelta = prev
                    ? snap.google_trends_value - prev.google_trends_value
                    : 0;
                  const redditDelta = prev
                    ? snap.reddit_mentions - prev.reddit_mentions
                    : 0;

                  return (
                    <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                      <td className="px-4 py-2 text-zinc-300">
                        {new Date(snap.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-white font-medium">{snap.google_trends_value}</span>
                        {gtDelta !== 0 && (
                          <span className={`ml-1 text-xs ${gtDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {gtDelta > 0 ? '+' : ''}{gtDelta}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-white">{snap.reddit_mentions}</span>
                        {redditDelta !== 0 && (
                          <span className={`ml-1 text-xs ${redditDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {redditDelta > 0 ? '+' : ''}{redditDelta}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-400">
                        {snap.new_competitors_found > 0 ? `+${snap.new_competitors_found}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-400">
                        {snap.new_launches > 0 ? `+${snap.new_launches}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-400">
                        {snap.competitor_price_changes?.length > 0
                          ? snap.competitor_price_changes.map((pc, pi) => (
                              <span key={pi} className="text-xs text-yellow-400" title={`${pc.old} → ${pc.new}`}>
                                {pc.name} ⚠️{pi < snap.competitor_price_changes.length - 1 ? ', ' : ''}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs ${
                          snap.sentiment === 'positive' ? 'text-green-400' :
                          snap.sentiment === 'negative' ? 'text-red-400' : 'text-zinc-400'
                        }`}>
                          {snap.sentiment === 'positive' ? '🟢' : snap.sentiment === 'negative' ? '🔴' : '⚪'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source links */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <a href={monitor.sources.google_trends_url} target="_blank" rel="noopener noreferrer"
          className="hover:text-indigo-400 transition-colors">
          Google Trends →
        </a>
        <a href={monitor.sources.reddit_search_url} target="_blank" rel="noopener noreferrer"
          className="hover:text-indigo-400 transition-colors">
          Reddit Search →
        </a>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function DigestItemCard({ item }: { item: DigestItem }) {
  const severityConfig = {
    opportunity: { icon: '🟢', color: 'text-green-400', bg: 'border-green-500/20' },
    warning: { icon: '🟡', color: 'text-yellow-400', bg: 'border-yellow-500/20' },
    info: { icon: '🔵', color: 'text-blue-400', bg: 'border-blue-500/20' },
  };
  const config = severityConfig[item.severity];

  const typeIcons: Record<string, string> = {
    trend_change: '📈',
    new_competitor: '🆕',
    price_change: '💰',
    new_complaints: '💬',
    new_launch: '🚀',
    alert: '⚠️',
  };

  return (
    <div className={`p-3 hover:bg-zinc-800/20 transition-colors border-l-2 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <span className="text-sm mt-0.5">{typeIcons[item.type] || config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${config.color}`}>{item.title}</span>
            {item.delta && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {item.delta}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{item.detail}</p>
          <p className="text-[10px] text-zinc-600 mt-1">{item.evidence}</p>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ snapshots }: { snapshots: TrendSnapshot[] }) {
  if (snapshots.length < 2) return null;

  const values = snapshots.map(s => s.google_trends_value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="space-y-3">
      {/* Google Trends chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Google Trends Interest</p>
        <div className="flex items-end gap-1 h-24">
          {values.map((v, i) => {
            const height = Math.max(8, ((v - min) / range) * 100);
            const isLatest = i === values.length - 1;
            const prev = i > 0 ? values[i - 1] : v;
            const growing = v >= prev;

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all ${
                    isLatest
                      ? 'bg-indigo-500'
                      : growing ? 'bg-green-500/40' : 'bg-red-500/40'
                  }`}
                  style={{ height: `${height}%` }}
                  title={`${new Date(snapshots[i].date).toLocaleDateString('ru-RU')}: ${v}`}
                />
                <span className="text-[9px] text-zinc-600">
                  {new Date(snapshots[i].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-zinc-600">{min}</span>
          <span className="text-[10px] text-zinc-600">{max}</span>
        </div>
      </div>

      {/* Reddit mentions chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Reddit Mentions</p>
        <div className="flex items-end gap-1 h-16">
          {snapshots.map((s, i) => {
            const redditValues = snapshots.map(ss => ss.reddit_mentions);
            const rMax = Math.max(...redditValues) || 1;
            const height = Math.max(8, (s.reddit_mentions / rMax) * 100);
            const isLatest = i === snapshots.length - 1;

            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t ${isLatest ? 'bg-orange-500' : 'bg-orange-500/30'}`}
                  style={{ height: `${height}%` }}
                  title={`Reddit: ${s.reddit_mentions}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}
