import type { Topic } from '../types'

interface Props {
  topics: Topic[]
  search: string
  onSearchChange: (s: string) => void
  onSelectTopic: (t: Topic) => void
  generatedAt?: string
  refreshing: boolean
  onRefresh: () => void
  totalTopics?: number
}

const ACCENT_COLORS = [
  'bg-accent-cyan',
  'bg-accent-purple',
  'bg-accent-green',
  'bg-accent-blue',
  'bg-accent-pink',
  'bg-accent-amber',
]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts * 1000).toLocaleDateString()
}

export function TopicList({ topics, search, onSearchChange, onSelectTopic, generatedAt, refreshing, onRefresh, totalTopics }: Props) {
  return (
    <div className="flex flex-col min-h-[var(--app-height)] max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
            Hermes Topics
          </h1>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <svg className={`w-4 h-4 text-white/40 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="text-white/30 text-xs">
          {totalTopics ?? topics.length} topics • {generatedAt ? `updated ${timeAgo(new Date(generatedAt).getTime() / 1000)}` : ''}
        </p>
      </header>

      {/* Search */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search topics or messages..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-card border border-surface-border rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-cyan/30 transition-colors"
          />
        </div>
      </div>

      {/* Topic List */}
      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {topics.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            No topics match your search
          </div>
        ) : (
          <div className="space-y-2">
            {topics.map((topic, i) => (
              <button
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className="topic-accent glass w-full text-left rounded-xl p-4 transition-all hover:translate-x-0.5 active:scale-[0.99]"
                style={{ '--accent': ACCENT_COLORS[i % ACCENT_COLORS.length] } as any}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`} />
                <div className="pl-1">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <h3 className="font-medium text-white/90 text-sm truncate">{topic.name}</h3>
                    <span className="text-white/25 text-xs whitespace-nowrap flex-shrink-0">
                      {timeAgo(topic.last_active)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    <span>{topic.session_count} session{topic.session_count > 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{topic.message_count_exported} messages</span>
                    {topic.is_cron && (
                      <>
                        <span>·</span>
                        <span className="text-accent-purple/60">cron</span>
                      </>
                    )}
                  </div>
                  {topic.preview && (
                    <p className="text-white/20 text-xs mt-2 line-clamp-1">{topic.preview}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
