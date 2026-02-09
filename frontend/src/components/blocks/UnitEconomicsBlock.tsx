'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import { SourceListItem } from '../SourceCard';

interface UnitEconomicsData {
  cac: {
    keyword_cpc: Array<{
      keyword: string;
      cpc: number;
      currency: string;
      volume: number;
      source_url: string;
    }>;
    estimated_cac: {
      value: number;
      formula?: string;
      confidence: number;
    };
    cpc_data_points: number;
  };
  market_size_indicators: {
    competitors: Array<{
      name: string;
      revenue: {
        value: string | null;
        year: number | null;
        type: 'actual' | 'estimate' | null;
        source: string | null;
        source_url: string | null;
        fiscal_year_end?: string;
      };
      employees: {
        count: number | null;
        source: 'LinkedIn' | 'Crunchbase' | null;
        source_url: string | null;
        revenue_estimate?: string;
      };
      pricing: {
        range: string | null;
        typical_price: string | null;
        source_url: string | null;
      };
      estimated_customers: {
        range: string;
        calculation: string;
        confidence: 'low' | 'medium' | 'high';
      } | null;
      funding: {
        total: string;
        last_round: string;
        source_url: string;
      } | null;
    }>;
    total_market_revenue: string | null;
    total_estimated_customers: string | null;
    largest_player: string | null;
    data_quality: 'high' | 'medium' | 'low';
    sources_count: number;
  };
  ltv_cac_ratio: {
    value: number;
    formula?: string;
    confidence: number;
  };
  repeat_sales: {
    business_model: string;
    signals: {
      subscription: number;
      one_time: number;
      freemium: number;
      marketplace: number;
    };
    evidence: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
  scalability: {
    market_size_signals: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    trend_growth: number;
    scalability_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
}

interface Props {
  data: UnitEconomicsData | null;
  loading?: boolean;
  error?: string;
}

export default function UnitEconomicsBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-20 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-zinc-400 text-sm">Нажмите &quot;Анализировать&quot; для запуска</div>;

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const ltvCacColor = data.ltv_cac_ratio.value >= 7 ? 'text-green-400' :
    data.ltv_cac_ratio.value >= 4 ? 'text-yellow-400' :
    data.ltv_cac_ratio.value > 0 ? 'text-red-400' : 'text-zinc-400';

  const modelLabels: Record<string, string> = {
    subscription: 'Подписка',
    'one-time': 'Разовая покупка',
    freemium: 'Freemium',
    marketplace: 'Маркетплейс',
    unknown: 'Не определена',
  };

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Экономика"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-lg font-bold">
            {data.cac.estimated_cac.value > 0 ? `$${data.cac.estimated_cac.value}` : '—'}
          </div>
          <div className="text-xs text-zinc-400">CAC</div>
          <EvidenceBadge type={data.cac.cpc_data_points > 0 ? 'calculated' : 'no_data'} className="mt-1" />
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-lg font-bold">
            {data.market_size_indicators.total_market_revenue || '—'}
          </div>
          <div className="text-xs text-zinc-400">Размер рынка</div>
          <EvidenceBadge type={data.market_size_indicators.sources_count > 0 ? data.market_size_indicators.data_quality === 'high' ? 'real_data' : 'calculated' : 'no_data'} className="mt-1" />
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className={`text-lg font-bold ${ltvCacColor}`}>
            {data.ltv_cac_ratio.value > 0 ? `${data.ltv_cac_ratio.value}/10` : '—'}
          </div>
          <div className="text-xs text-zinc-400">LTV/CAC</div>
          <EvidenceBadge type={data.ltv_cac_ratio.value > 0 ? 'calculated' : 'no_data'} className="mt-1" />
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-sm font-bold">{modelLabels[data.repeat_sales.business_model] || data.repeat_sales.business_model}</div>
          <div className="text-xs text-zinc-400">Модель</div>
          <EvidenceBadge type="calculated" className="mt-1" />
        </div>
      </div>

      {/* Section: CAC */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('cac')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">CAC (стоимость привлечения)</span>
            <EvidenceBadge type={data.cac.cpc_data_points > 0 ? 'calculated' : 'no_data'} />
          </div>
          <span className="text-zinc-500">{expandedSection === 'cac' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'cac' && (
          <div className="px-3 pb-3 space-y-2">
            {data.cac.estimated_cac.value > 0 && (
              <ScoreDisplay
                value={data.cac.estimated_cac.value}
                maxValue={1000}
                label={`Estimated CAC: $${data.cac.estimated_cac.value}`}
                formula={data.cac.estimated_cac.formula}
                confidence={data.cac.estimated_cac.confidence}
              />
            )}
            {data.cac.keyword_cpc.length > 0 ? (
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-700">
                    <th className="text-left py-1">Keyword</th>
                    <th className="text-right py-1">CPC</th>
                    <th className="text-right py-1">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cac.keyword_cpc.map((kw, i) => (
                    <tr key={i} className="border-b border-zinc-700">
                      <td className="py-1">
                        <a href={kw.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                          {kw.keyword}
                        </a>
                      </td>
                      <td className="text-right py-1 font-medium">${kw.cpc.toFixed(2)}</td>
                      <td className="text-right py-1 text-zinc-400">{kw.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-400">Данные CPC не найдены</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Market Size Indicators (REPLACES LTV!) */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('market-size')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Market Size Indicators</span>
            <EvidenceBadge type={data.market_size_indicators.sources_count > 0 ? 'real_data' : 'no_data'} />
          </div>
          <span className="text-zinc-500">{expandedSection === 'market-size' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'market-size' && (
          <div className="px-3 pb-3 space-y-4">
            {/* Summary */}
            {data.market_size_indicators.total_market_revenue && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-sm text-zinc-400 mb-1">Размер рынка</div>
                  <div className="text-xl font-bold text-emerald-400">{data.market_size_indicators.total_market_revenue}</div>
                </div>
                {data.market_size_indicators.total_estimated_customers && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <div className="text-sm text-zinc-400 mb-1">Всего клиентов</div>
                    <div className="text-xl font-bold text-white">{data.market_size_indicators.total_estimated_customers}</div>
                  </div>
                )}
                {data.market_size_indicators.largest_player && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <div className="text-sm text-zinc-400 mb-1">Крупнейший игрок</div>
                    <div className="text-sm font-bold text-indigo-400">{data.market_size_indicators.largest_player}</div>
                  </div>
                )}
              </div>
            )}

            {/* Competitors */}
            {data.market_size_indicators.competitors.length > 0 ? (
              <div className="space-y-3">
                {data.market_size_indicators.competitors.map((comp, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                    <h4 className="text-sm font-semibold text-white mb-3">{comp.name}</h4>

                    {/* Revenue */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-400">Revenue:</span>
                        {comp.revenue.value ? (
                          <>
                            <span className="text-sm text-white font-medium">{comp.revenue.value}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              comp.revenue.type === 'actual'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {comp.revenue.type}
                            </span>
                            {comp.revenue.year && (
                              <span className="text-xs text-zinc-500">({comp.revenue.year})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-zinc-500">Not disclosed</span>
                        )}
                      </div>
                      {comp.revenue.source && comp.revenue.source_url && (
                        <a
                          href={comp.revenue.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          📄 {comp.revenue.source}
                        </a>
                      )}
                    </div>

                    {/* Employees */}
                    {comp.employees.count && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-zinc-400">Employees:</span>
                          <span className="text-sm text-white">{comp.employees.count.toLocaleString()}</span>
                          {comp.employees.source_url && (
                            <a
                              href={comp.employees.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              ({comp.employees.source})
                            </a>
                          )}
                        </div>
                        {comp.employees.revenue_estimate && !comp.revenue.value && (
                          <div className="text-xs text-zinc-500">
                            💡 Est. revenue: {comp.employees.revenue_estimate} (based on headcount)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Estimated Customers */}
                    {comp.estimated_customers && (
                      <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-zinc-400">Est. Customers:</span>
                          <span className="text-sm text-white font-medium">{comp.estimated_customers.range}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            comp.estimated_customers.confidence === 'high'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {comp.estimated_customers.confidence}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          💡 {comp.estimated_customers.calculation}
                        </div>
                      </div>
                    )}

                    {/* Pricing */}
                    {comp.pricing.typical_price && (
                      <div className="mt-2">
                        <span className="text-xs text-zinc-400">Pricing: </span>
                        <span className="text-sm text-white">{comp.pricing.typical_price}</span>
                        {comp.pricing.range && (
                          <span className="text-xs text-zinc-500"> ({comp.pricing.range})</span>
                        )}
                      </div>
                    )}

                    {/* Funding */}
                    {comp.funding && (
                      <div className="mt-2">
                        <span className="text-xs text-zinc-400">Funding: </span>
                        <span className="text-sm text-emerald-400">{comp.funding.total}</span>
                        <span className="text-xs text-zinc-500"> ({comp.funding.last_round})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Данные о размере рынка не найдены</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Scalability */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('scale')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Масштабируемость</span>
            <EvidenceBadge type="calculated" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'scale' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'scale' && (
          <div className="px-3 pb-3 space-y-2">
            <ScoreDisplay
              value={data.scalability.scalability_score.value}
              label="Потенциал масштабирования"
              formula={data.scalability.scalability_score.formula}
              confidence={data.scalability.scalability_score.confidence}
            />
            <div className="bg-zinc-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold">{data.scalability.trend_growth}%</div>
              <div className="text-xs text-zinc-400">Рост тренда</div>
            </div>
            {data.scalability.market_size_signals.length > 0 && (
              <div className="mt-2">
                <h4 className="text-xs font-medium text-zinc-400 mb-1">Сигналы размера рынка</h4>
                {(showAllSignals
                  ? data.scalability.market_size_signals
                  : data.scalability.market_size_signals.slice(0, 3)
                ).map((s, i) => (
                  <SourceListItem key={i} title={s.title} url={s.url} source="google_search" />
                ))}
                {data.scalability.market_size_signals.length > 3 && (
                  <button
                    onClick={() => setShowAllSignals(!showAllSignals)}
                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllSignals ? 'Свернуть' : `Показать ещё ${data.scalability.market_size_signals.length - 3}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
