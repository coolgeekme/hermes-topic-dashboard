import { ACCENT_COLORS, PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'

interface Category {
  name: string
  icon: string
  topics: Topic[]
}

interface Props {
  categorized: Category[]
  allTopics: Topic[]
  search: string
  onSearchChange: (s: string) => void
  onSelectTopic: (t: Topic) => void
  generatedAt?: string
  refreshing: boolean
  lastRefresh?: string | null
  onRefresh: () => void
  totalTopics?: number
  platforms?: string[]
  platformFilter?: string
  onPlatformFilterChange?: (p: string) => void
  compact: boolean
  onToggleCompact: () => void
}

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

export function TopicList({ categorized, allTopics, search, onSearchChange, onSelectTopic, generatedAt, refreshing, lastRefresh, onRefresh, totalTopics, platforms, platformFilter, onPlatformFilterChange, compact, onToggleCompact }: Props) {
  const showCategories = !search.trim() && platformFilter === 'all'

  return (
    <div className="flex flex-col min-h-[var(--app-height)]">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent">
              Hermes Topics
            </h1>
            {platforms && platforms.length > 1 && (
              <span className="text-[10px] text-accent-purple/40 border border-accent-purple/20 rounded-full px-2 py-0.5">
                multi-platform
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCompact}
              className={`p-1.5 rounded-lg transition-colors ${compact ? 'bg-white/10 text-white/60' : 'hover:bg-white/5 text-white/30'}`}
              title={compact ? 'Grid view' : 'Compact view'}
            >
              {compact ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              )}
            </button>
            <button onClick={onRefresh} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50" title="Refresh data">
              <svg className={`w-4 h-4 text-white/40 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-white/20 text-[11px]">
          {totalTopics ?? allTopics.length} topics{generatedAt ? ` · updated ${timeAgo(new Date(generatedAt).getTime() / 1000)}` : ''}{lastRefresh ? ` · refreshed ${lastRefresh}` : ''}
        </p>
      </header>

      {/* Search + Filters */}
      <div className="flex-shrink-0 px-4 pb-2 space-y-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search topics..."
            className="w-full pl-9 pr-4 py-1.5 bg-surface-card border border-surface-border rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-cyan/30 transition-colors"
          />
        </div>
        {platforms && platforms.length > 1 && (
          <div className="flex gap-1.5">
            <button onClick={() => onPlatformFilterChange?.('all')}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${platformFilter === 'all' || !platformFilter ? 'bg-white/10 text-white/80' : 'bg-surface-card text-white/30 hover:text-white/50'}`}>All</button>
            {platforms.map((p) => {
              const pc = PLATFORM_COLORS[p]; if (!pc) return null
              const active = platformFilter === p
              return <button key={p} onClick={() => onPlatformFilterChange?.(p)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium"
                style={{ backgroundColor: active ? pc.bg : 'transparent', color: active ? pc.dot : `${pc.dot}80`, border: `1px solid ${active ? pc.dot : `${pc.dot}30`}` }}>{pc.label}</button>
            })}
          </div>
        )}
      </div>

      {/* Topic List */}
      <main className="flex-1 overflow-y-auto px-3 pb-6">
        {allTopics.length === 0 ? (
          <div className="text-center py-16 text-white/20 text-sm">No topics match your search</div>
        ) : showCategories ? (
          /* Categorized view */
          <div className="space-y-4">
            {categorized.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center gap-2 px-1 mb-1.5 sticky top-0 bg-surface/90 backdrop-blur-sm py-1 z-10">
                  <span className="text-sm">{cat.icon}</span>
                  <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{cat.name}</h2>
                  <span className="text-[10px] text-white/15">{cat.topics.length}</span>
                </div>
                {compact ? (
                  <CompactList topics={cat.topics} onSelect={onSelectTopic} />
                ) : (
                  <TopicGrid topics={cat.topics} onSelect={onSelectTopic} />
                )}
              </div>
            ))}
          </div>
        ) : compact ? (
          <CompactList topics={allTopics} onSelect={onSelectTopic} />
        ) : (
          <TopicGrid topics={allTopics} onSelect={onSelectTopic} />
        )}
      </main>
    </div>
  )
}

function TopicGrid({ topics, onSelect }: { topics: Topic[]; onSelect: (t: Topic) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {topics.map((topic, i) => {
        const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]
        const isMulti = topic.platforms && topic.platforms.length > 1
        return (
          <button key={topic.id} onClick={() => onSelect(topic)}
            className="glass text-left rounded-xl p-2.5 transition-all hover:border-white/10 hover:translate-y-[-1px] active:scale-[0.98] animate-fade-in">
            <div className="flex flex-col h-full gap-1">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isMulti ? '#fbbf24' : accent.dot }} />
                {topic.platforms && topic.platforms.map((p) => {
                  const pc = PLATFORM_COLORS[p]; if (!pc) return null
                  return <span key={p} className="text-[8px] px-1 py-0.5 rounded-full font-medium uppercase tracking-wider"
                    style={{ backgroundColor: pc.bg, color: pc.dot, border: `1px solid ${pc.dot}30` }}>{p === 'claude-code' ? 'CL' : 'HE'}</span>
                })}
              </div>
              <h3 className="font-medium text-white/85 text-[11px] leading-snug line-clamp-2">{topic.name}</h3>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] text-white/25">{topic.session_count}s · {topic.message_count_exported}m</span>
                <span className="text-white/15 text-[10px]">{timeAgo(topic.last_active)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CompactList({ topics, onSelect }: { topics: Topic[]; onSelect: (t: Topic) => void }) {
  return (
    <div className="space-y-0.5">
      {topics.map((topic, i) => {
        const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]
        return (
          <button key={topic.id} onClick={() => onSelect(topic)}
            className="glass w-full text-left rounded-lg px-3 py-2 flex items-center gap-3 transition-all hover:border-white/10 active:scale-[0.99]">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent.dot }} />
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span className="text-white/75 text-xs truncate">{topic.name}</span>
              <div className="flex items-center gap-2 text-[10px] text-white/25 flex-shrink-0">
                {topic.platforms?.map((p) => {
                  const pc = PLATFORM_COLORS[p]; if (!pc) return null
                  return <span key={p} style={{ color: pc.dot }}>{p === 'claude-code' ? 'CL' : 'HE'}</span>
                })}
                <span>{topic.session_count}s</span>
                <span>{timeAgo(topic.last_active)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
