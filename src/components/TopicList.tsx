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
  { dot: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },   // cyan
  { dot: '#a855f7', bg: 'rgba(168,85,247,0.08)' },    // purple
  { dot: '#34d399', bg: 'rgba(52,211,153,0.08)' },    // green
  { dot: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },    // blue
  { dot: '#f472b6', bg: 'rgba(244,114,182,0.08)' },   // pink
  { dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },    // amber
]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(ts * 1000).toLocaleDateString()
}

export function TopicList({ topics, search, onSearchChange, onSelectTopic, generatedAt, refreshing, onRefresh, totalTopics }: Props) {
  return (
    <div className="flex flex-col min-h-[var(--app-height)]">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
            Hermes Topics
          </h1>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <svg className={`w-4 h-4 text-white/40 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="text-white/20 text-[11px]">
          {totalTopics ?? topics.length} topics{generatedAt ? ` · updated ${timeAgo(new Date(generatedAt).getTime() / 1000)}` : ''}
        </p>
      </header>

      {/* Search */}
      <div className="flex-shrink-0 px-4 pb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search topics or messages..."
            className="w-full pl-9 pr-4 py-2 bg-surface-card border border-surface-border rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-cyan/30 transition-colors"
          />
        </div>
      </div>

      {/* Topic Grid */}
      <main className="flex-1 overflow-y-auto px-3 pb-6">
        {topics.length === 0 ? (
          <div className="text-center py-16 text-white/20 text-sm">
            No topics match your search
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {topics.map((topic, i) => {
              const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]
              return (
                <button
                  key={topic.id}
                  onClick={() => onSelectTopic(topic)}
                  className="glass text-left rounded-xl p-3 transition-all hover:border-white/10 hover:translate-y-[-1px] active:scale-[0.98] animate-fade-in"
                >
                  <div className="flex flex-col h-full gap-1.5">
                    {/* Name + dot */}
                    <div className="flex items-start gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: accent.dot }}
                      />
                      <h3 className="font-medium text-white/85 text-xs leading-snug line-clamp-2">
                        {topic.name}
                      </h3>
                    </div>

                    {/* Stats + time row */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1 text-[10px] text-white/25">
                        <span>{topic.session_count} session{topic.session_count > 1 ? 's' : ''}</span>
                        {topic.message_count_exported > 0 && (
                          <>
                            <span>·</span>
                            <span>{topic.message_count_exported} msg{topic.message_count_exported > 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                      <span className="text-white/20 text-[10px] whitespace-nowrap">
                        {timeAgo(topic.last_active)}
                      </span>
                    </div>

                    {topic.is_cron && (
                      <span className="text-[9px] text-accent-purple/40 uppercase tracking-wider">Cron</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
