import { PLATFORM_COLORS } from '../hooks'
import type { UnifiedMessage } from '../types'

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

  return (
    <div className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? 'bg-accent-cyan/10 border border-accent-cyan/15 text-white/85'
          : 'bg-surface-card/80 border border-surface-border text-white/75'
      }`}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {formatContent(content)}
        </div>
        <div className="flex items-center justify-between mt-1">
          {message.timestamp && (
            <div className={`text-[10px] ${isUser ? 'text-accent-cyan/30' : 'text-white/20'}`}>
              {formatTime(message.timestamp)}
            </div>
          )}
          {platformColor && (
            <span
              className="text-[8px] px-1 rounded font-medium ml-auto"
              style={{ color: platformColor.dot, opacity: 0.5 }}
            >
              {platformColor.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatContent(text: string): string {
  if (text.length > 1500) {
    return text.slice(0, 1500) + '\n\n... [truncated]'
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
