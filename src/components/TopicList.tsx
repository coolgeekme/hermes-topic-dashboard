import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'

interface CategoryDef { key: string; label: string; icon: string; test: (t: Topic) => boolean }

interface Props {
  topics: Topic[]
  allTopics: Topic[]
  search: string
  onSearchChange: (s: string) => void
  onSelectTopic: (t: Topic) => void
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

function platformLabel(topic: Topic): { dot: string; label: string } {
  if (topic.platforms?.includes('claude-code')) return { dot: '#D4A373', label: 'CLAUDE' }
  if (topic.is_cron) return { dot: '#8e9192', label: 'SYSTEM' }
  return { dot: '#3e90ff', label: 'HERMES' }
}

export function TopicList({ topics, allTopics, search, onSearchChange, onSelectTopic, refreshing, onRefresh, platforms, platformFilter, onPlatformFilterChange, activeCategory, onCategoryChange, categories }: Props) {
  return (
    <div className="flex flex-col min-h-[var(--app-height)] bg-[#131315]">
      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 bg-[#131315]/95 backdrop-blur-sm z-40 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-medium text-[#e4e2e4] tracking-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Conversations</h1>
          <button onClick={onRefresh} disabled={refreshing} className="p-2 rounded-full hover:bg-[#2a2a2c] transition-colors">
            <svg className={`w-5 h-5 text-[#8e9192] ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e9192]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-[#1f1f21] border border-[#444748]/50 rounded-full py-2.5 pl-12 pr-4 text-[15px] text-[#e4e2e4] placeholder-[#8e9192]/70 outline-none focus:border-[#8e9192] transition-colors"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          />
        </div>
      </header>

      {/* Category sidebar + platform filters */}
      <div className="flex-shrink-0 px-5 pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const active = activeCategory === cat.key
          const count = cat.key === 'all' ? allTopics.length : allTopics.filter(cat.test).length
          return (
            <button key={cat.key} onClick={() => onCategoryChange(cat.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap flex-shrink-0`}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: active ? '#1f1f21' : 'transparent',
                color: active ? '#e4e2e4' : '#8e9192',
                border: active ? '1px solid #444748' : '1px solid transparent',
              }}
            >
              {cat.icon && <span className="text-sm">{cat.icon}</span>}
              {cat.label}
              {count > 0 && <span style={{ color: active ? '#8e9192' : '#444748' }} className="text-[11px]">{count}</span>}
            </button>
          )
        })}
        {/* Platform filter */}
        {platforms && platforms.length > 1 && (
          <>
            <span className="w-px h-5 bg-[#444748]/30 mx-1" />
            <button onClick={() => onPlatformFilterChange?.('all')}
              className={`rounded-full text-[13px] px-3 py-1.5 border transition-colors whitespace-nowrap flex-shrink-0`}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: platformFilter === 'all' ? '#1f1f21' : 'transparent',
                color: platformFilter === 'all' ? '#e4e2e4' : '#8e9192',
                borderColor: platformFilter === 'all' ? '#444748' : 'transparent',
              }}>All</button>
            {platforms.map((p) => {
              const pc = PLATFORM_COLORS[p]; if (!pc) return null
              const active = platformFilter === p
              return <button key={p} onClick={() => onPlatformFilterChange?.(p)}
                className="rounded-full text-[13px] px-3 py-1.5 border transition-colors whitespace-nowrap flex-shrink-0"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  backgroundColor: active ? pc.bg : 'transparent',
                  color: active ? pc.dot : '#8e9192',
                  borderColor: active ? pc.dot + '40' : 'transparent',
                }}>{pc.label}</button>
            })}
          </>
        )}
      </div>

      {/* Card Grid */}
      <main className="flex-1 overflow-y-auto px-5 pb-12">
        {topics.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#8e9192] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>No conversations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {topics.map((topic) => {
              const pl = platformLabel(topic)
              return (
                <button key={topic.id} onClick={() => onSelectTopic(topic)}
                  className="glass text-left rounded-xl p-5 hover:border-[#444748]/80 hover:bg-[#2a2a2c] transition-all duration-300 group cursor-pointer flex flex-col h-[140px]">
                  {/* Top row: platform badge + time */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: pl.dot }} />
                      <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8e9192' }}>{pl.label}</span>
                    </div>
                    <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(142,145,146,0.6)' }}>{timeAgo(topic.last_active)}</span>
                  </div>
                  {/* Title */}
                  <h3 className="text-[15px] font-medium text-[#e4e2e4] group-hover:text-white transition-colors line-clamp-2 leading-snug" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                    {topic.name}
                  </h3>
                  {/* Bottom stats */}
                  <div className="mt-auto flex items-center gap-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'rgba(142,145,146,0.5)' }}>
                    <span>{topic.session_count}s</span>
                    <span>·</span>
                    <span>{topic.message_count_exported}m</span>
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
