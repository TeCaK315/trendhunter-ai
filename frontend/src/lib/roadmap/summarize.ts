import type Anthropic from '@anthropic-ai/sdk'

// supabase client из getServerSupabase() — намеренно any,
// чтобы не тянуть типы Database
type SupabaseAny = any  // eslint-disable-line @typescript-eslint/no-explicit-any

export async function triggerSummarization(
  sessionId: string,
  supabase: SupabaseAny,
  anthropic: Anthropic
): Promise<void> {
  try {
    const { data: messagesData } = await supabase
      .from('roadmap_chat_messages')
      .select('id, role, ai_role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    const messages = (messagesData ?? []) as Array<{
      id: string
      role: string
      ai_role?: string | null
      content: string
    }>
    if (messages.length < 10) return

    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'Пользователь' : `AI (${m.ai_role ?? 'strategist'})`}: ${m.content}`)
      .join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Создай краткое резюме разговора между пользователем и AI-советчиком по развитию бизнеса. Сохрани: ключевые решения, важные факты о нише и клиентах, прогресс метрики, незавершённые задачи. Резюме на русском языке, 300-500 слов.\n\nРАЗГОВОР:\n${conversationText}\n\nРЕЗЮМЕ:`,
      }],
    })

    const summaryContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')

    await supabase.from('roadmap_chat_summaries').insert({
      session_id: sessionId,
      covers_from_message_id: messages[0].id,
      covers_to_message_id: messages[messages.length - 1].id,
      summary_content: summaryContent,
    })
  } catch (e) {
    console.error('[summarize] failed:', e)
  }
}
