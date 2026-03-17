import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, context, history } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt
    const systemPrompt = context
      || `You are a helpful assistant. Answer questions based on the provided context.`;

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Stream response
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!openaiRes.ok) {
      const errorData = await openaiRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: 'AI service error', details: errorData }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform OpenAI stream to text stream
    const reader = openaiRes.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: 'No response stream' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter(l => l.trim().startsWith('data: '));

            for (const line of lines) {
              const data = line.replace('data: ', '').trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }

          // Save to Supabase after completion
          if (supabaseUrl && supabaseKey && sessionId) {
            try {
              const supabase = createClient(supabaseUrl, supabaseKey);
              await supabase.from('chat_messages').insert([
                {
                  session_id: sessionId,
                  role: 'user',
                  content: message,
                },
                {
                  session_id: sessionId,
                  role: 'assistant',
                  content: fullResponse,
                },
              ]);
            } catch (e) {
              console.error('Failed to save chat messages:', e);
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
