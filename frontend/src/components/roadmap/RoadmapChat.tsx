'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

const markdownComponents: Components = {
  p: ({ children }) => (
    <p style={{ margin: '0 0 8px 0', lineHeight: 1.6, color: '#E5E5E4' }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ color: '#F5F5F4', fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ color: '#C4C4C2' }}>{children}</em>,
  ul: ({ children }) => (
    <ul style={{ margin: '6px 0 10px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '6px 0 10px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ color: '#C4C4C2', fontSize: 13.5, lineHeight: 1.55 }}>{children}</li>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '')
    if (!isBlock) {
      return (
        <code
          {...props}
          style={{
            background: 'rgba(93,202,165,0.1)',
            border: '0.5px solid rgba(93,202,165,0.2)',
            borderRadius: 4, padding: '1px 6px', fontSize: 12.5,
            color: '#5DCAA5', fontFamily: "'SF Mono', Menlo, monospace",
          }}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        {...props}
        style={{
          display: 'block',
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '12px 14px', fontSize: 12.5,
          color: '#C4C4C2', fontFamily: "'SF Mono', Menlo, monospace",
          overflowX: 'auto', whiteSpace: 'pre', margin: '8px 0',
        }}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => <pre style={{ margin: '8px 0' }}>{children}</pre>,
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F4', margin: '12px 0 6px', letterSpacing: '-0.01em' }}>
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F4', margin: '14px 0 8px', letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: '2px solid #5DCAA5', paddingLeft: 12, margin: '8px 0',
        color: '#A3A3A1', fontStyle: 'italic',
      }}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#5DCAA5', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
}

type AIRole = 'strategist' | 'builder' | 'director'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  ai_role?: AIRole | null
  content: string
  created_at?: string
}

interface Props {
  sessionId: string
  accessStatus: string
  initialMessages?: ChatMessage[]
}

const ROLE_LABELS: Record<AIRole, string> = {
  strategist: 'AI Стратег',
  builder: 'AI Билдер',
  director: 'AI Директор',
}

const ROLE_COLORS: Record<AIRole, string> = {
  strategist: '#5DCAA5',
  builder: '#378ADD',
  director: '#7F77DD',
}

const ROLE_AVATAR: Record<AIRole, string> = {
  strategist: 'С',
  builder: 'Б',
  director: 'Д',
}

export default function RoadmapChat({ sessionId, accessStatus: _accessStatus, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [activeRole, setActiveRole] = useState<AIRole>('strategist')
  const [dailyLimitReached, setDailyLimitReached] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingRoleRef = useRef<AIRole>('strategist')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  const sendMessageRef = useRef<(text: string) => void>(() => {})

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail
      if (detail?.message) sendMessageRef.current(detail.message)
    }
    window.addEventListener('roadmap:chat:send', handler)
    return () => window.removeEventListener('roadmap:chat:send', handler)
  }, [])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming || dailyLimitReached) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setStreamingText('')
    streamingRoleRef.current = 'strategist'

    let accumulated = ''

    try {
      const response = await fetch('/api/roadmap/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      })

      if (response.status === 429) {
        setDailyLimitReached(true)
        setIsStreaming(false)
        return
      }

      if (!response.body) {
        throw new Error('Нет ответа от сервера')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let aiRole: AIRole = 'strategist'
      let finalMessageId = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text' && typeof data.text === 'string') {
              accumulated += data.text
              setStreamingText(accumulated)
            } else if (data.type === 'metric_updated') {
              window.dispatchEvent(
                new CustomEvent('roadmap:metrics:updated', {
                  detail: { metric_name: data.metric_name, value: data.value },
                })
              )
            } else if (data.type === 'done') {
              aiRole = (data.ai_role as AIRole) ?? 'strategist'
              finalMessageId = data.message_id ?? ''
              setActiveRole(aiRole)
              streamingRoleRef.current = aiRole
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Ошибка')
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e
            }
          }
        }
      }

      setMessages((prev) => [...prev, {
        id: finalMessageId || crypto.randomUUID(),
        role: 'assistant',
        ai_role: aiRole,
        content: accumulated,
        created_at: new Date().toISOString(),
      }])
      setStreamingText('')
    } catch (error) {
      console.error('[chat send]', error)
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        ai_role: 'strategist',
        content: 'Произошла ошибка. Попробуй ещё раз.',
        created_at: new Date().toISOString(),
      }])
      setStreamingText('')
    } finally {
      setIsStreaming(false)
    }
  }

  useEffect(() => {
    sendMessageRef.current = sendMessage
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 24px 16px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${ROLE_COLORS[activeRole]}, ${activeRole === 'strategist' ? '#0F6E56' : activeRole === 'builder' ? '#1F5DA0' : '#5048A0'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 600, color: '#fff',
          }}
        >
          {ROLE_AVATAR[activeRole]}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F5F4' }}>{ROLE_LABELS[activeRole]}</div>
          <div style={{ fontSize: 11, color: ROLE_COLORS[activeRole], letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {isStreaming ? 'печатает...' : 'активен'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !isStreaming && (
          <>
            <div
              style={{
                background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: 16, fontSize: 14, color: '#C4C4C2', lineHeight: 1.6,
              }}
            >
              Привет. Я знаю твою нишу и стратегию. Готов помочь — спрашивай.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[
                'Разбери моё главное действие на сегодня',
                'Я застрял, что делать дальше?',
                'Помоги написать первое сообщение клиенту',
              ].map((starter) => (
                <button
                  key={starter}
                  onClick={() => sendMessage(starter)}
                  type="button"
                  style={{
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    color: '#A3A3A1', fontSize: 13, textAlign: 'left',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .2s',
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%', padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'rgba(93,202,165,0.12)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${msg.role === 'user' ? 'rgba(93,202,165,0.2)' : 'rgba(255,255,255,0.08)'}`,
                fontSize: 13.5, color: '#E5E5E4', lineHeight: 1.6,
              }}
            >
              {msg.role === 'assistant' && msg.ai_role && msg.ai_role !== 'strategist' && (
                <div
                  style={{
                    fontSize: 10, color: ROLE_COLORS[msg.ai_role],
                    letterSpacing: '.1em', marginBottom: 6, textTransform: 'uppercase',
                  }}
                >
                  {ROLE_LABELS[msg.ai_role]}
                </div>
              )}
              {msg.role === 'assistant' ? (
                <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%', padding: '10px 14px',
                borderRadius: '12px 12px 12px 4px',
                background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
                fontSize: 13.5, color: '#E5E5E4', lineHeight: 1.6,
              }}
            >
              <ReactMarkdown components={markdownComponents}>{streamingText}</ReactMarkdown>
              <span
                style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#5DCAA5', marginLeft: 2,
                  verticalAlign: 'text-bottom', animation: 'blink 1s infinite',
                }}
              />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#5DCAA5', opacity: 0.5,
                  animation: `bounce 1.2s ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {dailyLimitReached && (
          <div className="honest">
            <div className="honest-body">
              Достигнут дневной лимит 100 сообщений. Продолжим завтра — контекст сохранён.
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ flexShrink: 0, padding: '16px 24px 20px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            disabled={isStreaming || dailyLimitReached}
            placeholder={dailyLimitReached ? 'Лимит на сегодня исчерпан...' : 'Напиши AI Стратегу...'}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '10px 14px', color: '#E5E5E4', fontSize: 14,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim() || dailyLimitReached}
            type="button"
            style={{
              padding: '10px 16px',
              background: input.trim() && !isStreaming && !dailyLimitReached ? 'rgba(93,202,165,0.2)' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${input.trim() && !isStreaming && !dailyLimitReached ? 'rgba(93,202,165,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10,
              color: input.trim() && !isStreaming && !dailyLimitReached ? '#5DCAA5' : '#6E6E6B',
              cursor: input.trim() && !isStreaming && !dailyLimitReached ? 'pointer' : 'not-allowed',
              transition: 'all .2s', fontSize: 16, fontFamily: 'inherit',
            }}
          >
            →
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#6E6E6B', marginTop: 6, textAlign: 'center' }}>
          Enter для отправки · Shift+Enter для новой строки
        </div>
      </div>
    </div>
  )
}
