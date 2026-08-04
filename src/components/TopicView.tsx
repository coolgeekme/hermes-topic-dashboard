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

  // Group messages by session for visual breaks
  const sessionGroups = groupBySession(topic.messages, topic.sessions)

  return (
    <div className="flex flex-col min-h-[var(--app-height)] max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex-shrink-0 glass border-b border-surface-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white/90 truncate">{topic.name}</h2>
              {/* Platform badges */}
              <div className="flex gap-1 flex-shrink-0">
                {topic.platforms?.map((p) => {
                  const pc = PLATFORM_COLORS[p]
                  if (!pc) return null
                  return (
                    <span
                      key={p}
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: pc.bg, color: pc.dot }}
                    >
                      {pc.label}
                    </span>
                  )
                })}
              </div>
            </div>
            <p className="text-xs text-white/30">
              {topic.session_count} session{topic.session_count > 1 ? 's' : ''} · {topic.message_count_exported} messages
              {topic.platforms && topic.platforms.length > 1 && ' · cross-platform'}
            </p>
          </div>
          <button
            onClick={() => setShowContinue(true)}
            className="flex-shrink-0 px-3 py-1.5 bg-accent-cyan/10 text-accent-cyan rounded-lg border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-colors text-xs font-medium"
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
                  <div className="flex-1 h-px bg-surface-border" />
                  <div className="flex items-center gap-1.5">
                    {/* Session platform badge */}
                    {group.platform && PLATFORM_COLORS[group.platform] && (
                      <span
                        className="text-[8px] px-1 py-0.5 rounded-full font-medium uppercase"
                        style={{
                          backgroundColor: PLATFORM_COLORS[group.platform].bg,
                          color: PLATFORM_COLORS[group.platform].dot,
                        }}
                      >
                        {PLATFORM_COLORS[group.platform].label}
                      </span>
                    )}
                    <span className="text-[10px] text-white/20">Session {gi + 1}</span>
                  </div>
                  <div className="flex-1 h-px bg-surface-border" />
                </div>
              )}
              {group.messages.map((msg, mi) => (
                <MessageBubble
                  key={`${msg.session_id || group.sessionId}-${mi}`}
                  message={msg}
                />
              ))}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </main>

      {/* Continue Modal */}
      {showContinue && (
        <ContinueModal
          topic={topic}
          onClose={() => setShowContinue(false)}
        />
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
      // Look up platform from sessions
      const session = sessions.find((s) => s.id === sid)
      current = { sessionId: sid, platform: msg.platform || session?.platform, messages: [] }
      groups.push(current)
    }
    current.messages.push(msg)
  }
  return groups
}
