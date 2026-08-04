import { useState } from 'react'
import type { Topic } from '../types'

interface Props {
  topic: Topic
  onClose: () => void
}

export function ContinueModal({ topic, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  // Get latest session ID (the one you'd resume)
  const sortedSessions = [...topic.sessions].sort()
  const latestSession = sortedSessions[sortedSessions.length - 1] || ''
  
  // Build context summary from the LAST 8 messages across ALL sessions
  const recentMessages = topic.messages.slice(-8)
  const contextSummary = recentMessages
    .filter((m) => m.content)
    .map((m) => `${m.role === 'user' ? 'You' : 'Hermes'}: ${m.content?.slice(0, 250)}${(m.content?.length ?? 0) > 250 ? '...' : ''}`)
    .join('\n\n')

  async function handleCopy() {
    const text = `[Continuing topic: "${topic.name}" — context from ${topic.messages.length} messages across ${topic.session_count} sessions]\n\n${contextSummary}`
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

  const isMultiSession = topic.session_count > 1

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass rounded-2xl p-5 w-full max-w-md animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-0.5">Continue "{topic.name}"</h3>
        
        {/* Multi-session explanation */}
        {isMultiSession ? (
          <div className="mb-4 p-3 rounded-xl bg-accent-cyan/5 border border-accent-cyan/10 text-xs text-white/50 leading-relaxed">
            <p className="mb-2">
              This topic spans <strong className="text-white/70">{topic.session_count} sessions</strong> with{' '}
              <strong className="text-white/70">{topic.messages.length} messages</strong> merged chronologically.
            </p>
            <p>
              When you <strong className="text-white/70">resume</strong>, Hermes re-opens the <em>latest</em> session 
              — it already has full context from that session. Earlier sessions provide background 
              but aren't loaded into the model by default.
            </p>
            <p className="mt-2">
              For the richest context, <strong className="text-white/70">copy the summary</strong> and paste it 
              at the start of a fresh session. That way Hermes sees everything at once.
            </p>
          </div>
        ) : (
          <p className="text-white/35 text-xs mb-4">
            Single session · {topic.messages.length} messages
          </p>
        )}

        <div className="space-y-2.5">
          {/* Option 1: Copy context */}
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
                {isMultiSession 
                  ? `Last 8 messages from all ${topic.session_count} sessions`
                  : 'Paste into a new Hermes session'}
              </div>
            </div>
          </button>

          {/* Option 2: Resume latest session */}
          {latestSession && (
            <div className="p-3 rounded-xl bg-surface-card/60 border border-surface-border">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white/80">Resume latest session</div>
                  <div className="text-[11px] text-white/25">
                    {isMultiSession 
                      ? `Session ${topic.session_count} of ${topic.session_count} — ${sortedSessions.length} total in topic`
                      : 'Open directly in Hermes Desktop'}
                  </div>
                </div>
              </div>
              <code className="block w-full p-2 bg-surface/80 rounded-lg text-[11px] text-white/35 font-mono select-all break-all">
                hermes --resume {latestSession}
              </code>
            </div>
          )}

          {/* All sessions list (for multi-session topics) */}
          {isMultiSession && sortedSessions.length <= 8 && (
            <div className="p-3 rounded-xl bg-surface-card/40 border border-surface-border/50">
              <div className="text-[10px] text-white/20 uppercase tracking-wider mb-2">All sessions in this topic</div>
              <div className="space-y-1">
                {sortedSessions.map((sid, idx) => (
                  <div key={sid} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/15 w-4">{idx + 1}.</span>
                    <code className={`text-[10px] font-mono select-all ${sid === latestSession ? 'text-accent-cyan/50' : 'text-white/20'}`}>
                      {sid}
                      {sid === latestSession ? ' ← latest' : ''}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
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
