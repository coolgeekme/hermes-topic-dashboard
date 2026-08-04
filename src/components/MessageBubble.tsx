import type { Message } from '../types'

interface Props {
  message: Message
  isLast: boolean
}

export function MessageBubble({ message, isLast }: Props) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  
  if (isTool) return null // Skip tool messages in the view

  const content = message.content || ''
  
  // Skip empty assistant messages (tool call placeholders)
  if (!isUser && !content.trim()) return null

  return (
    <div className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
         style={{ animationDelay: '0ms' }}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? 'bg-accent-cyan/10 border border-accent-cyan/15 text-white/85'
          : 'bg-surface-card/80 border border-surface-border text-white/75'
      }`}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {formatContent(content)}
        </div>
        {message.timestamp_iso && (
          <div className={`text-[10px] mt-1 ${isUser ? 'text-accent-cyan/30' : 'text-white/20'}`}>
            {formatTime(message.timestamp_iso)}
          </div>
        )}
      </div>
    </div>
  )
}

function formatContent(text: string): string {
  // Truncate very long messages
  if (text.length > 1500) {
    return text.slice(0, 1500) + '\n\n... [message truncated for dashboard view]'
  }
  return text
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
