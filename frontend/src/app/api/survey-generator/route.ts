import { NextRequest, NextResponse } from 'next/server';

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

interface SurveyData {
  title: string;
  description: string;
  target_segment: string;
  questions: SurveyQuestion[];
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

    // === BUILD EXPORT ===
    const plainText = buildPlainText(query, segmentType, questions);
    const googleFormsUrl = buildGoogleFormsUrl(query, questions);

    const response: SurveyData = {
      title: `Опросник: ${query}`,
      description: `Опрос для валидации ниши "${query}". Сгенерирован на основе ${topComplaints.length} реальных жалоб, ${competitorNames.length} конкурентов и ${competitorPrices.length} ценовых точек.`,
      target_segment: segmentType,
      questions,
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
