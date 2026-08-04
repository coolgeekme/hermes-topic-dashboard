import { useState } from 'react'
import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'

interface Props {
  topic: Topic
  onClose: () => void
}

export function ContinueModal({ topic, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const isMultiPlatform = topic.platforms && topic.platforms.length > 1
  const isMultiSession = topic.session_count > 1

  // Build context from last messages
  const recentMessages = topic.messages.slice(-8)
  const contextSummary = recentMessages
    .filter((m) => m.content)
    .map((m) => {
      const platform = m.platform ? `[${m.platform}] ` : ''
      return `${platform}${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content?.slice(0, 250)}${(m.content?.length ?? 0) > 250 ? '...' : ''}`
    })
    .join('\n\n')

  // Get latest sessions per platform for resume
  const sessionsByPlatform: Record<string, typeof topic.sessions> = {}
  for (const s of topic.sessions) {
    if (!sessionsByPlatform[s.platform]) sessionsByPlatform[s.platform] = []
    sessionsByPlatform[s.platform].push(s)
  }

  async function handleCopy() {
    const text = `[Continuing topic: "${topic.name}" — ${topic.message_count_exported} messages across ${topic.session_count} sessions on ${(topic.platforms || []).join(', ')}]\n\n${contextSummary}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass rounded-2xl p-5 w-full max-w-md animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-0.5">Continue "{topic.name}"</h3>

        {/* Multi-platform / multi-session explanation */}
        {(isMultiPlatform || isMultiSession) && (
          <div className="mb-4 p-3 rounded-xl bg-accent-cyan/5 border border-accent-cyan/10 text-xs text-white/50 leading-relaxed">
            {isMultiPlatform && (
              <p className="mb-2">
                This topic spans <strong className="text-white/70">{topic.platforms?.length} platforms</strong> —{' '}
                {(topic.platforms || []).map((p) => PLATFORM_COLORS[p]?.label || p).join(', ')}.
                Each platform's sessions are listed below with their own resume commands.
              </p>
            )}
            <p>
              <strong className="text-white/70">Copy context</strong> to bring everything into a fresh session on any platform.
              Or <strong className="text-white/70">resume</strong> a specific session to pick up exactly where you left off.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {/* Copy context */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-card/60 border border-surface-border hover:border-accent-cyan/20 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white/80">
                {copied ? '✓ Copied!' : 'Copy context to clipboard'}
              </div>
              <div className="text-[11px] text-white/30 truncate">
                Paste into any agent to continue
              </div>
            </div>
          </button>

          {/* Resume per platform */}
          {Object.entries(sessionsByPlatform).map(([platform, sessions]) => {
            const pc = PLATFORM_COLORS[platform]
            const latest = sessions[sessions.length - 1]
            if (!latest?.resume_command) return null
            
            return (
              <div key={platform} className="p-3 rounded-xl bg-surface-card/60 border border-surface-border">
                <div className="flex items-center gap-2 mb-2">
                  {pc && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: pc.bg, color: pc.dot }}
                    >
                      {pc.label}
                    </span>
                  )}
                  <span className="text-xs text-white/25">
                    {sessions.length} session{sessions.length > 1 ? 's' : ''}
                  </span>
                </div>
                <code className="block w-full p-2 bg-surface/80 rounded-lg text-[11px] text-white/35 font-mono select-all break-all">
                  {latest.resume_command}
                </code>
                {sessions.length > 1 && (
                  <div className="mt-2 space-y-0.5">
                    {sessions.slice(-3).map((s) => (
                      <div key={s.id} className="text-[9px] text-white/15 font-mono truncate">
                        {s.id === latest.id ? '→ ' : '  '}{s.id.slice(0, 20)}...
                        {s.title && ` — ${s.title.slice(0, 30)}`}
                        {s.id === latest.id && ' (latest)'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 text-sm text-white/25 hover:text-white/40 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
