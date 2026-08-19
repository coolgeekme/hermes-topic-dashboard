import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'
import { Sunburst } from './Sunburst'
import { Mindmap } from './Mindmap'
import { MeshGraph } from './MeshGraph'
import { Sidebar } from './Sidebar'

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
  navItems: (NavItem | null)[]
  pinned: Set<string>
  onTogglePin: (id: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  viewMode: 'cards' | 'sunburst' | 'mindmap' | 'mesh'
  onToggleView: () => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天`
  return new Date(ts * 1000).toLocaleDateString('zh-Hant', { month: 'numeric', day: 'numeric' })
}

const Icons: Record<string, string> = {
  select_all: '☰', history: '◷', group: '👥', code: '</>', smart_toy: '◆', person: '●',
  search: '⌕', refresh: '↻', push_pin: '📌',
}

export function TopicList({ topics, allTopics, search, onSearchChange, onSelectTopic, refreshing, onRefresh, platforms, platformFilter, onPlatformFilterChange, activeNav, onNavChange, navItems, pinned, onTogglePin, theme, onToggleTheme, viewMode, onToggleView }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={onNavChange}
        navItems={navItems}
        allTopics={allTopics}
        pinned={pinned}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex-shrink-0 sticky top-0 z-40 flex items-center justify-between px-10 py-6" style={{ backgroundColor: 'var(--topbar-bg)', backdropFilter: 'blur(12px)' }}>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px]" style={{ color: 'var(--text-muted)' }}>{Icons.search}</span>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="搜尋對話..."
                className="w-full rounded-full py-2.5 pl-12 pr-4 text-[15px] outline-none transition-colors"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  backgroundColor: 'var(--input-bg)',
                  border: `1px solid var(--input-border)`,
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-8">
            <button onClick={onToggleView} className="p-2 rounded-full transition-colors" style={{ color: 'var(--sidebar-text)' }} title={viewMode === 'cards' ? '旭日圖檢視' : '卡片檢視'}>
              <span className="text-[18px]">{viewMode === 'cards' ? '⊚' : viewMode === 'sunburst' ? '◉' : '⊞'}</span>
            </button>
            <button onClick={onRefresh} disabled={refreshing} className="p-2 rounded-full transition-colors" style={{ color: 'var(--sidebar-text)' }}>
              <span className={`text-[20px] ${refreshing ? 'animate-spin inline-block' : ''}`}>{Icons.refresh}</span>
            </button>
          </div>
        </header>

        {/* Platform Filters */}
        {platforms && platforms.length > 1 && (
          <div className="flex-shrink-0 px-10 pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => onPlatformFilterChange?.('all')}
              className="rounded-full text-[11px] px-4 py-1.5 border transition-colors whitespace-nowrap"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: platformFilter === 'all' ? 'var(--filter-bg)' : 'transparent',
                color: platformFilter === 'all' ? 'var(--filter-active-text)' : 'var(--filter-text)',
                borderColor: platformFilter === 'all' ? 'var(--filter-active-border)' : 'transparent',
              }}>全部</button>
            {platforms.map((p) => {
              const pc = PLATFORM_COLORS[p]; if (!pc) return null
              const active = platformFilter === p
              return (
                <button key={p} onClick={() => onPlatformFilterChange?.(p)}
                  className="rounded-full text-[11px] px-4 py-1.5 border transition-colors whitespace-nowrap"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    backgroundColor: active ? pc.bg : 'transparent',
                    color: active ? pc.dot : 'var(--filter-text)',
                    borderColor: active ? `${pc.dot}40` : 'transparent',
                  }}>{pc.label}</button>
              )
            })}
          </div>
        )}

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto px-10 pb-12">
          {/* Stats bar */}
          <div className="flex items-center gap-6 mb-6 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
            <span>{allTopics.length} 則對話</span>
            {platforms && platforms.length > 1 && <span>跨 {platforms.length} 個平台</span>}
            <span>{allTopics.reduce((s, t) => s + t.message_count_exported, 0).toLocaleString()} 則訊息</span>
            {pinned.size > 0 && <span style={{ color: 'var(--text)' }}>{pinned.size} 則已釘選</span>}
          </div>

          {viewMode === 'sunburst' ? (
            <Sunburst topics={topics} onSelectTopic={onSelectTopic} />
          ) : viewMode === 'mindmap' ? (
            <Mindmap topics={topics} onSelectTopic={onSelectTopic} />
          ) : viewMode === 'mesh' ? (
            <MeshGraph topics={topics} onSelectTopic={onSelectTopic} />
          ) : topics.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text-muted)' }}>
                {activeNav === 'pinned' ? '沒有已釘選對話' : '找不到對話'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {topics.map((topic) => {
                const pc = PLATFORM_COLORS[topic.platforms?.[0] || '']
                const accentColor = pc?.dot || '#958da1'
                const isPinned = pinned.has(topic.id)
                const category = topic.platforms?.includes('claude-code') ? '開發'
                  : /instagram|linkedin|social/i.test(topic.name) ? '行銷'
                  : /github|repo|code|build|app|api|deploy/i.test(topic.name) ? '開發'
                  : /ollama|llm|model|ai|agent|hermes/i.test(topic.name) ? '研究'
                  : /email|gmail|calendar|room|clean|buy/i.test(topic.name) ? '個人'
                  : topic.is_cron ? '系統' : '研究'

                return (
                  <button
                    key={topic.id}
                    onClick={() => onSelectTopic(topic)}
                    className="rounded-xl overflow-hidden flex flex-col relative group transition-all duration-300 text-left cursor-pointer"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget
                      el.style.borderColor = 'var(--card-hover-border)'
                      el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget
                      el.style.borderColor = 'var(--card-border)'
                      el.style.boxShadow = ''
                    }}
                  >
                    {/* Colored top accent bar */}
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}80` }} />

                    {/* Header: icon + category + time */}
                    <div className="p-4 border-b flex justify-between items-start" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-nav)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--card-border)', color: accentColor }}>
                          <span className="text-[20px]">{pc?.label === 'Claude' ? '🧠' : pc?.label === 'ChatGPT' ? '💬' : '◆'}</span>
                        </div>
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border mb-1"
                            style={{ backgroundColor: pc?.bg || 'rgba(149,141,161,0.1)', color: accentColor, borderColor: accentColor + '30' }}>
                            {category}
                          </span>
                          <h3 className="text-[15px] font-semibold line-clamp-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>
                            {topic.name.slice(0, 60)}
                          </h3>
                          <span className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                            最近 {timeAgo(topic.last_active)}
                          </span>
                        </div>
                      </div>
                      {/* Pin */}
                      <span
                        onClick={(e) => { e.stopPropagation(); onTogglePin(topic.id) }}
                        className="p-1 rounded-md transition-colors"
                        style={{ fontSize: '14px', opacity: isPinned ? 0.8 : 0.2, filter: isPinned ? 'none' : 'grayscale(1)' }}
                        title={isPinned ? '取消釘選' : '釘選'}
                      >📌</span>
                    </div>

                    {/* Stats */}
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--card-border)' }}>
                          <span className="block mb-1 text-[10px] uppercase tracking-wider" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>對話回合</span>
                          <span className="font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>{topic.session_count}</span>
                        </div>
                        <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--card-border)' }}>
                          <span className="block mb-1 text-[10px] uppercase tracking-wider" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>訊息數</span>
                          <span className="font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>{topic.message_count_exported}</span>
                        </div>
                      </div>
                      {/* Platform chip */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(topic.platforms || []).map((p) => {
                          const c = PLATFORM_COLORS[p]
                          if (!c) return null
                          return (
                            <span key={p} className="px-2 py-1 rounded-md text-[11px] font-medium border" style={{ fontFamily: "'Geist', monospace", backgroundColor: c.bg, borderColor: c.dot + '40', color: c.dot }}>
                              {c.label}
                            </span>
                          )
                        })}
                      </div>
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
