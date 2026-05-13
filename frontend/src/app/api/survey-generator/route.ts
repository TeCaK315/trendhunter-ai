import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * Survey Generator
 *
 * Генерирует опросник для Customer Discovery на основе Evidence данных.
 * НЕ делает новых API-запросов.
 * Каждый вопрос детерминированно строится из реальных данных.
 */

interface SurveyQuestion {
  id: number;
  category: 'demographics' | 'current_solution' | 'pain_points' | 'pricing' | 'willingness' | 'closing';
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'open_text';
  options?: string[];
  evidence_source?: string; // What Evidence data this is based on
  required: boolean;
}

interface DistributionChannel {
  channel: string;
  platform: 'reddit' | 'linkedin' | 'producthunt' | 'hacker_news' | 'youtube' | 'indiehackers' | 'facebook' | 'twitter' | 'email' | 'google';
  reason: string;
  evidence: string;
  action: string;
  estimated_responses: string;
  estimated_cost: string;
  priority: 'high' | 'medium' | 'low';
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

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { query, evidenceData } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const problem = evidenceData?.problem || null;
    const demand = evidenceData?.demand || null;
    const sellability = evidenceData?.sellability || null;
    const occupation = evidenceData?.occupation || null;
    const economics = evidenceData?.economics || null;

    const questions: SurveyQuestion[] = [];
    let qId = 0;

    // Determine segment
    const segmentType = sellability?.market_segment?.segment_type || 'Mixed';
    const isB2B = ['B2B', 'SMB', 'Enterprise'].includes(segmentType);

    // === 1. DEMOGRAPHICS ===
    qId++;
    if (isB2B) {
      questions.push({
        id: qId,
        category: 'demographics',
        question: 'Какую роль вы занимаете в компании?',
        type: 'single_choice',
        options: [
          'Владелец / CEO',
          'CTO / Технический директор',
          'Менеджер / руководитель отдела',
          'Специалист / сотрудник',
          'Фрилансер',
          'Другое',
        ],
        required: true,
      });
    } else {
      questions.push({
        id: qId,
        category: 'demographics',
        question: 'К какой категории вы относитесь?',
        type: 'single_choice',
        options: [
          'Использую подобные продукты регулярно',
          'Использовал(а) раньше, но бросил(а)',
          'Никогда не пользовался, но интересуюсь',
          'Другое',
        ],
        required: true,
      });
    }

    // Company size (B2B only)
    if (isB2B) {
      qId++;
      questions.push({
        id: qId,
        category: 'demographics',
        question: 'Размер вашей компании?',
        type: 'single_choice',
        options: [
          '1 человек (соло)',
          '2-10 сотрудников',
          '11-50 сотрудников',
          '51-200 сотрудников',
          '200+ сотрудников',
        ],
        required: true,
      });
    }

    // === 2. CURRENT SOLUTION ===
    const competitors = occupation?.competitors_exist?.competitors || [];
    const competitorNames = competitors.slice(0, 6).map((c: { name: string }) => c.name);

    qId++;
    if (competitorNames.length > 0) {
      questions.push({
        id: qId,
        category: 'current_solution',
        question: `Какое решение для "${query}" вы используете сейчас?`,
        type: 'single_choice',
        options: [
          ...competitorNames,
          'Делаю вручную (Excel, таблицы, etc.)',
          'Ничего не использую',
          'Другое',
        ],
        evidence_source: `${competitorNames.length} конкурентов из Evidence (market-occupation)`,
        required: true,
      });
    } else {
      questions.push({
        id: qId,
        category: 'current_solution',
        question: `Как вы решаете задачу "${query}" сейчас?`,
        type: 'single_choice',
        options: [
          'Использую специализированное ПО',
          'Делаю вручную (Excel, таблицы, etc.)',
          'Аутсорс / нанимаю специалиста',
          'Никак — живу с проблемой',
          'Другое',
        ],
        required: true,
      });
    }

    // Satisfaction with current solution
    qId++;
    questions.push({
      id: qId,
      category: 'current_solution',
      question: 'Насколько вы довольны текущим решением?',
      type: 'scale',
      options: ['1 — Совсем не доволен', '2', '3', '4', '5', '6', '7', '8', '9', '10 — Полностью доволен'],
      required: true,
    });

    // === 3. PAIN POINTS (based on real complaints) ===
    const complaints = problem?.who_hurts?.complaints || [];
    const topComplaints = complaints.slice(0, 8);

    if (topComplaints.length > 0) {
      // Multiple choice: which problems resonate
      qId++;
      const complaintOptions = topComplaints.map((c: { text: string; engagement: number; source: string }) => {
        const engStr = c.engagement > 0 ? ` (${c.engagement} реакций на ${c.source})` : '';
        const text = c.text.length > 100 ? c.text.substring(0, 100) + '...' : c.text;
        return text + engStr;
      });

      questions.push({
        id: qId,
        category: 'pain_points',
        question: 'С какими из этих проблем вы сталкиваетесь? (выберите все подходящие)',
        type: 'multiple_choice',
        options: [...complaintOptions, 'Ни одна из перечисленных', 'Другое'],
        evidence_source: `${topComplaints.length} жалоб из Reddit/HN/SO (real-problem)`,
        required: true,
      });

      // Single biggest pain
      qId++;
      questions.push({
        id: qId,
        category: 'pain_points',
        question: 'Какая из проблем для вас самая критичная?',
        type: 'single_choice',
        options: [
          ...topComplaints.slice(0, 5).map((c: { text: string }) =>
            c.text.length > 80 ? c.text.substring(0, 80) + '...' : c.text
          ),
          'Другое',
        ],
        evidence_source: 'Топ-5 жалоб по engagement',
        required: true,
      });
    } else {
      // No complaints data — open question
      qId++;
      questions.push({
        id: qId,
        category: 'pain_points',
        question: `Что вас больше всего раздражает в текущих решениях для "${query}"?`,
        type: 'open_text',
        required: true,
      });
    }

    // Frequency of the problem
    qId++;
    questions.push({
      id: qId,
      category: 'pain_points',
      question: 'Как часто вы сталкиваетесь с этой проблемой?',
      type: 'single_choice',
      options: [
        'Каждый день',
        'Несколько раз в неделю',
        'Раз в неделю',
        'Несколько раз в месяц',
        'Раз в месяц или реже',
      ],
      required: true,
    });

    // Severity
    qId++;
    questions.push({
      id: qId,
      category: 'pain_points',
      question: 'Насколько критична эта проблема для вас? (1 = мелкое неудобство, 10 = серьёзно мешает работе)',
      type: 'scale',
      options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      required: true,
    });

    // === 4. PRICING ===
    const competitorPrices = sellability?.average_ticket?.competitor_prices || [];
    const medianPrice = sellability?.average_ticket?.median_price || null;
    const pricingData = problem?.willingness_to_pay?.pricing_data || [];

    // Current spending
    qId++;
    if (medianPrice && medianPrice > 0) {
      // Build ranges around median
      const low = Math.round(medianPrice * 0.3);
      const mid = Math.round(medianPrice * 0.7);
      const high = Math.round(medianPrice * 1.5);
      const vhigh = Math.round(medianPrice * 2.5);

      questions.push({
        id: qId,
        category: 'pricing',
        question: 'Сколько вы платите сейчас за решение этой задачи? (в месяц)',
        type: 'single_choice',
        options: [
          '$0 — бесплатно / ничего не использую',
          `$1-${low}`,
          `$${low + 1}-${mid}`,
          `$${mid + 1}-${high}`,
          `$${high + 1}-${vhigh}`,
          `$${vhigh}+`,
        ],
        evidence_source: `Медиана цен конкурентов: $${medianPrice}/мес (market-sellability)`,
        required: true,
      });
    } else {
      questions.push({
        id: qId,
        category: 'pricing',
        question: 'Сколько вы платите сейчас за решение этой задачи? (в месяц)',
        type: 'single_choice',
        options: [
          '$0 — бесплатно',
          '$1-29',
          '$30-59',
          '$60-99',
          '$100-199',
          '$200+',
        ],
        required: true,
      });
    }

    // === 5. WILLINGNESS TO PAY ===
    qId++;
    const topPain = topComplaints.length > 0
      ? topComplaints[0].text.length > 60
        ? topComplaints[0].text.substring(0, 60) + '...'
        : topComplaints[0].text
      : `ваша ключевая проблема с "${query}"`;

    if (medianPrice && medianPrice > 0) {
      const wpLow = Math.round(medianPrice * 0.5);
      const wpMid = Math.round(medianPrice * 0.8);
      const wpHigh = Math.round(medianPrice * 1.2);
      const wpVhigh = Math.round(medianPrice * 2);

      questions.push({
        id: qId,
        category: 'willingness',
        question: `Если бы существовал продукт, который решает "${topPain}", сколько бы вы были готовы платить в месяц?`,
        type: 'single_choice',
        options: [
          '$0 — только бесплатно',
          `$1-${wpLow}`,
          `$${wpLow + 1}-${wpMid}`,
          `$${wpMid + 1}-${wpHigh}`,
          `$${wpHigh + 1}-${wpVhigh}`,
          `$${wpVhigh}+`,
        ],
        evidence_source: `Топ-1 жалоба + медиана $${medianPrice}/мес`,
        required: true,
      });
    } else {
      questions.push({
        id: qId,
        category: 'willingness',
        question: `Если бы существовал продукт, который решает "${topPain}", сколько бы вы были готовы платить в месяц?`,
        type: 'single_choice',
        options: [
          '$0 — только бесплатно',
          '$1-19',
          '$20-49',
          '$50-99',
          '$100-199',
          '$200+',
        ],
        required: true,
      });
    }

    // Decision factors
    qId++;
    questions.push({
      id: qId,
      category: 'willingness',
      question: 'Что для вас важнее всего при выборе решения? (выберите до 3)',
      type: 'multiple_choice',
      options: [
        'Низкая цена',
        'Простота использования',
        'Функциональность',
        'Интеграции с другими сервисами',
        'Поддержка на русском / родном языке',
        'Скорость работы',
        'Безопасность данных',
        'Репутация / отзывы',
      ],
      required: true,
    });

    // How they discover solutions
    qId++;
    questions.push({
      id: qId,
      category: 'willingness',
      question: 'Где вы обычно ищете новые инструменты / решения?',
      type: 'multiple_choice',
      options: [
        'Google поиск',
        'Reddit / форумы',
        'YouTube',
        'Рекомендации коллег',
        'Product Hunt',
        'App Store / Google Play',
        'Другое',
      ],
      required: false,
    });

    // === 6. CLOSING ===
    qId++;
    questions.push({
      id: qId,
      category: 'closing',
      question: 'Есть ли что-то ещё, что мы должны знать о вашем опыте?',
      type: 'open_text',
      required: false,
    });

    qId++;
    questions.push({
      id: qId,
      category: 'closing',
      question: 'Оставьте email, если хотите узнать о результатах исследования и получить ранний доступ:',
      type: 'open_text',
      required: false,
    });

    // === DISTRIBUTION CHANNELS ===
    const channels = buildDistributionChannels(
      query, segmentType, complaints, demand, sellability, competitorNames
    );

    // === BUILD EXPORT ===
    const plainText = buildPlainText(query, segmentType, questions);
    const googleFormsUrl = buildGoogleFormsUrl(query, questions);

    const response: SurveyData = {
      title: `Опросник: ${query}`,
      description: `Опрос для валидации ниши "${query}". Сгенерирован на основе ${topComplaints.length} реальных жалоб, ${competitorNames.length} конкурентов и ${competitorPrices.length} ценовых точек.`,
      target_segment: segmentType,
      questions,
      distribution_channels: channels,
      export_formats: {
        plain_text: plainText,
        google_forms_url: googleFormsUrl,
      },
      evidence_coverage: {
        complaints_used: topComplaints.length,
        competitors_used: competitorNames.length,
        prices_used: competitorPrices.length,
      },
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[survey-generator] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate survey' },
      { status: 500 }
    );
  }
}

function buildDistributionChannels(
  query: string,
  segment: string,
  complaints: Array<{ text: string; source: string; engagement: number; source_url?: string }>,
  demand: any,
  sellability: any,
  competitorNames: string[]
): DistributionChannel[] {
  const channels: DistributionChannel[] = [];
  const isB2B = ['B2B', 'SMB', 'Enterprise'].includes(segment);

  // Count complaints by source
  const sourceCounts: Record<string, number> = {};
  const sourceEngagement: Record<string, number> = {};
  for (const c of complaints) {
    const src = c.source?.toLowerCase() || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    sourceEngagement[src] = (sourceEngagement[src] || 0) + (c.engagement || 0);
  }

  // 1. Reddit — if complaints from reddit exist
  const redditCount = sourceCounts['reddit'] || 0;
  if (redditCount > 0) {
    // Try to extract subreddit from URLs
    const subreddits = new Set<string>();
    for (const c of complaints) {
      if (c.source === 'reddit' && c.source_url) {
        const match = c.source_url.match(/reddit\.com\/r\/([^/]+)/);
        if (match) subreddits.add(match[1]);
      }
    }
    const subList = Array.from(subreddits).slice(0, 3);

    channels.push({
      channel: subList.length > 0
        ? `Reddit: ${subList.map(s => `r/${s}`).join(', ')}`
        : 'Reddit (тематические сабреддиты)',
      platform: 'reddit',
      reason: `Найдено ${redditCount} жалоб (${sourceEngagement['reddit'] || 0} реакций) — аудитория активна`,
      evidence: `${redditCount} постов из Evidence (real-problem)`,
      action: `Пост: "Исследование: что вас бесит в ${query.length > 30 ? query.substring(0, 30) + '...' : query}?"`,
      estimated_responses: '30-80 ответов',
      estimated_cost: '$0 (органический)',
      priority: redditCount >= 5 ? 'high' : 'medium',
    });
  }

  // 2. Hacker News — if HN complaints or Show HN posts
  const hnCount = sourceCounts['hacker_news'] || 0;
  const showHnPosts = demand?.new_players?.show_hn_posts || [];
  if (hnCount > 0 || showHnPosts.length > 0) {
    channels.push({
      channel: 'Hacker News',
      platform: 'hacker_news',
      reason: hnCount > 0
        ? `Найдено ${hnCount} обсуждений на HN + ${showHnPosts.length} Show HN проектов`
        : `${showHnPosts.length} Show HN проектов — аудитория знакома с темой`,
      evidence: `${hnCount} постов + ${showHnPosts.length} Show HN`,
      action: 'Ask HN: Исследование — какой инструмент вам не хватает?',
      estimated_responses: '20-50 ответов',
      estimated_cost: '$0 (органический)',
      priority: hnCount >= 3 ? 'high' : 'medium',
    });
  }

  // 3. LinkedIn — if B2B/SMB/Enterprise
  if (isB2B) {
    const enterpriseSignals = sellability?.market_segment?.signals?.enterprise || 0;
    const b2bSignals = sellability?.market_segment?.signals?.b2b || 0;

    channels.push({
      channel: 'LinkedIn (таргетированная реклама)',
      platform: 'linkedin',
      reason: `Сегмент ${segment} — LinkedIn оптимален для B2B опросов`,
      evidence: `Segment signals: enterprise=${enterpriseSignals}, b2b=${b2bSignals}`,
      action: competitorNames.length > 0
        ? `Таргетинг: пользователи ${competitorNames.slice(0, 2).join(', ')} + релевантные должности`
        : 'Таргетинг: профили с релевантными должностями',
      estimated_responses: '50-200 ответов',
      estimated_cost: '$50-150',
      priority: 'high',
    });
  }

  // 4. Product Hunt — if PH launches exist
  const phLaunches = demand?.new_players?.producthunt_launches || [];
  if (phLaunches.length > 0) {
    channels.push({
      channel: 'Product Hunt (комментарии)',
      platform: 'producthunt',
      reason: `${phLaunches.length} запусков в нише — аудитория ищет альтернативы`,
      evidence: `${phLaunches.length} Product Hunt запусков`,
      action: `Оставить комментарий с опросом под релевантными запусками`,
      estimated_responses: '10-30 ответов',
      estimated_cost: '$0 (органический)',
      priority: 'medium',
    });
  }

  // 5. YouTube — if youtube content exists
  const ytContent = demand?.youtube_content || [];
  if (ytContent.length > 0) {
    channels.push({
      channel: 'YouTube (комментарии к видео)',
      platform: 'youtube',
      reason: `${ytContent.length} видео по теме — зрители как потенциальные респонденты`,
      evidence: `${ytContent.length} видео из Evidence (demand)`,
      action: 'Оставить ссылку на опрос в комментариях к топ-видео',
      estimated_responses: '10-40 ответов',
      estimated_cost: '$0 (органический)',
      priority: 'low',
    });
  }

  // 6. Indie Hackers — if IH posts exist
  const ihPosts = demand?.new_players?.indiehackers_posts || [];
  if (ihPosts.length > 0) {
    channels.push({
      channel: 'Indie Hackers',
      platform: 'indiehackers',
      reason: `${ihPosts.length} постов — сообщество фаундеров знакомо с нишей`,
      evidence: `${ihPosts.length} постов из Evidence`,
      action: 'Пост в разделе "Validate" с просьбой пройти опрос',
      estimated_responses: '15-40 ответов',
      estimated_cost: '$0 (органический)',
      priority: 'medium',
    });
  }

  // 7. Facebook Groups — for B2C
  if (!isB2B) {
    channels.push({
      channel: 'Facebook Groups',
      platform: 'facebook',
      reason: `Сегмент ${segment} — Facebook группы эффективны для B2C опросов`,
      evidence: `Segment: ${segment}`,
      action: `Поиск групп: "${query}" + публикация опроса`,
      estimated_responses: '20-60 ответов',
      estimated_cost: '$0-30',
      priority: 'medium',
    });
  }

  // 8. Twitter/X — if twitter complaints
  const twitterCount = sourceCounts['twitter'] || 0;
  if (twitterCount > 0) {
    channels.push({
      channel: 'Twitter/X',
      platform: 'twitter',
      reason: `${twitterCount} жалоб найдено в Twitter`,
      evidence: `${twitterCount} постов из Evidence`,
      action: `Тред: "Мы исследуем ${query} — помогите пройти опрос (2 мин)"`,
      estimated_responses: '10-30 ответов',
      estimated_cost: '$0 (органический)',
      priority: 'low',
    });
  }

  // 9. Google Ads — if CPC data available
  const cpcData = (demand?.economics?.cac?.keyword_cpc || []) as Array<{ keyword: string; cpc: number }>;
  if (cpcData.length > 0 || (complaints.length > 0 && competitorNames.length > 0)) {
    channels.push({
      channel: 'Google Ads (микро-бюджет)',
      platform: 'google',
      reason: 'Точный таргетинг по ключевым запросам из Evidence',
      evidence: cpcData.length > 0
        ? `${cpcData.length} ключевых слов с CPC данными`
        : 'На основе найденных ключевых слов',
      action: `Landing page с опросом → реклама по "${query}" запросам`,
      estimated_responses: '50-150 ответов',
      estimated_cost: '$30-100',
      priority: complaints.length >= 5 ? 'medium' : 'low',
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  channels.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return channels;
}

function buildPlainText(query: string, segment: string, questions: SurveyQuestion[]): string {
  let text = `# Опросник для валидации: ${query}\n`;
  text += `# Целевой сегмент: ${segment}\n\n`;

  for (const q of questions) {
    text += `${q.id}. ${q.question}${q.required ? ' *' : ''}\n`;
    if (q.options) {
      for (const opt of q.options) {
        const marker = q.type === 'multiple_choice' ? '☐' : '○';
        text += `   ${marker} ${opt}\n`;
      }
    } else if (q.type === 'open_text') {
      text += `   ___________________________________\n`;
    }
    if (q.evidence_source) {
      text += `   📊 Источник: ${q.evidence_source}\n`;
    }
    text += '\n';
  }

  return text;
}

function buildGoogleFormsUrl(query: string, questions: SurveyQuestion[]): string {
  // Google Forms pre-fill URL builder
  // https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.XXX=YYY
  // Since we don't have a form ID, we generate a template URL with instructions
  const title = encodeURIComponent(`Опросник: ${query}`);
  return `https://docs.google.com/forms/create?title=${title}`;
}
