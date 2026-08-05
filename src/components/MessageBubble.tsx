import { useState } from 'react'
import { PLATFORM_COLORS } from '../hooks'
import type { UnifiedMessage } from '../types'

const COLLAPSE_LENGTH = 600

interface Props {
  message: UnifiedMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  
  if (isTool) return null
  if (!isUser && !(message.content || '').trim()) return null

  const content = message.content || ''
  const platformColor = message.platform ? PLATFORM_COLORS[message.platform] : null
  const isLong = content.length > COLLAPSE_LENGTH
  const [expanded, setExpanded] = useState(false)
  const displayText = isLong && !expanded ? content.slice(0, COLLAPSE_LENGTH) : content

  return (
    <div className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
        style={isUser ? {
          backgroundColor: 'rgba(34,211,238,0.08)',
          border: '1px solid rgba(34,211,238,0.15)',
          color: 'var(--text)',
        } : {
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          color: 'var(--text)',
        }}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {decodeContent(displayText)}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] mt-1 transition-colors"
            style={{ color: '#22d3ee', opacity: 0.6 }}
          >
            {expanded ? 'Show less' : `Show more (${Math.round((content.length - COLLAPSE_LENGTH) / 1000)}K more)`}
          </button>
        )}
        <div className="flex items-center justify-between mt-1">
          {message.timestamp && (
            <div className="text-[10px]" style={{ color: isUser ? 'rgba(34,211,238,0.4)' : 'var(--text-subtle)' }}>
              {formatTime(message.timestamp)}
            </div>
          )}
          {platformColor && (
            <span className="text-[8px] px-1 rounded font-medium ml-auto" style={{ color: platformColor.dot, opacity: 0.5 }}>
              {platformColor.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function decodeContent(text: string): string {
  if (text.startsWith('[B64]')) {
    try { return atob(text.slice(5)) } catch { /* leave as-is */ }
  }
  return text
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return '' }
}
