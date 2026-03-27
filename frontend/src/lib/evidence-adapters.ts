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
  if (gr === 'growing') return 15;
  if (gr === 'stable') return 2;
  return -10;
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

  // "Как часто" — все источники из by_source динамически
  const sourceEntries = Object.entries(bySource).map(([name, count]) => ({
    name,
    count: count as number,
  }));

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

  // Конструируем trends_12m из доступных данных
  const demandIndex = layer1.demand_index || 0;
  const growthRate = layer1.growth_rate || 'stable';
  const growthPercent = growthRate === 'growing' ? 15 : growthRate === 'declining' ? -10 : 2;

  // Google Trends URL для данной ниши
  const keywordForUrl = raw.block_context?.competitors_found?.[0]?.query
    || (raw.top_keywords?.[0]?.query) || '';

  const trendsUrl = keywordForUrl
    ? `https://trends.google.com/trends/explore?q=${encodeURIComponent(keywordForUrl)}`
    : '';

  const trends12m = demandIndex > 0 ? {
    growth_rate: growthPercent,
    search_query: keywordForUrl,
    original_query: keywordForUrl,
    google_trends_url: trendsUrl,
    interest_timeline: [],  // нет детальных точек
  } : null;

  const trends3m = demandIndex > 0 ? {
    growth_rate: Math.round(growthPercent * 0.8),
    search_query: keywordForUrl,
    original_query: keywordForUrl,
    google_trends_url: trendsUrl,
  } : null;

  // "Новые игроки" — конвертируем competitors_found в формат компонента
  const competitors = raw.competitors_found || [];
  const paidCompetitors = competitors.filter((c: any) => c.source === 'paid');
  const organicCompetitors = competitors.filter((c: any) => c.source === 'organic');

  // Платные конкуренты → funding_news (они вкладывают в рекламу = инвестируют)
  const fundingNews = paidCompetitors.slice(0, 5).map((c: any) => ({
    title: c.name || c.domain,
    url: `https://${c.domain}`,
    snippet: `Рекламируется по запросу: "${c.query}"`,
    date: 'Paid Ads',
  }));

  // Органические конкуренты → show_hn_posts (просто показать как новых игроков)
  const showHnPosts = organicCompetitors.slice(0, 5).map((c: any) => ({
    title: c.name || c.domain,
    url: `https://${c.domain}`,
    points: c.position ? (10 - c.position) : 0,
    snippet: `Органическая позиция #${c.position || '?'} по "${c.query}"`,
  }));

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
      producthunt_launches: [],
      show_hn_posts: showHnPosts,
      funding_news: fundingNews,
      new_entrants_count: competitors.length,
      competitors_found: competitors.slice(0, 10).map((c: any) => ({
        name: c.name || c.domain,
        domain: c.domain,
        source: c.source,
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
    geo_breakdown: [],
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
      psychological_threshold: raw.psychological_threshold || null,
    },
    sales_cycle: {
      complexity: saleCycleMap[raw.sale_cycle] || 'Неизвестно',
      reasoning: raw.path_to_first_payment || raw.block_context?.path_to_first_payment || '',
      days: raw.sale_cycle_days || null,
      budget_exists: raw.budget_category_exists ?? null,
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
        subreddit: g.source || '',
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
    feature_gap_matrix: null,
    pricing_benchmark: null,
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
    case 'demand': return adaptDemandData(raw);
    case 'sellability': return adaptSellabilityData(raw);
    case 'occupation': return adaptCompetitionData(raw);
    case 'economics': return adaptRevenueSizingData(raw);
    case 'tech': return raw; // blind-spots — передаём как есть для нового компонента
    default: return raw;
  }
}
