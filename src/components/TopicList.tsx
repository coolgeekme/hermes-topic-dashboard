import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'

interface CategoryDef {
  key: string
  label: string
  icon: string
  test: (t: Topic) => boolean
}

interface Props {
  topics: Topic[]
  allTopics: Topic[]
  search: string
  searchOpen: boolean
  onSearchChange: (s: string) => void
  onToggleSearch: () => void
  onSelectTopic: (t: Topic) => void
  generatedAt?: string
  refreshing: boolean
  onRefresh: () => void
  platforms?: string[]
  platformFilter?: string
  onPlatformFilterChange?: (p: string) => void
  activeCategory: string
  onCategoryChange: (k: string) => void
  categories: CategoryDef[]
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
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TopicList({ topics, allTopics, search, searchOpen, onSearchChange, onToggleSearch, onSelectTopic, refreshing, onRefresh, platforms, platformFilter, onPlatformFilterChange, activeCategory, onCategoryChange, categories }: Props) {
  return (
    <div className="flex flex-col min-h-[var(--app-height)]">
      {/* Header */}
      <header className="flex-shrink-0 px-5 pt-8 pb-2">
        <div className="flex items-center justify-between">
          {searchOpen ? (
            <div className="flex-1 flex items-center gap-3">
              <input
                type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search conversations..."
                autoFocus
                className="flex-1 bg-transparent text-white text-lg placeholder-white/20 outline-none"
              />
              <button onClick={onToggleSearch} className="text-accent-cyan text-sm font-medium">Cancel</button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-white/90 tracking-tight">Conversations</h1>
              <div className="flex items-center gap-2">
                <button onClick={onToggleSearch} className="p-2 -mr-2 rounded-full hover:bg-white/5 transition-colors">
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                <button onClick={onRefresh} disabled={refreshing} className="p-2 -mr-2 rounded-full hover:bg-white/5 transition-colors">
                  <svg className={`w-5 h-5 text-white/20 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Category Pills */}
      {!searchOpen && (
        <div className="flex-shrink-0 px-5 pt-1 pb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {categories.map((cat) => {
              const active = activeCategory === cat.key
              const count = cat.key === 'all' ? allTopics.length : allTopics.filter(cat.test).length
              return (
                <button
                  key={cat.key}
                  onClick={() => onCategoryChange(cat.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
                    active
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  {cat.icon && <span className="text-base">{cat.icon}</span>}
                  {cat.label}
                  {count > 0 && (
                    <span className={`text-xs ${active ? 'text-black/40' : 'text-white/20'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Platform chip (subtle, below pills) */}
      {!searchOpen && platforms && platforms.length > 1 && (
        <div className="flex-shrink-0 px-5 pb-4 flex gap-2">
          <button onClick={() => onPlatformFilterChange?.('all')}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${platformFilter === 'all' || !platformFilter ? 'bg-white/10 text-white/60' : 'text-white/20 hover:text-white/40'}`}>All</button>
          {platforms.map((p) => {
            const pc = PLATFORM_COLORS[p]; if (!pc) return null
            const active = platformFilter === p
            return <button key={p} onClick={() => onPlatformFilterChange?.(p)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{ backgroundColor: active ? pc.bg : 'transparent', color: active ? pc.dot : `${pc.dot}60` }}>{pc.label}</button>
          })}
        </div>
      )}

      {/* Topic List */}
      <main className="flex-1 overflow-y-auto px-5 pb-8">
        {topics.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/15 text-sm">No conversations found</p>
            {activeCategory !== 'all' && (
              <button onClick={() => onCategoryChange('all')} className="mt-2 text-accent-cyan/50 text-sm hover:text-accent-cyan transition-colors">Show all</button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className="w-full text-left px-3 py-3 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {/* Platform dots */}
                  <div className="flex -space-x-1">
                    {(topic.platforms || []).map((p, pi) => {
                      const pc = PLATFORM_COLORS[p]
                      return <div key={p} className="w-2.5 h-2.5 rounded-full border-2 border-surface"
                        style={{ backgroundColor: pc?.dot || '#666', zIndex: topic.platforms!.length - pi }} />
                    })}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] text-white/80 font-normal leading-snug truncate group-hover:text-white/95 transition-colors">
                      {topic.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/20">{topic.session_count} session{topic.session_count > 1 ? 's' : ''}</span>
                      {topic.message_count_exported > 0 && (
                        <span className="text-xs text-white/15">{topic.message_count_exported} msg{topic.message_count_exported > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-white/20">{timeAgo(topic.last_active)}</span>
                    <svg className="w-3.5 h-3.5 text-white/10 group-hover:text-white/25 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
