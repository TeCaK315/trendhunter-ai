import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, type OpenAIMessage } from '@/lib/openai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';

interface TranslateRequest {
  content: Record<string, unknown>;
  targetLang: 'en' | 'ru';
  fields?: string[]; // Какие поля переводить (если не указано - все строковые поля)
}

// Кэш переводов (в production лучше использовать Redis)
const translationCache = new Map<string, Record<string, unknown>>();

// Создаём ключ для кэша
function getCacheKey(content: Record<string, unknown>, targetLang: string): string {
  const contentStr = JSON.stringify(content);
  return `${targetLang}:${contentStr.slice(0, 100)}:${contentStr.length}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`translate:${clientIP}`, RATE_LIMITS.translate);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: TranslateRequest = await request.json();
    const { content, targetLang, fields } = body;

    if (!content || !targetLang) {
      return NextResponse.json(
        { success: false, error: 'content and targetLang are required' },
        { status: 400 }
      );
    }

    // Проверяем кэш
    const cacheKey = getCacheKey(content, targetLang);
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        translated: cached,
        fromCache: true
      });
    }

    // Извлекаем поля для перевода (строки и массивы)
    const fieldsToTranslate = fields || Object.keys(content).filter(key => {
      const value = content[key];
      // Строки
      if (typeof value === 'string' && value.length > 0 && value.length < 5000) {
        return true;
      }
      // Массивы (строк или объектов)
      if (Array.isArray(value) && value.length > 0) {
        return true;
      }
      return false;
    });

    // Если нет полей для перевода - возвращаем как есть
    if (fieldsToTranslate.length === 0) {
      return NextResponse.json({
        success: true,
        translated: content,
        fromCache: false
      });
    }

    // Собираем контент для перевода
    const textsToTranslate: Record<string, unknown> = {};
    for (const field of fieldsToTranslate) {
      const value = content[field];
      if (typeof value === 'string' && value.length > 0) {
        textsToTranslate[field] = value;
      } else if (Array.isArray(value)) {
        // Если массив объектов - передаём как есть для перевода
        if (value.length > 0 && typeof value[0] === 'object') {
          textsToTranslate[field] = value;
        } else {
          // Если массив строк - объединяем через разделитель
          const stringItems = value.filter(item => typeof item === 'string');
          if (stringItems.length > 0) {
            textsToTranslate[field] = stringItems.join('\n|||ITEM|||\n');
          }
        }
      }
    }

    // Если нечего переводить
    if (Object.keys(textsToTranslate).length === 0) {
      return NextResponse.json({
        success: true,
        translated: content,
        fromCache: false
      });
    }

    const targetLanguage = targetLang === 'en' ? 'English' : 'Russian';
    const sourceLanguage = targetLang === 'en' ? 'Russian' : 'English';

    // Системный промпт для перевода
    const systemPrompt = `You are a professional translator specializing in tech, business, and startup content.
Your task is to translate the provided JSON from ${sourceLanguage} to ${targetLanguage}.

IMPORTANT RULES:
1. Translate ONLY the text values, keep JSON structure and field names exactly the same
2. Preserve any technical terms, brand names, and abbreviations
3. Maintain the tone and style - if it's professional, keep it professional
4. For arrays of strings marked with "|||ITEM|||" separator - translate each item separately, keep the separator
5. For arrays of objects - translate string values inside each object, keep the object structure
6. Return ONLY valid JSON, no explanations
7. If text is already in ${targetLanguage}, return it unchanged

Example input: {"title": "AI Analyzer", "items": [{"name": "Оптимист", "text": "Хорошая идея"}]}
Example output for English: {"title": "AI Analyzer", "items": [{"name": "Optimist", "text": "Good idea"}]}`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(textsToTranslate) }
    ];

    const result = await callOpenAI(messages, {
      model: 'gpt-4o-mini',
      temperature: 0.3, // Низкая температура для точности перевода
      maxTokens: 4000,
      maxRetries: 2
    });

    if (!result.success) {
      console.error('Translation API error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error.userMessage },
        { status: 500 }
      );
    }

    // Парсим JSON ответ
    let translatedTexts: Record<string, unknown>;
    try {
      // Ищем JSON в ответе
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      translatedTexts = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse translation response:', result.content);
      return NextResponse.json(
        { success: false, error: 'Ошибка обработки перевода' },
        { status: 500 }
      );
    }

    // Собираем результат, объединяя переведённые поля с оригинальными
    const translated: Record<string, unknown> = { ...content };

    for (const [field, translatedValue] of Object.entries(translatedTexts)) {
      if (typeof translatedValue === 'string') {
        // Если это был массив строк - разбираем обратно
        if (Array.isArray(content[field]) && typeof content[field][0] === 'string') {
          translated[field] = translatedValue.split('\n|||ITEM|||\n').map(item => item.trim());
        } else {
          translated[field] = translatedValue;
        }
      } else if (Array.isArray(translatedValue)) {
        // Массив объектов - используем как есть
        translated[field] = translatedValue;
      } else if (typeof translatedValue === 'object' && translatedValue !== null) {
        // Объект - используем как есть
        translated[field] = translatedValue;
      }
    }

    // Сохраняем в кэш (лимит на 1000 записей)
    if (translationCache.size > 1000) {
      // Удаляем первую запись (FIFO)
      const firstKey = translationCache.keys().next().value;
      if (firstKey) {
        translationCache.delete(firstKey);
      }
    }
    translationCache.set(cacheKey, translated);

    return NextResponse.json({
      success: true,
      translated,
      fromCache: false
    });

  } catch (error) {
    console.error('Translate API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Batch перевод для нескольких объектов
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting (batch uses same limit as single)
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`translate:${clientIP}`, RATE_LIMITS.translate);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: { items: Record<string, unknown>[]; targetLang: 'en' | 'ru'; fields?: string[] } = await request.json();
    const { items, targetLang, fields } = body;

    if (!items || !Array.isArray(items) || !targetLang) {
      return NextResponse.json(
        { success: false, error: 'items (array) and targetLang are required' },
        { status: 400 }
      );
    }

    // Ограничиваем batch size
    const batchItems = items.slice(0, 10);

    // Переводим каждый элемент
    const results: Record<string, unknown>[] = [];

    for (const item of batchItems) {
      // Делаем внутренний запрос к POST endpoint
      const response = await POST(new NextRequest(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item, targetLang, fields })
      }));

      const data = await response.json();
      if (data.success) {
        results.push(data.translated);
      } else {
        results.push(item); // Если не удалось перевести - возвращаем оригинал
      }
    }

    return NextResponse.json({
      success: true,
      translated: results
    });

  } catch (error) {
    console.error('Batch translate API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
