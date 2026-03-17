import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Action Plan Generator
 *
 * НЕ делает новых API-запросов.
 * Принимает ВСЕ собранные Evidence данные с клиента и:
 * 1. Рассчитывает Overall Readiness Score (детерминированно)
 * 2. Генерирует приоритетные действия на основе данных
 * 3. AI-синтез ТОЛЬКО при наличии достаточных данных (с обязательными цитатами)
 *
 * Принцип: нет данных → нет рекомендаций. Каждый пункт подкреплён evidence.
 */

interface EvidenceInput {
  problem?: {
    verdict?: { value: number; confidence: number };
    who_hurts?: {
      complaints: Array<{ text: string; source: string; source_url: string; engagement: number }>;
      total_complaints: number;
      severity_score?: { value: number };
    };
    how_often?: {
      frequency_score?: { value: number };
      google_trends?: { growth_rate: number; google_trends_url: string };
    };
    willingness_to_pay?: {
      paid_solution_count: number;
      pricing_data: Array<{ competitor: string; prices_found: Array<{ amount: string; plan: string }> }>;
    };
  };
  demand?: {
    verdict?: { value: number; confidence: number };
    growing_or_dying?: {
      trends_12m?: { growth_rate: number };
      trends_3m?: { growth_rate: number };
    };
    new_players?: {
      producthunt_launches: Array<{ title: string; url: string }>;
      show_hn_posts: Array<{ title: string; url: string }>;
      funding_news: Array<{ title: string; url: string }>;
    };
  };
  sellability?: {
    verdict?: { value: number; confidence: number };
    market_segment?: {
      segment_type: string;
      confidence: number;
    };
    average_ticket?: {
      median_price: number | null;
      competitor_prices: Array<{ competitor: string; price: string }>;
    };
    sales_cycle?: {
      complexity: string;
    };
  };
  occupation?: {
    verdict?: { value: number; confidence: number };
    competitors_exist?: {
      count: number;
      competitors: Array<{ text: string; source_url: string }>;
    };
    why_gaps_exist?: {
      negative_reviews: Array<{ text: string; source: string; source_url: string }>;
      unmet_needs: Array<{ text: string; source: string; source_url: string }>;
    };
    red_ocean?: {
      saturation_score?: { value: number };
      blue_ocean_score?: { value: number };
    };
  };
  economics?: {
    verdict?: { value: number; confidence: number };
    cac?: {
      estimated_cac?: { value: number };
      keyword_cpc?: Array<{ keyword: string; cpc: number }>;
    };
    ltv_cac_ratio?: { value: number; formula?: string };
    repeat_sales?: {
      business_model: string;
    };
    scalability?: {
      scalability_score?: { value: number };
    };
    market_size_indicators?: {
      total_market_revenue?: string | null;
      total_estimated_customers?: number | null;
      data_quality?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, evidenceData, competition } = body as {
      query: string;
      evidenceData: EvidenceInput;
      competition?: {
        competitors: Array<{ name: string; website: string; description: string }>;
        opportunity_areas?: string[];
      };
    };

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // === 1. CALCULATE OVERALL READINESS SCORE (deterministic) ===
    const verdicts = {
      problem: evidenceData?.problem?.verdict?.value || 0,
      demand: evidenceData?.demand?.verdict?.value || 0,
      sellability: evidenceData?.sellability?.verdict?.value || 0,
      occupation: evidenceData?.occupation?.verdict?.value || 0,
      economics: evidenceData?.economics?.verdict?.value || 0,
    };

    const confidences = {
      problem: evidenceData?.problem?.verdict?.confidence || 0,
      demand: evidenceData?.demand?.verdict?.confidence || 0,
      sellability: evidenceData?.sellability?.verdict?.confidence || 0,
      occupation: evidenceData?.occupation?.verdict?.confidence || 0,
      economics: evidenceData?.economics?.verdict?.confidence || 0,
    };

    const activeBlocks = Object.values(verdicts).filter(v => v > 0).length;

    if (activeBlocks < 2) {
      return NextResponse.json({
        success: true,
        data: {
          insufficient_data: true,
          message: 'Недостаточно данных для построения плана. Запустите минимум 2 Evidence блока.',
          blocks_completed: activeBlocks,
          blocks_required: 2,
        },
      });
    }

    // Weighted average of verdicts (problem and economics have higher weight)
    const weights = { problem: 0.25, demand: 0.15, sellability: 0.2, occupation: 0.15, economics: 0.25 };
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const verdict = verdicts[key as keyof typeof verdicts];
      if (verdict > 0) {
        weightedSum += verdict * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
    const avgConfidence = Math.round(
      Object.values(confidences).filter(c => c > 0).reduce((s, v) => s + v, 0) /
      Math.max(1, Object.values(confidences).filter(c => c > 0).length)
    );

    // === 2. GENERATE PRIORITY ACTIONS (deterministic, from evidence) ===
    const priorityActions: Array<{
      priority: 'high' | 'medium' | 'low';
      action: string;
      reasoning: string;
      evidence_source: string;
      evidence_url?: string;
    }> = [];

    // Problem-based actions
    if (evidenceData?.problem) {
      const severity = evidenceData.problem.who_hurts?.severity_score?.value || 0;
      const complaints = evidenceData.problem.who_hurts?.complaints || [];
      const paidCount = evidenceData.problem.willingness_to_pay?.paid_solution_count || 0;

      if (severity >= 7 && paidCount > 0) {
        priorityActions.push({
          priority: 'high',
          action: 'Разработать MVP — проблема подтверждена и люди уже платят за решения',
          reasoning: `Найдено ${complaints.length} жалоб (severity: ${severity}/10), ${paidCount} платных решений существует`,
          evidence_source: `${complaints.length} жалоб из ${new Set(complaints.map(c => c.source)).size} источников`,
          evidence_url: complaints[0]?.source_url,
        });
      } else if (severity >= 4) {
        priorityActions.push({
          priority: 'medium',
          action: 'Провести Customer Discovery — проблема выявлена, но нужно уточнить остроту',
          reasoning: `Severity: ${severity}/10 — проблема есть, но недостаточно подтверждений готовности платить`,
          evidence_source: `${complaints.length} жалоб`,
          evidence_url: complaints[0]?.source_url,
        });
      } else if (severity > 0) {
        priorityActions.push({
          priority: 'low',
          action: 'Пересмотреть позиционирование — проблема слабо выражена',
          reasoning: `Severity: ${severity}/10 — мало жалоб и низкий engagement`,
          evidence_source: 'Evidence Block: Problem',
        });
      }
    }

    // Demand-based actions
    if (evidenceData?.demand) {
      const growth12m = evidenceData.demand.growing_or_dying?.trends_12m?.growth_rate;
      const growth3m = evidenceData.demand.growing_or_dying?.trends_3m?.growth_rate;
      const newPlayers = [
        ...(evidenceData.demand.new_players?.producthunt_launches || []),
        ...(evidenceData.demand.new_players?.show_hn_posts || []),
        ...(evidenceData.demand.new_players?.funding_news || []),
      ];

      if (growth3m !== undefined && growth3m > 30) {
        priorityActions.push({
          priority: 'high',
          action: 'Ускорить выход на рынок — тренд активно растёт',
          reasoning: `Рост за 3 мес: ${growth3m}%, ${newPlayers.length} новых игроков`,
          evidence_source: 'Google Trends + ProductHunt/ShowHN',
          evidence_url: newPlayers[0]?.url,
        });
      } else if (growth12m !== undefined && growth12m < -10) {
        priorityActions.push({
          priority: 'high',
          action: 'Пересмотреть нишу — спрос падает',
          reasoning: `Падение за 12 мес: ${growth12m}%`,
          evidence_source: 'Google Trends',
        });
      }
    }

    // Competition-based actions
    if (evidenceData?.occupation) {
      const competitorCount = evidenceData.occupation.competitors_exist?.count || 0;
      const blueOcean = evidenceData.occupation.red_ocean?.blue_ocean_score?.value || 0;
      const negativeReviews = evidenceData.occupation.why_gaps_exist?.negative_reviews || [];
      const unmetNeeds = evidenceData.occupation.why_gaps_exist?.unmet_needs || [];

      if (competitorCount > 0 && negativeReviews.length > 0) {
        priorityActions.push({
          priority: 'high',
          action: `Позиционироваться на слабостях конкурентов — найдено ${negativeReviews.length} негативных отзывов`,
          reasoning: `${competitorCount} конкурентов, Blue Ocean: ${blueOcean}/10. Негативы: "${negativeReviews[0]?.text?.substring(0, 80)}..."`,
          evidence_source: `${negativeReviews.length} негативных отзывов`,
          evidence_url: negativeReviews[0]?.source_url,
        });
      }

      if (unmetNeeds.length > 0) {
        priorityActions.push({
          priority: 'medium',
          action: `Закрыть неудовлетворённые потребности — найдено ${unmetNeeds.length} запросов`,
          reasoning: `"${unmetNeeds[0]?.text?.substring(0, 80)}..."`,
          evidence_source: `${unmetNeeds.length} unmet needs`,
          evidence_url: unmetNeeds[0]?.source_url,
        });
      }

      if (competitorCount === 0) {
        priorityActions.push({
          priority: 'medium',
          action: 'Проверить, есть ли рынок — конкуренты не найдены (это может быть как плюсом, так и минусом)',
          reasoning: 'Отсутствие конкурентов может означать отсутствие рынка',
          evidence_source: 'Evidence Block: Market Occupation',
        });
      }
    }

    // Economics-based actions
    if (evidenceData?.economics) {
      const ltvCac = evidenceData.economics.ltv_cac_ratio?.value || 0;
      const businessModel = evidenceData.economics.repeat_sales?.business_model || 'unknown';
      const cac = evidenceData.economics.cac?.estimated_cac?.value || 0;
      const marketSize = evidenceData.economics.market_size_indicators;

      if (ltvCac >= 7) {
        priorityActions.push({
          priority: 'high',
          action: 'Экономика отличная — инвестировать в масштабирование привлечения',
          reasoning: `LTV/CAC score: ${ltvCac}/10, модель: ${businessModel}`,
          evidence_source: evidenceData.economics.ltv_cac_ratio?.formula || 'LTV/CAC calculation',
        });
      } else if (ltvCac > 0 && ltvCac < 4) {
        priorityActions.push({
          priority: 'high',
          action: 'Оптимизировать юнит-экономику до запуска — LTV/CAC слишком низкий',
          reasoning: `LTV/CAC score: ${ltvCac}/10, CAC: $${cac}`,
          evidence_source: 'Evidence Block: Unit Economics',
        });
      }

      if (marketSize?.total_market_revenue) {
        priorityActions.push({
          priority: 'medium',
          action: `Рынок оценён: ${marketSize.total_market_revenue}. Использовать для pitch deck.`,
          reasoning: `Качество данных: ${marketSize.data_quality || 'N/A'}`,
          evidence_source: 'SEC filings / press releases',
        });
      }
    }

    // Sellability-based actions
    if (evidenceData?.sellability) {
      const segment = evidenceData.sellability.market_segment?.segment_type;
      const medianPrice = evidenceData.sellability.average_ticket?.median_price;
      const salesComplexity = evidenceData.sellability.sales_cycle?.complexity;

      if (segment && segment !== 'Mixed') {
        priorityActions.push({
          priority: 'medium',
          action: `Целевой сегмент: ${segment}. Адаптировать продукт и маркетинг под этот сегмент.`,
          reasoning: `Уверенность: ${evidenceData.sellability.market_segment?.confidence}%. Средний чек: ${medianPrice ? `$${medianPrice}/мес` : 'N/A'}`,
          evidence_source: 'Анализ сегментов из Google Search',
        });
      }

      if (salesComplexity === 'complex') {
        priorityActions.push({
          priority: 'medium',
          action: 'Подготовить sales-команду — цикл сделки сложный (Enterprise/высокий чек)',
          reasoning: `Сегмент: ${segment}, средний чек: ${medianPrice ? `$${medianPrice}/мес` : '>$500/мес'}`,
          evidence_source: 'Evidence Block: Market Sellability',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    priorityActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // === 3. UNIT ECONOMICS SUMMARY (deterministic) ===
    const unitEconomics = {
      estimated_cac: evidenceData?.economics?.cac?.estimated_cac?.value || null,
      ltv_cac_score: evidenceData?.economics?.ltv_cac_ratio?.value || null,
      ltv_cac_formula: evidenceData?.economics?.ltv_cac_ratio?.formula || null,
      business_model: evidenceData?.economics?.repeat_sales?.business_model || null,
      median_price: evidenceData?.sellability?.average_ticket?.median_price || null,
      scalability_score: evidenceData?.economics?.scalability?.scalability_score?.value || null,
      market_revenue: evidenceData?.economics?.market_size_indicators?.total_market_revenue || null,
      market_customers: evidenceData?.economics?.market_size_indicators?.total_estimated_customers || null,
    };

    // === 4. TARGET CUSTOMER PROFILE (deterministic) ===
    const targetCustomer = {
      segment: evidenceData?.sellability?.market_segment?.segment_type || null,
      segment_confidence: evidenceData?.sellability?.market_segment?.confidence || 0,
      price_sensitivity: medianPriceBucket(evidenceData?.sellability?.average_ticket?.median_price),
      sales_complexity: evidenceData?.sellability?.sales_cycle?.complexity || null,
      top_complaints: (evidenceData?.problem?.who_hurts?.complaints || [])
        .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
        .slice(0, 5)
        .map(c => ({ text: c.text, source: c.source, url: c.source_url, engagement: c.engagement })),
    };

    // === 5. COMPETITIVE LANDSCAPE (deterministic) ===
    const competitiveLandscape = {
      competitor_count: evidenceData?.occupation?.competitors_exist?.count || 0,
      blue_ocean_score: evidenceData?.occupation?.red_ocean?.blue_ocean_score?.value || null,
      saturation: evidenceData?.occupation?.red_ocean?.saturation_score?.value || null,
      top_competitors: (evidenceData?.occupation?.competitors_exist?.competitors || []).slice(0, 5),
      key_weaknesses: (evidenceData?.occupation?.why_gaps_exist?.negative_reviews || []).slice(0, 3),
      unmet_needs: (evidenceData?.occupation?.why_gaps_exist?.unmet_needs || []).slice(0, 3),
    };

    // === 6. AI EXECUTIVE SUMMARY (only if enough data) ===
    let executiveSummary: { text: string; data_type: 'ai_synthesis'; sources_cited: number } | null = null;

    if (OPENAI_API_KEY && activeBlocks >= 3) {
      try {
        const dataSnapshot = buildDataSnapshot(query, evidenceData, verdicts, priorityActions);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Ты — консультант по стартапам. На основе РЕАЛЬНЫХ данных анализа ниши "${query}" напиши Executive Summary (3-5 абзацев).

ДАННЫЕ:
${dataSnapshot}

ПРАВИЛА:
1. Каждое утверждение ДОЛЖНО ссылаться на конкретные данные из анализа (цифры, источники)
2. НЕ выдумывай данных — используй ТОЛЬКО то, что предоставлено выше
3. Структура: Проблема → Рынок → Экономика → Рекомендация
4. Пиши на русском
5. В конце — одно предложение с главной рекомендацией (GO/NO-GO/PIVOT)
6. Если данных мало — прямо скажи: "Данных недостаточно для уверенного вывода"`,
            }],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            executiveSummary = {
              text,
              data_type: 'ai_synthesis',
              sources_cited: activeBlocks,
            };
          }
        }
      } catch (e) {
        console.error('[action-plan] AI summary error:', e);
      }
    }

    // === 7. NEXT STEPS CHECKLIST (deterministic) ===
    const nextSteps = generateNextSteps(verdicts, evidenceData);

    // === 8. OVERALL ASSESSMENT ===
    let assessment: 'go' | 'no_go' | 'pivot' | 'more_data';
    if (overallScore >= 7 && avgConfidence >= 50) {
      assessment = 'go';
    } else if (overallScore <= 3) {
      assessment = 'no_go';
    } else if (activeBlocks < 3 || avgConfidence < 30) {
      assessment = 'more_data';
    } else {
      assessment = 'pivot';
    }

    // === 9. SMOKE TEST DESIGN (deterministic) ===
    const smokeTest = {
      duration: '48 часов',
      steps: [
        {
          step: 1,
          action: 'Создать лендинг',
          description: `Одностраничный сайт для "${query}" с формой waitlist и УТП`,
          tools: 'Carrd / Tilda / TrendHunter генератор',
          cost: '$0-20',
        },
        {
          step: 2,
          action: 'Написать опрос',
          description: '5-7 вопросов для валидации боли и готовности платить',
          tools: 'Google Forms / Typeform',
          cost: '$0',
        },
        {
          step: 3,
          action: 'Запустить рекламу',
          description: `Тестовая кампания: ${unitEconomics?.estimated_cac ? `бюджет ~$${Math.round(unitEconomics.estimated_cac * 5)}` : 'бюджет $50-100'} на 48ч`,
          tools: 'Google Ads / Facebook Ads / Reddit Ads',
          cost: unitEconomics?.estimated_cac ? `~$${Math.round(unitEconomics.estimated_cac * 5)}` : '$50-100',
        },
        {
          step: 4,
          action: 'Оценить результаты',
          description: 'CR лендинга > 3%? Есть подписчики? Фидбек позитивный?',
          tools: 'Google Analytics / Hotjar',
          cost: '$0',
        },
      ],
      success_criteria: [
        { metric: 'CR лендинга', threshold: '> 3%', description: 'Конверсия посетителей в подписчики' },
        { metric: 'Подписчики waitlist', threshold: '> 20', description: 'За 48 часов минимум 20 подписок' },
        { metric: 'Ответы на опрос', threshold: '> 10', description: 'Минимум 10 заполненных анкет' },
        { metric: 'CPC рекламы', threshold: unitEconomics?.estimated_cac ? `< $${Math.round(unitEconomics.estimated_cac * 0.3)}` : '< $2', description: 'Стоимость клика ниже порога' },
      ],
    };

    // === 10. KILL-SWITCH METRICS ===
    const churnThreshold = unitEconomics?.business_model === 'subscription' ? 8 : 15;
    const cacThreshold = unitEconomics?.estimated_cac ? Math.round(unitEconomics.estimated_cac * 2) : 200;
    const ltvCacThreshold = 1.5;

    const killSwitch = {
      description: 'Чёткие метрики для закрытия проекта — если любая из них нарушена 2 месяца подряд',
      metrics: [
        {
          metric: 'Monthly Churn Rate',
          threshold: `> ${churnThreshold}%`,
          current_estimate: unitEconomics?.business_model === 'subscription' ? '~5% (SaaS норма)' : 'N/A',
          action: 'Закрыть или пивотить продукт',
        },
        {
          metric: 'CAC (Customer Acquisition Cost)',
          threshold: `> $${cacThreshold}`,
          current_estimate: unitEconomics?.estimated_cac ? `~$${unitEconomics.estimated_cac}` : 'Нет данных',
          action: 'Остановить рекламу, пересмотреть каналы',
        },
        {
          metric: 'LTV/CAC Ratio',
          threshold: `< ${ltvCacThreshold}`,
          current_estimate: unitEconomics?.ltv_cac_score ? `${unitEconomics.ltv_cac_score.toFixed(1)}` : 'Нет данных',
          action: 'Повысить цену или снизить CAC',
        },
        {
          metric: 'MRR Growth',
          threshold: '< 0% (3 мес подряд)',
          current_estimate: 'Пока нет данных',
          action: 'Полный пивот или закрытие',
        },
      ],
    };

    const result = {
      query,
      overall_readiness: {
        score: overallScore,
        assessment,
        confidence: avgConfidence,
        blocks_analyzed: activeBlocks,
        data_type: 'calculated' as const,
        formula: 'weighted_avg(problem*0.25, demand*0.15, sellability*0.2, occupation*0.15, economics*0.25)',
        block_scores: verdicts,
        block_confidences: confidences,
      },
      executive_summary: executiveSummary,
      priority_actions: priorityActions,
      unit_economics: unitEconomics,
      target_customer: targetCustomer,
      competitive_landscape: competitiveLandscape,
      next_steps: nextSteps,
      smoke_test: smokeTest,
      kill_switch: killSwitch,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Action Plan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// === HELPERS ===

function medianPriceBucket(price: number | null | undefined): string {
  if (!price) return 'unknown';
  if (price < 20) return 'low (<$20/мес)';
  if (price < 100) return 'medium ($20-100/мес)';
  if (price < 500) return 'high ($100-500/мес)';
  return 'enterprise (>$500/мес)';
}

function buildDataSnapshot(
  query: string,
  evidence: EvidenceInput,
  verdicts: Record<string, number>,
  actions: Array<{ action: string; reasoning: string }>
): string {
  const parts: string[] = [];

  parts.push(`Ниша: ${query}`);
  parts.push(`Scores: Проблема=${verdicts.problem}/10, Спрос=${verdicts.demand}/10, Продажи=${verdicts.sellability}/10, Рынок=${verdicts.occupation}/10, Экономика=${verdicts.economics}/10`);

  if (evidence.problem?.who_hurts) {
    parts.push(`Жалоб: ${evidence.problem.who_hurts.total_complaints}, severity: ${evidence.problem.who_hurts.severity_score?.value}/10`);
    const topComplaints = evidence.problem.who_hurts.complaints.slice(0, 3);
    if (topComplaints.length > 0) {
      parts.push(`Топ жалобы: ${topComplaints.map(c => `"${c.text}" (${c.source}, engagement: ${c.engagement})`).join('; ')}`);
    }
  }

  if (evidence.demand?.growing_or_dying) {
    const g12 = evidence.demand.growing_or_dying.trends_12m?.growth_rate;
    const g3 = evidence.demand.growing_or_dying.trends_3m?.growth_rate;
    if (g12 !== undefined) parts.push(`Рост 12 мес: ${g12}%`);
    if (g3 !== undefined) parts.push(`Рост 3 мес: ${g3}%`);
  }

  if (evidence.occupation?.competitors_exist) {
    parts.push(`Конкурентов: ${evidence.occupation.competitors_exist.count}`);
  }

  if (evidence.economics?.ltv_cac_ratio) {
    parts.push(`LTV/CAC: ${evidence.economics.ltv_cac_ratio.formula || evidence.economics.ltv_cac_ratio.value + '/10'}`);
  }

  if (evidence.economics?.repeat_sales?.business_model) {
    parts.push(`Бизнес-модель: ${evidence.economics.repeat_sales.business_model}`);
  }

  if (evidence.sellability?.market_segment) {
    parts.push(`Сегмент: ${evidence.sellability.market_segment.segment_type} (confidence: ${evidence.sellability.market_segment.confidence}%)`);
  }

  if (evidence.sellability?.average_ticket?.median_price) {
    parts.push(`Медианная цена: $${evidence.sellability.average_ticket.median_price}/мес`);
  }

  if (actions.length > 0) {
    parts.push(`Ключевые действия: ${actions.slice(0, 3).map(a => a.action).join('; ')}`);
  }

  return parts.join('\n');
}

function generateNextSteps(
  verdicts: Record<string, number>,
  evidence: EvidenceInput
): Array<{ step: string; category: 'research' | 'build' | 'validate' | 'grow'; done: boolean }> {
  const steps: Array<{ step: string; category: 'research' | 'build' | 'validate' | 'grow'; done: boolean }> = [];

  // Research steps
  steps.push({
    step: 'Собрать Evidence данные (минимум 3 блока)',
    category: 'research',
    done: Object.values(verdicts).filter(v => v > 0).length >= 3,
  });

  const complaints = evidence?.problem?.who_hurts?.total_complaints || 0;
  steps.push({
    step: 'Подтвердить проблему (>5 жалоб из разных источников)',
    category: 'research',
    done: complaints > 5,
  });

  // Validate steps
  const hasCompetitors = (evidence?.occupation?.competitors_exist?.count || 0) > 0;
  steps.push({
    step: 'Изучить конкурентов и их слабости',
    category: 'validate',
    done: hasCompetitors && (evidence?.occupation?.why_gaps_exist?.negative_reviews?.length || 0) > 0,
  });

  const hasPricing = (evidence?.sellability?.average_ticket?.competitor_prices?.length || 0) > 0;
  steps.push({
    step: 'Определить ценовой диапазон на основе конкурентов',
    category: 'validate',
    done: hasPricing,
  });

  steps.push({
    step: 'Проверить юнит-экономику (LTV/CAC > 3x)',
    category: 'validate',
    done: (evidence?.economics?.ltv_cac_ratio?.value || 0) >= 7, // score 7+ = ratio 3x+
  });

  // Build steps
  steps.push({
    step: 'Определить целевой сегмент и ICP',
    category: 'build',
    done: (evidence?.sellability?.market_segment?.confidence || 0) > 50,
  });

  steps.push({
    step: 'Создать MVP на основе топ-жалоб',
    category: 'build',
    done: false,
  });

  // Grow steps
  steps.push({
    step: 'Провести 10 Customer Discovery интервью',
    category: 'grow',
    done: false,
  });

  steps.push({
    step: 'Запустить landing page для валидации спроса',
    category: 'grow',
    done: false,
  });

  return steps;
}
