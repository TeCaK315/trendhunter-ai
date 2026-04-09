// src/lib/synthesis/prompts/sales-architect.ts
// Sales Architect — fourth synthesis agent
// Generates persuasive text for Strategic Delta section

import Anthropic from '@anthropic-ai/sdk';

const SALES_ARCHITECT_PROMPT = `Ты — мастер продаж и маркетолог для B2B предпринимателей.

Ты видишь полный анализ рыночной ниши и знаешь что существует
стратегический разрыв между стандартным и оптимальным входом.

Твоя задача: написать текст который заставит предпринимателя
перейти в раздел Стратегия — не потому что ты его уговариваешь,
а потому что он сам поймёт: не сделать этого — глупо.

ДАННЫЕ КОТОРЫЕ ТЫ ПОЛУЧАЕШЬ:
  Ниша: {{niche}}
  Вердикт: {{verdict_type}} ({{confidence_percent}}% уверенности)
  CAC: {{cac_mid}} через {{acquisition_type}}
  Месяцев до выручки: {{months_to_first_revenue}}
  Главная экономическая ловушка: {{main_economic_risk}}
  Switching cost: {{avg_switching_cost}}
  Топ незакрытая боль: {{top_open_gap}}
  Слепое пятно: {{first_spot_teaser}}
  Стратегический разрыв: {{uplift_level}}
    (кратный / значительный / умеренный — без точных цифр)

ТРИ ПРАВИЛА:

1. НИКАКОЙ АБСТРАКЦИИ.
   Каждое утверждение основано на данных выше.
   Если нет цифры из данных — не придумывай.
   Плохо: "у вас есть огромный потенциал"
   Хорошо: "CAC $7500 через SALES_LED при низком switching cost
            означает что клиент уйдёт до окупаемости"

2. ЯЗЫК ПОТЕРЬ, НЕ ОБЕЩАНИЙ.
   Говори не о том что будет хорошо.
   Говори о том что будет плохо если не знать.
   Используй сравнительные конструкции которые семантически
   совпадают с тем что пользователь видит в визуализации:
   "кратное преимущество", "значительное сокращение сроков",
   "существенная разница в вероятности" — без точных процентов.

3. ФИНАЛ — ОДИН ВОПРОС.
   Заканчивай не призывом а вопросом к читателю.
   Вопрос должен быть таким чтобы единственный честный
   ответ вёл к кнопке.

АДАПТАЦИЯ ПОД ВЕРДИКТ:
go_if:
  Тон: "ты уже выиграл — вопрос сколько оставишь на столе"
  Фокус: упущенный доход при стандартном входе

experiment_if:
  Тон: "у тебя чуть меньше шансов чем нужно — стратегия меняет соотношение"
  Фокус: вероятность провала при стандартном входе

no_go_until:
  Тон: "стандартный путь закрыт — но есть нестандартный"
  Фокус: почему математика меняется при другом подходе

ФОРМАТ:
  Текст 3-6 предложений.
  Без заголовков. Без списков. Только текст.
  Последнее предложение — вопрос.
  Язык: русский.

ЗАПРЕЩЕНО:
  "уникальная возможность", "огромный потенциал",
  "не упустите шанс", "эксперты рекомендуют",
  Точные цифры uplift которых нет в исходных данных блоков.`;

export async function runSalesArchitect(
  claude: Anthropic,
  params: {
    niche: string;
    verdict_type: string;
    confidence_percent: number;
    cac_mid: number | null;
    acquisition_type: string;
    months_to_first_revenue: number;
    main_economic_risk: string;
    avg_switching_cost: string;
    top_open_gap: string;
    first_spot_teaser: string | null;
    uplift_level: string;
  }
): Promise<string> {
  // Replace {{placeholders}} in prompt with params
  let prompt = SALES_ARCHITECT_PROMPT;
  prompt = prompt.replace('{{niche}}', params.niche);
  prompt = prompt.replace('{{verdict_type}}', params.verdict_type);
  prompt = prompt.replace('{{confidence_percent}}', String(params.confidence_percent));
  prompt = prompt.replace('{{cac_mid}}', params.cac_mid != null ? `$${params.cac_mid}` : 'не определён');
  prompt = prompt.replace('{{acquisition_type}}', params.acquisition_type);
  prompt = prompt.replace('{{months_to_first_revenue}}', String(params.months_to_first_revenue));
  prompt = prompt.replace('{{main_economic_risk}}', params.main_economic_risk || 'не определена');
  prompt = prompt.replace('{{avg_switching_cost}}', params.avg_switching_cost);
  prompt = prompt.replace('{{top_open_gap}}', params.top_open_gap);
  prompt = prompt.replace('{{first_spot_teaser}}', params.first_spot_teaser || 'не обнаружено');
  prompt = prompt.replace('{{uplift_level}}', params.uplift_level);

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  return text;
}
