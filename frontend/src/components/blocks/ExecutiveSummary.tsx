'use client';

import React, { useRef } from 'react';

/* ─── Types (mirrors ActionPlanBlock) ─── */

interface ActionPlanData {
  query: string;
  overall_readiness: {
    score: number;
    assessment: 'go' | 'no_go' | 'pivot' | 'more_data';
    confidence: number;
    blocks_analyzed: number;
    block_scores: Record<string, number>;
    block_confidences: Record<string, number>;
  };
  executive_summary: {
    text: string;
    sources_cited: number;
  } | null;
  priority_actions: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reasoning: string;
    evidence_source: string;
  }>;
  unit_economics: {
    estimated_cac: number | null;
    ltv_cac_score: number | null;
    ltv_cac_formula: string | null;
    business_model: string | null;
    median_price: number | null;
    scalability_score: number | null;
    market_revenue: string | null;
    market_customers: number | null;
  };
  target_customer: {
    segment: string | null;
    segment_confidence: number;
    price_sensitivity: string;
    sales_complexity: string | null;
    top_complaints: Array<{ text: string; source: string; engagement: number }>;
  };
  competitive_landscape: {
    competitor_count: number;
    blue_ocean_score: number | null;
    saturation: number | null;
    top_competitors: Array<{ text: string }>;
    key_weaknesses: Array<{ text: string }>;
    unmet_needs: Array<{ text: string }>;
  };
  next_steps: Array<{
    step: string;
    category: 'research' | 'build' | 'validate' | 'grow';
  }>;
  generated_at: string;
}

interface Props {
  data: ActionPlanData | null;
  trendTitle: string;
  evidenceData: Record<string, any>;
}

const assessmentLabel: Record<string, { text: string; emoji: string }> = {
  go: { text: 'GO — Запускать', emoji: '🟢' },
  no_go: { text: 'NO GO — Не запускать', emoji: '🔴' },
  pivot: { text: 'PIVOT — Требуется поворот', emoji: '🟡' },
  more_data: { text: 'Нужно больше данных', emoji: '⚪' },
};

export default function ExecutiveSummary({ data, trendTitle, evidenceData }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!data) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-zinc-400">Сначала сгенерируйте план действий на вкладке «Стратегия».</p>
      </div>
    );
  }

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=1100');
    if (!printWindow) return;

    printWindow.document.write(`
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Executive Summary — ${trendTitle}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.45; padding: 0; }
  .page { max-width: 100%; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 6px; border-bottom: 1.5px solid #e0e0e0; padding-bottom: 3px; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #222; }
  .verdict { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 13px; }
  .verdict-go { background: #dcfce7; color: #166534; }
  .verdict-no_go { background: #fecaca; color: #991b1b; }
  .verdict-pivot { background: #fef3c7; color: #92400e; }
  .verdict-more_data { background: #f3f4f6; color: #374151; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .card-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }
  .card-value { font-size: 16px; font-weight: 700; margin-top: 1px; }
  .score-bar { height: 5px; background: #e5e7eb; border-radius: 3px; margin-top: 4px; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; }
  .green { color: #16a34a; } .green-bg { background: #16a34a; }
  .yellow { color: #ca8a04; } .yellow-bg { background: #ca8a04; }
  .red { color: #dc2626; } .red-bg { background: #dc2626; }
  .gray { color: #6b7280; }
  .section { margin-bottom: 14px; }
  .action-item { display: flex; gap: 6px; margin-bottom: 4px; align-items: flex-start; }
  .action-badge { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
  .badge-high { background: #dc2626; }
  .badge-medium { background: #ca8a04; }
  .badge-low { background: #16a34a; }
  .summary-text { font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 10px; }
  .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
  .metric-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e5e7eb; }
  .metric-label { color: #555; }
  .metric-value { font-weight: 600; }
  ul { padding-left: 14px; } li { margin-bottom: 2px; }
  .competitors-list { font-size: 10px; color: #555; }
</style>
</head><body>
${printContent.innerHTML}
</body></html>`);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const readiness = data.overall_readiness;
  const assessment = assessmentLabel[readiness.assessment] || assessmentLabel.more_data;
  const blocks = readiness.block_scores || {};
  const blockLabels: Record<string, string> = {
    problem: 'Проблема', demand: 'Спрос', sellability: 'Продажи',
    occupation: 'Конкуренция', economics: 'Экономика',
  };

  const scoreColor = (v: number) => v >= 7 ? 'green' : v >= 4 ? 'yellow' : 'red';

  // Extract key data
  const economics = data.unit_economics;
  const landscape = data.competitive_landscape;
  const customer = data.target_customer;
  const topActions = data.priority_actions.slice(0, 5);
  const topSteps = data.next_steps.slice(0, 5);

  // Trend growth from evidence
  const trendGrowth = evidenceData.demand?.google_trends?.growth_12m;
  const trendsVolume = evidenceData.demand?.google_trends?.current_value;

  const dateStr = new Date(data.generated_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Print button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Executive Summary</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Одностраничный отчёт для принятия решения. Все данные — из Evidence.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>🖨️</span>
          Скачать PDF
        </button>
      </div>

      {/* Preview (dark theme) */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 overflow-hidden">
        <div className="bg-white rounded-lg p-6 text-black text-xs leading-relaxed max-w-[210mm] mx-auto shadow-lg" style={{ minHeight: '280mm' }}>
          {/* This is the printable content */}
          <div ref={reportRef}>
            <div className="page">
              {/* Header */}
              <div className="header">
                <div>
                  <h1>{trendTitle}</h1>
                  <div className="subtitle">Executive Summary | {dateStr} | TrendHunter AI</div>
                </div>
                <div className={`verdict verdict-${readiness.assessment}`}>
                  {assessment.emoji} {assessment.text}
                </div>
              </div>

              {/* Score cards row */}
              <div className="grid3">
                <div className="card">
                  <div className="card-label">Готовность</div>
                  <div className={`card-value ${scoreColor(readiness.score)}`}>
                    {readiness.score}/10
                  </div>
                  <div className="score-bar">
                    <div className={`score-fill ${scoreColor(readiness.score)}-bg`} style={{ width: `${readiness.score * 10}%` }} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-label">Уверенность</div>
                  <div className={`card-value ${readiness.confidence >= 60 ? 'green' : readiness.confidence >= 40 ? 'yellow' : 'red'}`}>
                    {readiness.confidence}%
                  </div>
                  <div className="score-bar">
                    <div className={`score-fill ${readiness.confidence >= 60 ? 'green' : readiness.confidence >= 40 ? 'yellow' : 'red'}-bg`} style={{ width: `${readiness.confidence}%` }} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-label">Блоков проанализировано</div>
                  <div className="card-value">{readiness.blocks_analyzed}/5</div>
                  <div className="score-bar">
                    <div className="score-fill green-bg" style={{ width: `${readiness.blocks_analyzed * 20}%` }} />
                  </div>
                </div>
              </div>

              {/* Executive summary text */}
              {data.executive_summary && (
                <div className="section">
                  <h2>Резюме</h2>
                  <div className="summary-text">{data.executive_summary.text}</div>
                </div>
              )}

              {/* Two-column layout */}
              <div className="grid2">
                {/* Left: Block Scores + Economics */}
                <div>
                  <div className="section">
                    <h2>Оценки по блокам</h2>
                    {Object.entries(blocks).map(([key, score]) => (
                      <div className="metric-row" key={key}>
                        <span className="metric-label">{blockLabels[key] || key}</span>
                        <span className={`metric-value ${scoreColor(score as number)}`}>{score as number}/10</span>
                      </div>
                    ))}
                    {trendGrowth !== undefined && (
                      <div className="metric-row">
                        <span className="metric-label">Рост тренда (12 мес)</span>
                        <span className={`metric-value ${trendGrowth > 0 ? 'green' : 'red'}`}>
                          {trendGrowth > 0 ? '+' : ''}{trendGrowth}%
                        </span>
                      </div>
                    )}
                    {trendsVolume !== undefined && (
                      <div className="metric-row">
                        <span className="metric-label">Объём поиска (Google)</span>
                        <span className="metric-value">{trendsVolume}/100</span>
                      </div>
                    )}
                  </div>

                  <div className="section">
                    <h2>Unit-экономика</h2>
                    {economics.median_price != null && (
                      <div className="metric-row">
                        <span className="metric-label">Средний чек</span>
                        <span className="metric-value">${economics.median_price}/мес</span>
                      </div>
                    )}
                    {economics.estimated_cac != null && (
                      <div className="metric-row">
                        <span className="metric-label">CAC (оценка)</span>
                        <span className="metric-value">${economics.estimated_cac}</span>
                      </div>
                    )}
                    {economics.ltv_cac_score != null && (
                      <div className="metric-row">
                        <span className="metric-label">LTV/CAC Score</span>
                        <span className={`metric-value ${economics.ltv_cac_score >= 7 ? 'green' : economics.ltv_cac_score >= 4 ? 'yellow' : 'red'}`}>
                          {economics.ltv_cac_score}/10
                        </span>
                      </div>
                    )}
                    {economics.scalability_score != null && (
                      <div className="metric-row">
                        <span className="metric-label">Масштабируемость</span>
                        <span className={`metric-value ${economics.scalability_score >= 7 ? 'green' : economics.scalability_score >= 4 ? 'yellow' : 'red'}`}>
                          {economics.scalability_score}/10
                        </span>
                      </div>
                    )}
                    {economics.business_model && (
                      <div className="metric-row">
                        <span className="metric-label">Бизнес-модель</span>
                        <span className="metric-value">{economics.business_model}</span>
                      </div>
                    )}
                    {economics.market_revenue && (
                      <div className="metric-row">
                        <span className="metric-label">Выручка рынка</span>
                        <span className="metric-value">{economics.market_revenue}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Competition + Target Customer */}
                <div>
                  <div className="section">
                    <h2>Конкурентная среда</h2>
                    <div className="metric-row">
                      <span className="metric-label">Конкурентов найдено</span>
                      <span className="metric-value">{landscape.competitor_count}</span>
                    </div>
                    {landscape.blue_ocean_score != null && (
                      <div className="metric-row">
                        <span className="metric-label">Blue Ocean Score</span>
                        <span className={`metric-value ${scoreColor(landscape.blue_ocean_score)}`}>
                          {landscape.blue_ocean_score}/10
                        </span>
                      </div>
                    )}
                    {landscape.top_competitors.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <div className="card-label">Ключевые игроки:</div>
                        <div className="competitors-list">
                          {landscape.top_competitors.slice(0, 4).map((c, i) => (
                            <div key={i}>• {c.text}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {landscape.key_weaknesses.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <div className="card-label">Слабости конкурентов:</div>
                        <div className="competitors-list">
                          {landscape.key_weaknesses.slice(0, 3).map((w, i) => (
                            <div key={i}>• {w.text}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="section">
                    <h2>Целевой клиент</h2>
                    {customer.segment && (
                      <div className="metric-row">
                        <span className="metric-label">Сегмент</span>
                        <span className="metric-value">{customer.segment}</span>
                      </div>
                    )}
                    <div className="metric-row">
                      <span className="metric-label">Ценовая чувств.</span>
                      <span className="metric-value">{customer.price_sensitivity}</span>
                    </div>
                    {customer.sales_complexity && (
                      <div className="metric-row">
                        <span className="metric-label">Сложность продажи</span>
                        <span className="metric-value">{customer.sales_complexity}</span>
                      </div>
                    )}
                    {customer.top_complaints.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <div className="card-label">Топ жалоб клиентов:</div>
                        <div className="competitors-list">
                          {customer.top_complaints.slice(0, 3).map((c, i) => (
                            <div key={i}>• {c.text.length > 80 ? c.text.substring(0, 80) + '...' : c.text} <span style={{ color: '#999' }}>({c.source})</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority actions */}
              <div className="section">
                <h2>Приоритетные действия</h2>
                {topActions.map((a, i) => (
                  <div className="action-item" key={i}>
                    <div className={`action-badge badge-${a.priority}`} />
                    <div>
                      <strong>{a.action}</strong>
                      <span className="gray"> — {a.reasoning.length > 80 ? a.reasoning.substring(0, 80) + '...' : a.reasoning}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next steps */}
              {topSteps.length > 0 && (
                <div className="section">
                  <h2>Следующие шаги</h2>
                  <ul>
                    {topSteps.map((s, i) => (
                      <li key={i}>{s.step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unmet needs */}
              {landscape.unmet_needs.length > 0 && (
                <div className="section">
                  <h2>Незакрытые потребности рынка</h2>
                  <ul>
                    {landscape.unmet_needs.slice(0, 4).map((n, i) => (
                      <li key={i}>{n.text}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="footer">
                <span>TrendHunter AI — Evidence-Based Niche Analysis</span>
                <span>Сгенерировано: {dateStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
