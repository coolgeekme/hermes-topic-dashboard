import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'

interface NavItem { key: string; label: string; icon: string; test: (t: Topic) => boolean }

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
  activeNav: string
  onNavChange: (k: string) => void
  navItems: NavItem[]
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

const materialIcon = (name: string) => {
  const icons: Record<string, string> = {
    select_all: '☰', history: '◷', group: '👥', code: '</>', smart_toy: '◆', person: '●',
    search: '⌕', refresh: '↻', settings: '⚙',
  }
  return icons[name] || '○'
}

export function TopicList({ topics, allTopics, search, onSearchChange, onSelectTopic, refreshing, onRefresh, platforms, platformFilter, onPlatformFilterChange, activeNav, onNavChange, navItems }: Props) {
  return (
    <div className="flex h-screen bg-[#131315] overflow-hidden">
      {/* Sidebar */}
      <nav className="w-64 flex-shrink-0 flex flex-col border-r border-[#444748] bg-[#131315] px-10 py-8">
        <div className="mb-12">
          <h1 className="text-[20px] font-medium text-[#e4e2e4] tracking-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Conversations</h1>
          <p className="text-[11px] text-[#8e9192] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>AI Workspace</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const active = activeNav === item.key
            const count = item.key === 'all' ? allTopics.length : allTopics.filter(item.test).length
            return (
              <button
                key={item.key}
                onClick={() => onNavChange(item.key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] transition-colors text-left`}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: active ? '#ffffff' : '#c4c7c8',
                  backgroundColor: active ? '#1b1b1d' : 'transparent',
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span className="text-[16px] w-5 text-center opacity-60">{materialIcon(item.icon)}</span>
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex-shrink-0 sticky top-0 bg-[#131315]/95 backdrop-blur-sm z-40 flex items-center justify-between px-10 py-6">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8e9192] text-[16px]">{materialIcon('search')}</span>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#1f1f21] border border-[#444748]/50 rounded-full py-2.5 pl-12 pr-4 text-[15px] text-[#e4e2e4] placeholder-[#8e9192]/70 outline-none focus:border-[#8e9192] transition-colors"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-8">
            <button onClick={onRefresh} disabled={refreshing} className="p-2 rounded-full hover:bg-[#2a2a2c] transition-colors text-[#c4c7c8]">
              <span className={`text-[20px] ${refreshing ? 'animate-spin inline-block' : ''}`}>{materialIcon('refresh')}</span>
            </button>
          </div>
        </header>

        {/* Platform Filters */}
        {platforms && platforms.length > 1 && (
          <div className="flex-shrink-0 px-10 pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => onPlatformFilterChange?.('all')}
              className={`rounded-full text-[11px] px-4 py-1.5 border transition-colors whitespace-nowrap`}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: platformFilter === 'all' ? '#1f1f21' : 'transparent',
                color: platformFilter === 'all' ? '#e4e2e4' : '#8e9192',
                borderColor: platformFilter === 'all' ? '#444748' : 'transparent',
              }}>All</button>
            {platforms.map((p) => {
              const pc = PLATFORM_COLORS[p]; if (!pc) return null
              const active = platformFilter === p
              return (
                <button key={p} onClick={() => onPlatformFilterChange?.(p)}
                  className="rounded-full text-[11px] px-4 py-1.5 border transition-colors whitespace-nowrap"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    backgroundColor: active ? pc.bg : 'transparent',
                    color: active ? pc.dot : '#8e9192',
                    borderColor: active ? `${pc.dot}40` : 'transparent',
                  }}>{pc.label}</button>
              )
            })}
          </div>
        )}

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto px-10 pb-12">
          {topics.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#8e9192] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>No conversations found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {topics.map((topic) => {
                const platLabel = topic.platforms?.includes('claude-code') ? 'CLAUDE'
                  : topic.is_cron ? 'SYSTEM' : 'HERMES'
                const platDot = topic.platforms?.includes('claude-code') ? '#D4A373'
                  : topic.is_cron ? '#8e9192' : '#3e90ff'

                return (
                  <button
                    key={topic.id}
                    onClick={() => onSelectTopic(topic)}
                    className="bg-[#1b1b1d] border border-[#444748]/40 rounded-xl p-5 hover:border-[#444748]/80 hover:bg-[#2a2a2c] transition-all duration-300 group cursor-pointer flex flex-col h-[140px] text-left shadow-[0_4px_32px_rgba(0,0,0,0.15)]"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: platDot }} />
                        <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8e9192' }}>{platLabel}</span>
                      </div>
                      <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(142,145,146,0.6)' }}>{timeAgo(topic.last_active)}</span>
                    </div>
                    <h3 className="text-[15px] font-medium text-[#e4e2e4] group-hover:text-white transition-colors line-clamp-2 leading-snug" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                      {topic.name}
                    </h3>
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
        </div>
      </main>
    </div>
  )
}
