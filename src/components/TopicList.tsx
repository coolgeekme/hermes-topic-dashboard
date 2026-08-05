import { PLATFORM_COLORS } from '../hooks'
import type { Topic } from '../types'
import { Sunburst } from './Sunburst'
import { Mindmap } from './Mindmap'

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
  pinned: Set<string>
  onTogglePin: (id: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  viewMode: 'cards' | 'sunburst' | 'mindmap'
  onToggleView: () => void
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

const Icons: Record<string, string> = {
  select_all: '☰', history: '◷', group: '👥', code: '</>', smart_toy: '◆', person: '●',
  search: '⌕', refresh: '↻', push_pin: '📌',
}

export function TopicList({ topics, allTopics, search, onSearchChange, onSelectTopic, refreshing, onRefresh, platforms, platformFilter, onPlatformFilterChange, activeNav, onNavChange, navItems, pinned, onTogglePin, theme, onToggleTheme, viewMode, onToggleView }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <nav className="w-64 flex-shrink-0 flex flex-col px-10 py-8" style={{ backgroundColor: 'var(--bg-nav)', borderRight: '1px solid var(--border)' }}>
        <div className="mb-12">
          <h1 className="text-[20px] font-medium tracking-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>Conversations</h1>
          <p className="text-[11px] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>AI Workspace</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const active = activeNav === item.key
            const count = item.key === 'all' ? allTopics.length
              : item.key === 'pinned' ? pinned.size
              : allTopics.filter(item.test).length
            return (
              <button
                key={item.key}
                onClick={() => onNavChange(item.key)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] transition-colors text-left"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span className="text-[16px] w-5 text-center opacity-60">{Icons[item.icon] || '○'}</span>
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Theme toggle */}
        <div className="mt-auto pt-6" style={{ borderTop: `1px solid var(--divider)` }}>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] transition-colors text-left hover:opacity-80"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--sidebar-text)' }}
          >
            <span className="text-[16px] w-5 text-center">{theme === 'dark' ? '☀' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </nav>

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
                placeholder="Search conversations..."
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
            <button onClick={onToggleView} className="p-2 rounded-full transition-colors" style={{ color: 'var(--sidebar-text)' }} title={viewMode === 'cards' ? 'Sunburst view' : 'Card view'}>
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
            <span>{allTopics.length} conversations</span>
            {platforms && platforms.length > 1 && <span>across {platforms.length} platforms</span>}
            <span>{allTopics.reduce((s, t) => s + t.message_count_exported, 0).toLocaleString()} messages</span>
            {pinned.size > 0 && <span style={{ color: 'var(--text)' }}>{pinned.size} pinned</span>}
          </div>

          {viewMode === 'sunburst' ? (
            <Sunburst topics={topics} onSelectTopic={onSelectTopic} />
          ) : viewMode === 'mindmap' ? (
            <Mindmap topics={topics} onSelectTopic={onSelectTopic} />
          ) : topics.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text-muted)' }}>
                {activeNav === 'pinned' ? 'No pinned conversations' : 'No conversations found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {topics.map((topic) => {
                const platDot = PLATFORM_COLORS[topic.platforms?.[0]]?.dot || '#8e9192'
                const platLabel = PLATFORM_COLORS[topic.platforms?.[0]]?.label
                  || (topic.platforms?.includes('claude-code') ? 'CLAUDE' : 'HERMES')
                const isPinned = pinned.has(topic.id)

                return (
                  <button
                    key={topic.id}
                    onClick={() => onSelectTopic(topic)}
                    className="glass rounded-xl p-5 group cursor-pointer flex flex-col h-[140px] text-left relative"
                  >
                    {/* Pin button */}
                    <span
                      onClick={(e) => { e.stopPropagation(); onTogglePin(topic.id) }}
                      className="absolute top-3 right-3 p-1 rounded-md transition-colors z-10"
                      style={{
                        fontSize: '14px',
                        opacity: isPinned ? 0.8 : 0,
                        filter: isPinned ? 'none' : 'grayscale(1)',
                        backgroundColor: 'transparent',
                      }}
                      title={isPinned ? 'Unpin' : 'Pin'}
                      onMouseEnter={(e) => {
                        const t = e.target as HTMLElement
                        t.style.opacity = '0.8'; t.style.filter = 'none'
                        t.style.backgroundColor = 'var(--hover-bg)'
                      }}
                      onMouseLeave={(e) => {
                        const t = e.target as HTMLElement
                        if (!isPinned) {
                          t.style.opacity = '0'; t.style.filter = 'grayscale(1)'
                        }
                        t.style.backgroundColor = 'transparent'
                      }}
                    >📌</span>

                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: platDot }} />
                        <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{platLabel}</span>
                      </div>
                      <span className="text-[11px] mr-6" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-subtle)' }}>{timeAgo(topic.last_active)}</span>
                    </div>
                    <h3 className="text-[15px] font-medium group-hover:opacity-90 transition-opacity line-clamp-2 leading-snug" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>
                      {topic.name}
                    </h3>
                    {/* Message preview */}
                    {(() => {
                      const last = topic.messages?.[topic.messages.length - 1]
                      if (!last?.content) return null
                      const clean = last.content.replace(/\[(?:STRIPE|ANTHROPIC|VERCEL|GOOGLE|OPENAI)[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
                      if (!clean) return null
                      const prefix = last.role === 'user' ? 'You: ' : ''
                      return (
                        <p className="text-[12px] line-clamp-1 mt-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text-subtle)' }}>
                          {prefix}{clean.slice(0, 120)}
                        </p>
                      )
                    })()}
                    {/* Status line */}
                    {(() => {
                      const daysSince = (Date.now() / 1000 - topic.last_active) / 86400
                      const isStale = daysSince > 3
                      const isWeekOld = daysSince > 7
                      const hasManyMsgs = topic.message_count_exported > 200
                      let status: string | null = null
                      if (topic.session_count > 1 && hasManyMsgs && !isWeekOld) status = 'Active'
                      else if (isStale && hasManyMsgs) status = 'Needs follow-up'
                      else if (isWeekOld && topic.session_count === 1 && topic.message_count_exported < 10) status = null
                      else if (daysSince > 14) status = null
                      else status = null
                      if (!status) return null
                      const color = status === 'Needs follow-up' ? '#D4A373' : 'var(--text-muted)'
                      return (
                        <span className="text-[10px] mt-1 inline-block" style={{ fontFamily: "'JetBrains Mono', monospace", color }}>
                          {status}
                        </span>
                      )
                    })()}
                    <div className="mt-auto flex items-center gap-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--text-stat)' }}>
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
