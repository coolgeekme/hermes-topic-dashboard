import { useState } from 'react'
import type { Topic } from '../types'

interface Props {
  topic: Topic
  onClose: () => void
}

export function ContinueModal({ topic, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  // Get latest session ID
  const latestSession = [...topic.sessions].sort().pop() || ''

  // Build context summary from last few messages
  const recentMessages = topic.messages.slice(-6)
  const contextSummary = recentMessages
    .filter((m) => m.content)
    .map((m) => `${m.role === 'user' ? 'You' : 'Hermes'}: ${m.content?.slice(0, 200)}${(m.content?.length ?? 0) > 200 ? '...' : ''}`)
    .join('\n\n')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contextSummary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = contextSummary
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass rounded-2xl p-6 w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Continue "{topic.name}"</h3>
        <p className="text-white/40 text-sm mb-6">
          Pick up where you left off. Here are your options:
        </p>

        {/* Option 1: Copy context */}
        <div className="space-y-3">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-card/60 border border-surface-border hover:border-accent-cyan/20 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-white/80">
                {copied ? '✓ Copied!' : 'Copy context to clipboard'}
              </div>
              <div className="text-xs text-white/30">
                Paste into a new Hermes session to continue
              </div>
            </div>
          </button>

          {/* Option 2: Resume latest session */}
          {latestSession && (
            <div className="p-3 rounded-xl bg-surface-card/60 border border-surface-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white/80">Resume latest session</div>
                  <div className="text-xs text-white/30">Open in Hermes Desktop</div>
                </div>
              </div>
              <code className="block w-full p-2 bg-surface/80 rounded-lg text-xs text-white/40 font-mono select-all">
                hermes --resume {latestSession}
              </code>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
