import { useState, useRef, useEffect } from 'react'
import { PLATFORM_COLORS } from '../hooks'
import type { Topic, UnifiedMessage } from '../types'
import { MessageBubble } from './MessageBubble'

interface Props {
  topic: Topic
  onBack: () => void
}

const MODEL_NAMES: Record<string, { name: string; version: string }> = {
  'hermes': { name: 'Hermes Agent', version: 'v2.0' },
  'claude-code': { name: 'Claude Code', version: 'v3.5' },
  'chatgpt-web': { name: 'ChatGPT', version: 'Web' },
  'claude-web': { name: 'Claude.ai', version: 'Web' },
}

const MODEL_ICONS: Record<string, string> = {
  'hermes': '◆',
  'claude-code': '🧠',
  'chatgpt-web': '⊞',
  'claude-web': '◈',
}

function generateSummary(topic: Topic): string {
  const msgs = topic.messages || []
  const userMsgs = msgs.filter(m => m.role === 'user')
  if (userMsgs.length === 0) return '這個主題中沒有使用者訊息。'
  const first = userMsgs[0]?.content?.slice(0, 150) || ''
  const last = userMsgs[userMsgs.length - 1]?.content?.slice(0, 150) || ''
  const platforms = (topic.platforms || []).map(p => PLATFORM_COLORS[p]?.label || p).join('、')
  return `這則對話共跨越 ${topic.session_count} 個對話回合，涵蓋 ${platforms}。\n最初聚焦於「${first}${first.length > 140 ? '...' : ''}」，最近則討論到「${last}${last.length > 140 ? '...' : ''}」。`
}

export function TopicView({ topic, onBack }: Props) {
  const [summaryCopied, setSummaryCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const summary = generateSummary(topic)
  const totalTokens = topic.message_count_exported * 350 // rough estimate

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-deep)', color: 'var(--text)' }}>
      {/* Sticky Header */}
      <header className="flex-shrink-0 sticky top-0 z-30 px-4 sm:px-8 py-4" style={{ backgroundColor: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-2 text-[13px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
          <button onClick={onBack} className="hover:text-[var(--text)] transition-colors">← 主題</button>
          <span>/</span>
          <span style={{ color: '#d2bbff' }}>{topic.name.slice(0, 40)}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif'", color: 'var(--text)' }}>
              {topic.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="text-[13px] flex items-center gap-1" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                ◆ {topic.session_count} 個回合
              </span>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-[13px] flex items-center gap-1" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                💬 {topic.message_count_exported} 則訊息
              </span>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-[13px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                平台：
              </span>
              {(topic.platforms || []).map((p) => {
                const pc = PLATFORM_COLORS[p]
                if (!pc) return null
                return (
                  <span key={p} className="px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1"
                    style={{ backgroundColor: pc.bg, borderColor: pc.dot + '40', color: pc.dot, fontFamily: "'Geist', monospace" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc.dot }} />
                    {MODEL_NAMES[p]?.name || pc.label}
                  </span>
                )
              })}
            </div>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(topic.messages.map(m => `${m.role === 'user' ? '你' : '助手'}: ${m.content}`).join('\n\n')) }}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#d2bbff', color: '#3f008e', fontFamily: "'Geist', monospace" }}
          >
            📋 複製完整對話
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Summary Card */}
          <div className="rounded-xl p-5 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span style={{ color: '#d2bbff' }}>📋</span>
                <h3 className="text-[18px] font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>摘要</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(summary); setSummaryCopied(true); setTimeout(() => setSummaryCopied(false), 2000) }}
                  className="px-3 py-1.5 rounded text-[12px] border transition-colors flex items-center gap-1.5"
                  style={{ fontFamily: "'Geist', monospace", borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {summaryCopied ? '✓ 已複製' : '📋 複製'}
                </button>
                <button className="w-8 h-8 rounded flex items-center justify-center border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  title="重新產生">
                  ↻
                </button>
              </div>
            </div>
            <p className="text-[15px] leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text-muted)' }}>
              {summary}
            </p>
            <div className="flex gap-4 mt-4 pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
              <span className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                回合數: {topic.session_count}
              </span>
              <span className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                訊息數: {topic.message_count_exported}
              </span>
              <span className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                預估字元數: ~{totalTokens.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Messages by session */}
          {groupBySession(topic.messages, topic.sessions).map((group, gi) => (
            <div key={group.sessionId} className="space-y-6">
              {gi > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--card-border)' }} />
                  <span className="text-[11px] px-3 py-1 rounded-full border" style={{ fontFamily: "'Geist', monospace", borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                    第 {gi + 1} 段對話
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--card-border)' }} />
                </div>
              )}

              {group.messages.map((msg, mi) => {
                if (!msg.content) return null
                const isUser = msg.role === 'user'
                const pc = PLATFORM_COLORS[msg.platform || '']

                return isUser ? (
                  <div key={mi} className="flex justify-end">
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1.5 justify-end">
                        <span className="text-[12px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>你</span>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center border" style={{ borderColor: 'var(--border)' }}>
                          <span className="text-[10px]">👤</span>
                        </div>
                      </div>
                      <div className="rounded-2xl rounded-tr-sm p-4 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                        <p className="text-[14px] leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text)' }}>
                          {msg.content.slice(0, 2000)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={mi}>
                    {/* Model header */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center border relative" style={{ backgroundColor: pc?.bg || 'transparent', borderColor: pc?.dot || 'var(--border)' }}>
                          <span className="text-[14px]" style={{ color: pc?.dot }}>{MODEL_ICONS[msg.platform || ''] || '◆'}</span>
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full border" style={{ backgroundColor: '#4edea3', borderColor: 'var(--bg-deep)' }} />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-semibold flex items-center gap-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: pc?.dot || 'var(--text)' }}>
                            {MODEL_NAMES[msg.platform || '']?.name || pc?.label || '助手'}
                            <span className="px-1.5 py-0.5 rounded text-[10px] border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--text-muted)', fontFamily: "'Geist', monospace" }}>
                              {MODEL_NAMES[msg.platform || '']?.version || 'v1'}
                            </span>
                          </h4>
                          <span className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                            回應 · {(msg.content?.length || 0)} 字元
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.content || '')}
                        className="px-3 py-1.5 rounded text-[12px] border transition-colors flex items-center gap-1.5"
                        style={{ fontFamily: "'Geist', monospace", borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                      >
                        📋 複製
                      </button>
                    </div>
                    {/* Content */}
                    <div className="rounded-xl p-4 border-l-2" style={{ backgroundColor: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(12px)', borderColor: pc?.dot || 'var(--border)', borderLeftColor: pc?.dot }}>
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text)' }}>
                        {msg.content.slice(0, 4000)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </main>
    </div>
  )
}

function groupBySession(
  messages: UnifiedMessage[],
  sessions: Topic['sessions']
): { sessionId: string; platform?: string; messages: UnifiedMessage[] }[] {
  const groups: { sessionId: string; platform?: string; messages: UnifiedMessage[] }[] = []
  let current: { sessionId: string; platform?: string; messages: UnifiedMessage[] } | null = null

  for (const msg of messages) {
    const sid = msg.session_id || 'unknown'
    if (!current || current.sessionId !== sid) {
      const session = sessions.find((s) => s.id === sid)
      current = { sessionId: sid, platform: msg.platform || session?.platform, messages: [] }
      groups.push(current)
    }
    current.messages.push(msg)
  }
  return groups
}
