import { useState, useRef, useEffect } from 'react'
import { PLATFORM_COLORS } from '../hooks'
import type { Topic, UnifiedMessage } from '../types'
import { MessageBubble } from './MessageBubble'
import { ContinueModal } from './ContinueModal'

interface Props {
  topic: Topic
  onBack: () => void
}

export function TopicView({ topic, onBack }: Props) {
  const [showContinue, setShowContinue] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const sessionGroups = groupBySession(topic.messages, topic.sessions)

  return (
    <div className="flex flex-col min-h-[var(--app-height)] max-w-2xl mx-auto" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sticky Header */}
      <header className="flex-shrink-0 sticky top-0 z-30 px-4 py-3" style={{ backgroundColor: 'var(--topbar-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-lg hover:opacity-70 transition-opacity"
          >
            <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{topic.name}</h2>
              <div className="flex gap-1 flex-shrink-0">
                {topic.platforms?.map((p) => {
                  const pc = PLATFORM_COLORS[p]
                  if (!pc) return null
                  return (
                    <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: pc.bg, color: pc.dot }}>{pc.label}</span>
                  )
                })}
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {topic.session_count} session{topic.session_count > 1 ? 's' : ''} · {topic.message_count_exported} messages
            </p>
          </div>
          <button
            onClick={() => setShowContinue(true)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            style={{ backgroundColor: 'rgba(34,211,238,0.08)', color: '#22d3ee', borderColor: 'rgba(34,211,238,0.2)' }}
          >
            Continue
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          {sessionGroups.map((group, gi) => (
            <div key={group.sessionId}>
              {gi > 0 && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--card-border)' }} />
                  <div className="flex items-center gap-1.5">
                    {group.platform && PLATFORM_COLORS[group.platform] && (
                      <span className="text-[8px] px-1 py-0.5 rounded-full font-medium uppercase"
                        style={{ backgroundColor: PLATFORM_COLORS[group.platform].bg, color: PLATFORM_COLORS[group.platform].dot }}>
                        {PLATFORM_COLORS[group.platform].label}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Session {gi + 1}</span>
                  </div>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--card-border)' }} />
                </div>
              )}
              {group.messages.map((msg, mi) => (
                <MessageBubble key={`${msg.session_id || group.sessionId}-${mi}`} message={msg} />
              ))}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </main>

      {showContinue && (
        <ContinueModal topic={topic} onClose={() => setShowContinue(false)} />
      )}
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
