// Адаптеры: трансформация данных новых API роутов → формат старых UI компонентов
// Новые роуты возвращают { public, premium } с layer1/layer2/layer3
// Страница делает combined = { ...data.public, ...data.premium }
// Адаптеры маппят combined → формат старых UI компонентов

function diagnosisToConfidence(d: string): number {
  if (d === 'green') return 0.8;
  if (d === 'yellow') return 0.6;
  return 0.4;
}

function diagnosisToLabel(d: string): string {
  if (d === 'green') return '🟢 Рынок созрел';
  if (d === 'yellow') return '🟡 Требует внимания';
  return '🔴 Высокий риск';
}

function growthRateToNumber(gr: string): number {
  if (gr === 'growing') return 8;
  if (gr === 'stable') return 5;
  return 2;
}

// ─── Block 1: Problem (NEW — pain_clusters + paying_signals + competitor_mentions) ──
// combined = { layer1, distribution, diagnosis, score, key_metric,
//              top_quotes, paying_signals, competitor_mentions,
//              pain_clusters_preview, layer3, key_factors, block_context }
export function adaptProblemData(raw: any): any {
  const totalComplaints = raw.layer1?.validated_complaints || raw.layer1?.total_complaints || 0;
  const weightedScore = raw.layer1?.weighted_complaints_score || 0;
  const bySource = raw.layer1?.by_source || {};
  const score = raw.score ?? 5;
  const conf = diagnosisToConfidence(raw.diagnosis);
  const distribution = raw.distribution || {};

  // ── "У кого болит" — pain_clusters_preview (кластеры, не отдельные посты) ──
  const clusters = (raw.pain_clusters_preview || []).map((c: any) => ({
    pain_summary: c.pain_summary || '',
    source_count: c.source_count || 0,
    mention_count: c.mention_count || 0,
    confidence: c.confidence || 'low',
    category: c.category || 'bad_solution',
  }));

  // Fallback: если кластеров нет — используем top_quotes
  const complaints: any[] = [];
  if (clusters.length > 0) {
    for (const c of clusters) {
      complaints.push({
        text: c.pain_summary,
        source: `${c.source_count} источников`,
        source_url: '#',
        engagement: c.mention_count,
        data_type: 'real_data',
        pain_category: c.category,
        confidence: c.confidence,
      });
    }
  } else if (raw.top_quotes) {
    for (const [category, quotes] of Object.entries(raw.top_quotes)) {
      if (Array.isArray(quotes)) {
        for (const q of quotes as any[]) {
          complaints.push({
            text: q.text || '',
            source: q.source || 'unknown',
            source_url: q.link || '#',
            engagement: q.upvotes || 0,
            data_type: 'real_data',
            pain_category: category,
          });
        }
      }
    }
  }

  // "Как часто" — все источники из by_source + sources_attempted
  // Показываем ВСЕ опрошенные источники, даже если 0 валидных постов
  const sourcesAttempted: string[] = raw.block_context?.data_quality?.sources_attempted || [];
  const sourceMap = new Map<string, number>();
  // Сначала заполняем из attempted (все источники, включая с 0)
  for (const s of sourcesAttempted) {
    sourceMap.set(s, 0);
  }
  // Затем перезаписываем реальными данными
  for (const [name, count] of Object.entries(bySource)) {
    sourceMap.set(name, count as number);
  }
  const sourceEntries = Array.from(sourceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── "Текущие решения" — paying_signals (НЕ дубликат top_quotes!) ──
  const payingSignals = (raw.paying_signals || []).map((p: any) => ({
    title: p.mentioned_product
      ? `[${p.mentioned_product}] ${p.text}`
      : p.text || '',
    url: p.link || '#',
    snippet: `${p.paying_confidence === 'high' ? '✓ Подтверждён' : '~ Вероятен'} платящий пользователь`,
    source: p.source || 'unknown',
    rating: null,
  }));

  // ── Competitor mentions ──
  const competitorMentions = (raw.competitor_mentions || []).map((c: any) => ({
    competitor: c.competitor || '',
    mention_count: c.mention_count || 0,
    sentiment: c.sentiment || 'neutral',
  }));

  // "Готовность платить" — из layer3 paying data
  const payingRatio = raw.layer3?.paying_ratio || 0;
  const payingScore = raw.layer3?.paying_score || 0;
  const context = raw.layer3?.context || 'mixed';
  const paidCount = payingSignals.length;

  // ── Человекочитаемый вердикт ──
  const dominantPain = (Object.entries(distribution) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const dominantLabel = dominantPain
    ? { bad_solution: 'плохую реализацию', no_solution: 'отсутствие решений', expensive_solution: 'высокие цены' }[dominantPain[0]] || dominantPain[0]
    : '';
  const dominantPct = dominantPain ? dominantPain[1] : 0;

  let verdictText = '';
  if (raw.diagnosis === 'green' && dominantPain) {
    verdictText = `${dominantPct}% жалующихся указывают на ${dominantLabel}. Рынок готов к альтернативе.`;
  } else if (raw.diagnosis === 'yellow' && dominantPain?.[0] === 'no_solution') {
    verdictText = `${dominantPct}% ищут решение которого не существует. Нужно educate the market — это длинный путь.`;
  } else if (raw.diagnosis === 'red') {
    verdictText = `Слабый сигнал боли. Рынок либо угасает, либо проблема не критична для пользователей.`;
  } else if (dominantPain) {
    verdictText = `${dominantPct}% жалуются на ${dominantLabel}. Сигнал есть, но требует дополнительной валидации.`;
  }

  return {
    who_hurts: {
      complaints,
      total_complaints: totalComplaints,
      sources_count: Object.keys(bySource).length,
      severity_score: {
        value: score,
        formula: raw.key_metric || '',
        confidence: conf,
      },
      pain_clusters: clusters,
      weighted_score: weightedScore,
    },
    how_often: {
      google_trends: null,
      all_sources: sourceEntries,
      reddit_post_count: bySource.reddit || 0,
      so_question_count: bySource.stackoverflow || 0,
      frequency_score: {
        value: Math.min(10, totalComplaints / 10),
        formula: `${totalComplaints} валидных из ${raw.layer1?.total_complaints || '?'} собранных`,
        confidence: conf,
      },
      dynamics: raw.layer1?.dynamics || 'stable',
      dynamics_ratio: raw.layer1?.dynamics_ratio || 1.0,
      pain_is_chronic: raw.layer1?.pain_is_chronic || false,
    },
    current_solutions: {
      reviews: payingSignals,
      total_reviews: payingSignals.length,
      pain_distribution: distribution,
      competitor_mentions: competitorMentions,
    },
    willingness_to_pay: {
      pricing_data: [],
      paid_solution_count: paidCount,
      paying_score: payingScore,
      paying_ratio: payingRatio,
      context,
    },
    verdict: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
      label: diagnosisToLabel(raw.diagnosis),
      verdict_text: verdictText,
    },
    ai_summary: raw.key_factors?.length
      ? { text: raw.key_factors.join('. '), data_type: 'ai_synthesis' }
      : null,
    _raw_diagnosis: raw.diagnosis,
    _block_context: raw.block_context,
    _distribution: distribution,
    _competitive_positives: (raw.block_context?.competitive_positives || []) as Array<{ product: string; text: string; source: string }>,
  };
}

// ─── Block 2: Demand ───────────────────────────────────────
// combined = { layer1 (partial), commercial_intent_ratio, diagnosis, score, key_metric,
//              layer2, layer3, competitors_found, key_factors, block_context,
//              top_keywords, rising_keywords }
export function adaptDemandData(raw: any): any {
  const layer1 = raw.layer1 || {};
  const layer2 = raw.layer2 || {};
  const layer3 = raw.layer3 || {};
  const score = raw.score ?? 5;
  const conf = diagnosisToConfidence(raw.diagnosis);
  const growthNum = growthRateToNumber(layer1.growth_rate || 'stable');

  // Формируем top keywords для отображения
  const topKeywords = (raw.top_keywords || []).slice(0, 10).map((k: any) => ({
    query: k.query,
    intent: k.intent,
    volume: k.volume,
  }));

  // Реальные данные из timeline (не хардкоды!)
  const demandIndex = layer1.demand_index || 0;
  const growthRate = layer1.growth_rate || 'stable';

  // Timeline данные из raw_data (пробрасываются из route.ts)
  const timeline5y: Array<{ date: string; value: number }> = raw.timeline_5y || [];
  const timeline3m: Array<{ date: string; value: number }> = raw.timeline_3m || [];

  // Реальный % роста из timeline точек
  const growth5y = raw.growth_5y ?? null;
  const growth3m = raw.growth_3m ?? null;

  // Google Trends URL для данной ниши
  const keywordForUrl = raw.block_context?.competitors_found?.[0]?.query
    || (raw.top_keywords?.[0]?.query) || '';

  const trendsUrl = keywordForUrl
    ? `https://trends.google.com/trends/explore?q=${encodeURIComponent(keywordForUrl)}`
    : '';

  // Берём последние 52 точки из 5y timeline (≈12 месяцев) для sparkline
  const timeline12m = timeline5y.length > 52
    ? timeline5y.slice(-52)
    : timeline5y;

  const trends12m = demandIndex > 0 ? {
    growth_rate: growth5y,
    search_query: keywordForUrl,
    original_query: keywordForUrl,
    google_trends_url: trendsUrl,
    interest_timeline: timeline12m,
  } : null;

  const trends3m = demandIndex > 0 ? {
    growth_rate: growth3m,
    search_query: keywordForUrl,
    original_query: keywordForUrl,
    google_trends_url: trendsUrl,
  } : null;

  // "Новые игроки" — конкуренты из SERP (платные и органические)
  const competitors = raw.competitors_found || [];

  // Коммерческий/информационный расчёт
  const commercialRatio = layer2.commercial_intent_ratio || raw.commercial_intent_ratio || 0;
  const informationalRatio = layer2.informational_intent_ratio || (1 - commercialRatio);
  const totalKeywordsCount = layer1.keyword_count || (raw.top_keywords?.length || 0) + (raw.rising_keywords?.length || 0);
  const commercialCount = Math.round(commercialRatio * totalKeywordsCount);
  const informationalCount = totalKeywordsCount - commercialCount;

  return {
    growing_or_dying: {
      trends_12m: trends12m,
      trends_3m: trends3m,
      growth_comparison: {
        value: growthNum,
        formula: raw.key_metric || `Demand index: ${demandIndex}`,
        confidence: conf,
      },
      growth_rate: growthRate,
      demand_index: demandIndex,
      error: null,
    },
    hype_or_stable: {
      stability_score: {
        value: layer3.has_momentum ? 7 : 4,
        formula: layer3.has_momentum ? 'Есть моментум роста' : 'Стабильный спрос',
        confidence: conf,
      },
      std_deviation: Math.round((layer3.rising_queries_ratio || 0) * 100),
      timeline_points: totalKeywordsCount,
      rising_queries_ratio: layer3.rising_queries_ratio || 0,
    },
    new_players: {
      new_entrants_count: competitors.length,
      competitors_found: competitors.slice(0, 10).map((c: any) => ({
        name: c.name || c.domain,
        domain: c.domain,
        source: c.source,
        query: c.query,
        position: c.position,
      })),
    },
    search_intent: {
      commercial_percent: Math.round(commercialRatio * 100),
      informational_percent: Math.round(informationalRatio * 100),
      commercial_signals: commercialCount,
      informational_signals: informationalCount,
      total_signals: totalKeywordsCount,
      intent_type: commercialRatio > 0.6 ? 'commercial' : commercialRatio < 0.4 ? 'informational' : 'mixed',
      top_keywords: topKeywords,
    },
    geo_breakdown: (raw.geo_breakdown || []).map((g: any) => ({
      region: g.region,
      label: g.label,
      value: g.value,
    })),
    seasonality: raw.seasonality || null,
    buying_stage: raw.buying_stage || null,
    competitor_trends: (raw.competitor_trends || []).map((ct: any) => ({
      name: ct.name,
      domain: ct.domain,
      growth: ct.growth,
      direction: ct.direction,
    })),
    verdict: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
      label: diagnosisToLabel(raw.diagnosis),
    },
    _raw_diagnosis: raw.diagnosis,
    _block_context: raw.block_context,
  };
}

// ─── Block 3: Sellability ──────────────────────────────────
// combined = { diagnosis, score, key_metric, path_to_first_payment, sale_cycle,
//              price_range, payment_model, psychological_threshold, has_trial_period,
//              sale_cycle_days, budget_category_exists, primary_channel,
//              secondary_channels, traffic_interception_points,
//              key_factors, block_context, layers }
export function adaptSellabilityData(raw: any): any {
  const score = raw.score ?? 5;
  const conf = diagnosisToConfidence(raw.diagnosis);
  const priceRange = raw.price_range || {};
  const layers = raw.layers || {};

  // Build competitor_prices from price_range
  const competitorPrices: any[] = [];
  if (priceRange.sources?.length) {
    for (const src of priceRange.sources) {
      competitorPrices.push({
        competitor: typeof src === 'string' ? src : src.domain || src.name || 'Unknown',
        price: priceRange.median ? `$${priceRange.median}` : 'N/A',
        url: '#',
        plan_type: raw.payment_model || 'subscription',
      });
    }
  } else if (priceRange.median) {
    competitorPrices.push({
      competitor: 'Market average',
      price: `$${priceRange.median}`,
      url: '#',
      plan_type: raw.payment_model || 'subscription',
    });
  }

  const saleCycleMap: Record<string, string> = {
    minutes: 'Быстрая (минуты)',
    days: 'Короткая (дни)',
    weeks: 'Средняя (недели)',
    months: 'Длинная (месяцы)',
  };

  // buyer_discussions: каналы и communities (верхний список)
  // buyer_profiles: точки перехвата трафика (нижний список)
  const buyerDiscussions: any[] = [];
  const buyerProfilesList: any[] = [];

  // primary_channel может быть строкой ИЛИ объектом {channel, reasoning}
  const primaryChannelName = typeof raw.primary_channel === 'string'
    ? raw.primary_channel
    : raw.primary_channel?.channel || null;

  if (primaryChannelName) {
    const reasoning = typeof raw.primary_channel === 'object' ? raw.primary_channel?.reasoning : '';
    buyerDiscussions.push({
      text: `Основной канал: ${primaryChannelName}`,
      source: reasoning || 'AI анализ',
      data_type: 'ai_synthesis',
    });
  }
  if (raw.secondary_channels?.length) {
    buyerDiscussions.push({
      text: `Дополнительные каналы: ${raw.secondary_channels.join(', ')}`,
      source: 'AI анализ',
      data_type: 'ai_synthesis',
    });
  }

  // Communities из layers — реальные данные с URL
  const allCommunities = [
    ...(layers.layer3?.communities_via_competitors || []),
    ...(layers.layer3?.communities_via_keywords || []),
  ];
  for (const comm of allCommunities.slice(0, 5)) {
    buyerDiscussions.push({
      text: `${comm.community_name} (${comm.channel_type}, ${comm.member_count?.toLocaleString() || '?'} участников)`,
      source: comm.competitor_domain || comm.channel_type,
      source_url: comm.url || '#',
      data_type: 'real_data',
    });
  }

  // Traffic interception points → buyer_profiles
  if (raw.traffic_interception_points?.length) {
    for (const point of raw.traffic_interception_points.slice(0, 5)) {
      if (typeof point === 'string') {
        buyerProfilesList.push({ text: point, source: 'AI анализ', data_type: 'ai_synthesis' });
      } else {
        const typeLabels: Record<string, string> = {
          problem_search: 'Поиск проблемы',
          alternative_search: 'Поиск альтернативы',
          comparison_search: 'Сравнение',
          education: 'Обучение',
          community: 'Сообщество',
        };
        const label = typeLabels[point.type] || point.type;
        const tactics = Array.isArray(point.tactics) ? point.tactics.join(', ') : '';
        buyerProfilesList.push({
          text: `${label}: "${point.keyword}"${tactics ? ` — ${tactics}` : ''} (${point.difficulty})`,
          source: 'Traffic analysis',
          data_type: 'ai_synthesis',
        });
      }
    }
  }

  // Communities — структурированные данные с URL
  const communities = allCommunities.slice(0, 5).map((comm: any) => ({
    name: comm.community_name || '',
    channel_type: comm.channel_type || 'subreddit',
    url: comm.url || '#',
    member_count: comm.member_count || 0,
    mentioned_frequency: comm.mentioned_frequency || 0,
    competitor_domain: comm.competitor_domain || null,
  }));

  // Traffic interception points — структурированные
  const trafficPoints = (raw.traffic_interception_points || []).slice(0, 5).map((p: any) => {
    if (typeof p === 'string') return { type: 'other', keyword: p, difficulty: 'medium', tactics: [] };
    return {
      type: p.type || 'other',
      keyword: p.keyword || '',
      difficulty: p.difficulty || 'medium',
      tactics: Array.isArray(p.tactics) ? p.tactics : [],
    };
  });

  // Budget signals из layer2
  const budgetSignals = layers.layer2?.budget_signals || raw.block_context?.budget_signals || null;

  return {
    who_pays: {
      buyer_discussions: buyerDiscussions,
      buyer_profiles: buyerProfilesList,
      total_data_points: buyerDiscussions.length + buyerProfilesList.length,
    },
    market_segment: {
      segment_type: layers.layer2?.market_type || raw.block_context?.market_type || 'B2C',
      confidence: conf,
      signals: { enterprise: 0, b2b: 0, b2c: 0, smb: 0, total: 0 },
      evidence_urls: [],
    },
    average_ticket: {
      competitor_prices: competitorPrices,
      median_price: priceRange.median || null,
      price_count: competitorPrices.length,
      price_range: priceRange.min && priceRange.max
        ? `$${priceRange.min} – $${priceRange.max}`
        : null,
      price_min: priceRange.minimum ?? priceRange.min ?? null,
      price_premium: priceRange.premium ?? priceRange.max ?? null,
      psychological_threshold: raw.psychological_threshold || null,
      payment_model: raw.payment_model || null,
      has_trial_period: raw.has_trial_period ?? null,
    },
    sales_cycle: {
      complexity: saleCycleMap[raw.sale_cycle] || 'Неизвестно',
      reasoning: raw.path_to_first_payment || raw.block_context?.path_to_first_payment || '',
      days: raw.sale_cycle_days || null,
      budget_exists: raw.budget_category_exists ?? null,
      deal_cycle_reasoning: layers.layer2?.deal_cycle_reasoning || raw.block_context?.deal_cycle_reasoning || null,
      budget_signals: budgetSignals,
      market_type: layers.layer2?.market_type || raw.block_context?.market_type || null,
      has_trial_period: raw.has_trial_period ?? null,
      pain_type: raw.block_context?.pain_type || null,
    },
    path_to_money: {
      path_to_first_payment: raw.path_to_first_payment || raw.block_context?.path_to_first_payment || null,
      time_to_first_revenue_days: raw.time_to_first_revenue_days || raw.block_context?.time_to_first_revenue_days || null,
      market_readiness_score: raw.block_context?.market_readiness_score ?? null,
      main_barrier: raw.block_context?.main_barrier || null,
    },
    communities,
    traffic_interception_points: trafficPoints,
    verdict: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
      label: diagnosisToLabel(raw.diagnosis),
    },
    _raw_diagnosis: raw.diagnosis,
    _block_context: raw.block_context,
  };
}

// ─── Block 4: Competition ──────────────────────────────────
// combined = { diagnosis, score, key_metric, has_strategic_gap, competitor_count,
//              gap_type, entry_point, strategic_gaps, execution_gaps,
//              positioning_vectors, competitors, key_factors, block_context, layers }
export function adaptCompetitionData(raw: any): any {
  const score = raw.score ?? 5;
  const conf = diagnosisToConfidence(raw.diagnosis);
  const competitors = raw.competitors || [];
  const strategicGaps = raw.strategic_gaps || [];
  const executionGaps = raw.execution_gaps || [];

  return {
    competitors_exist: {
      count: raw.competitor_count || competitors.length,
      competitors: competitors.map((c: any) => ({
        name: c.name || c.domain,
        website: c.domain ? `https://${c.domain}` : c.website || undefined,
        target_market: c.primary_segment || c.segment || undefined,
        traffic_source: c.traffic_source || undefined,
      })),
      no_competitors_is_bad: (raw.competitor_count || competitors.length) === 0,
      note: raw.key_metric || '',
    },
    why_gaps_exist: {
      negative_reviews: strategicGaps.map((g: any) => ({
        title: g.reasoning || g.title || g.quote || '',
        url: '#',
        snippet: g.quote || g.description || '',
        source: g.source || g.competitor_domain || '',
        gap_type: 'strategic',
      })),
      unmet_needs: executionGaps.map((g: any) => ({
        title: g.title || g.quote || '',
        url: '#',
        source: g.source || '',
        score: g.count || 0,
        gap_type: 'execution',
      })),
      total_signals: strategicGaps.length + executionGaps.length,
      has_strategic_gap: raw.has_strategic_gap || false,
    },
    differentiation: {
      feature_gaps_found: strategicGaps.length,
      negative_reviews_found: executionGaps.length,
      positioning_opportunities: raw.positioning_vectors || [],
      opportunities_data_type: 'ai_synthesis',
      entry_point: raw.entry_point || null,
    },
    red_ocean: {
      saturation_score: {
        level: score >= 7 ? 'Низкая конкуренция' : score >= 4 ? 'Средняя конкуренция' : 'Высокая конкуренция',
        formula: `Score: ${score}/10`,
      },
      blue_ocean_score: {
        value: score,
        formula: raw.key_metric || '',
        confidence: conf,
      },
    },
    // gap_type — ключевая метрика для UI и Синтеза
    gap_type: raw.block_context?.gap_type || raw.gap_type || 'none',

    // Strategic gap summary от Sonnet
    strategic_gap_summary: raw.layers?.layer3?.strategic_gap_summary || null,

    // Entry point reasoning от Sonnet
    entry_point_reasoning: raw.layers?.layer3?.entry_point_reasoning || null,

    // Размеры конкурентов (для отображения)
    competitor_sizes: (raw.layers?.layer1?.competitors || []).map((c: any) => ({
      domain: c.domain,
      name: c.name,
      size: c.size?.estimate || null,
      g2_reviews: c.size?.raw?.g2_reviews || null,
      primary_segment: c.primary_segment || null,
    })),

    // Детали классификации
    classification_details: raw.layers?.layer2?.classification_details || null,

    // Структурированные gap-данные
    feature_gap_matrix: (raw.layers?.layer2?.strategic_gaps?.length > 0 || raw.layers?.layer2?.execution_gaps?.length > 0)
      ? [
          ...(raw.layers?.layer2?.strategic_gaps || []).map((g: any) => ({
            category: g.complaint_category,
            type: 'strategic' as const,
            quote: g.quote,
            competitor: g.competitor_domain,
            reasoning: g.reasoning,
          })),
          ...(raw.layers?.layer2?.execution_gaps || []).map((g: any) => ({
            category: g.complaint_category,
            type: 'execution' as const,
            quote: g.quote,
            competitor: g.competitor_domain,
          })),
        ]
      : null,

    // Competitor profiles с размерами
    pricing_benchmark: (raw.layers?.layer1?.competitors || []).length > 0
      ? (raw.layers.layer1.competitors as any[]).map((c: any) => ({
          domain: c.domain,
          segment: c.primary_segment,
          size: c.size?.estimate || null,
        }))
      : null,

    traffic_sources: null,

    competitor_complaints: competitors.length > 0
      ? {
          entries: competitors
            .filter((c: any) => c.top_complaints?.length)
            .map((c: any) => ({
              competitor: c.name || c.domain,
              categories: c.top_complaints.map((tc: any) => ({
                category: tc.category,
                count: tc.count,
                examples: [tc.sample_quote].filter(Boolean),
              })),
            })),
        }
      : null,
    verdict: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
      label: diagnosisToLabel(raw.diagnosis),
    },
    _raw_diagnosis: raw.diagnosis,
    _block_context: raw.block_context,
  };
}

// ─── Block 5: Revenue Sizing → UnitEconomics ───────────────
// combined = { diagnosis, score, key_metric, confidence, data_quality_score,
//              revenue_range, monthly_revenue, confidence_detail,
//              months_to_first_revenue, cac_estimate, cac_source,
//              gross_margin_assumption, revenue_viability, methods,
//              key_factors, block_context }
export function adaptRevenueSizingData(raw: any): any {
  const score = raw.score ?? 5;
  const conf = diagnosisToConfidence(raw.diagnosis);
  const revenueRange = raw.revenue_range || {};
  const monthlyRevenue = raw.monthly_revenue || {};
  const methods = raw.methods || {};

  return {
    cac: {
      keyword_cpc: [],
      estimated_cac: {
        value: raw.cac_estimate || 0,
        formula: raw.cac_source === 'serp_ad_density'
          ? 'Оценка на основе SERP ad density'
          : raw.cac_source
          ? `Источник: ${raw.cac_source}`
          : 'Оценка недоступна',
        confidence: raw.cac_estimate ? 0.5 : 0.2,
      },
      cpc_data_points: 0,
    },
    market_size_indicators: {
      competitors: [{
        name: methods.method_1?.competitor_domain || 'Top competitor',
        revenue: {
          value: revenueRange.mid ? `$${Math.round(revenueRange.mid).toLocaleString()}` : null,
          year: 2026,
          type: 'estimate' as const,
          source: 'Revenue sizing model',
          source_url: null,
        },
        employees: { count: null, source: null, source_url: null },
        pricing: { range: null, typical_price: null, source_url: null },
        estimated_customers: methods.method_1?.competitor_customers
          ? {
              range: `~${methods.method_1.competitor_customers}`,
              calculation: methods.method_1.reasoning || '',
              confidence: methods.method_1.confidence || 'low',
            }
          : null,
        funding: null,
      }],
      total_market_revenue: revenueRange.high
        ? `$${Math.round(revenueRange.low || 0).toLocaleString()} – $${Math.round(revenueRange.high).toLocaleString()}`
        : null,
      total_estimated_customers: null,
      largest_player: methods.method_1?.competitor_domain || null,
      data_quality: raw.confidence || 'low',
      sources_count: raw.data_quality_score || 0,
    },
    ltv_cac_ratio: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
    },
    repeat_sales: {
      business_model: raw.revenue_viability === 'viable' ? 'SaaS / Подписка' : 'Неизвестно',
      signals: { subscription: 0, one_time: 0, freemium: 0, marketplace: 0 },
      evidence: [],
    },
    scalability: {
      market_size_signals: [],
      trend_growth: 0,
      scalability_score: {
        value: score,
        formula: revenueRange.low && revenueRange.high
          ? `Revenue range: $${Math.round(revenueRange.low).toLocaleString()} – $${Math.round(revenueRange.high).toLocaleString()}`
          : raw.key_metric || '',
        confidence: conf,
      },
      months_to_first_revenue: raw.months_to_first_revenue || null,
    },
    verdict: {
      value: score,
      formula: raw.key_metric || '',
      confidence: conf,
      label: diagnosisToLabel(raw.diagnosis),
    },
    _raw_diagnosis: raw.diagnosis,
    _block_context: raw.block_context,
  };
}

// ─── Общий маппер ──────────────────────────────────────────
// Блок 6 (blind-spots) не адаптируется — у него свой новый компонент
export function adaptBlockData(block: string, raw: any): any {
  switch (block) {
    case 'problem': return adaptProblemData(raw);
    case 'demand': return raw;
    case 'sellability': return raw; // sellability-v2 — SellabilityBlock получает raw данные
    case 'occupation': return raw; // CompetitionBlock получает raw данные
    case 'economics': return raw;
    case 'tech': return raw; // blind-spots — передаём как есть для нового компонента
    default: return raw;
  }
}
