interface NavItem { key: string; label: string; icon: string; test: (...args: any[]) => boolean }

interface Props {
  activeNav: string
  onNavChange: (key: string) => void
  navItems: (NavItem | null)[]
  allTopics: any[]
  pinned: Set<string>
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const Icons: Record<string, string> = {
  select_all: '☰', history: '◷', group: '👥', code: '</>', smart_toy: '◆', person: '●',
  search: '⌕', refresh: '↻', push_pin: '📌', forum: '💬', bar_chart: '📊',
  folder: '📁', bookmarks: '📚', settings: '⚙', help: '?',
}

export function Sidebar({ activeNav, onNavChange, navItems, allTopics, pinned, theme, onToggleTheme }: Props) {
  return (
    <nav className="w-64 flex-shrink-0 flex flex-col px-6 py-6" style={{ backgroundColor: 'var(--bg-nav)', borderRight: '1px solid var(--border)' }}>
      <div className="mb-8">
        <h1 className="text-[18px] font-bold tracking-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#d2bbff' }}>主控台</h1>
        <p className="text-[11px] mt-1" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>專業工作區</p>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        {navItems.map((item, i) => {
          if (!item) return <div key={`div-${i}`} className="h-px my-2" style={{ backgroundColor: 'var(--divider)' }} />
          const active = activeNav === item.key
          const count = item.key === 'all' ? allTopics.length
            : item.key === 'pinned' ? pinned.size
            : item.key === 'topics' || item.key === 'analytics' ? null
            : allTopics.filter(item.test).length
          return (
            <button
              key={item.key}
              onClick={() => onNavChange(item.key)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] transition-all text-left"
              style={{
                fontFamily: "'Geist', monospace",
                color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
                fontWeight: active ? 700 : 400,
                transform: active ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span className="text-[15px] w-5 text-center opacity-70">{Icons[item.icon] || '○'}</span>
              <span className="flex-1">{item.label}</span>
              {count != null && count > 0 && (
                <span style={{ opacity: 0.4, fontSize: '10px' }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-1 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] transition-colors text-left"
          style={{ fontFamily: "'Geist', monospace", color: 'var(--sidebar-text)' }}
        >
          <span className="text-[15px] w-5 text-center">{theme === 'dark' ? '☀' : '🌙'}</span>
          <span>{theme === 'dark' ? '淺色' : '深色'}</span>
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] transition-colors text-left"
          style={{ fontFamily: "'Geist', monospace", color: 'var(--sidebar-text)' }}>
          <span className="text-[15px] w-5 text-center">⚙</span>
          <span>設定</span>
        </button>
      </div>
    </nav>
  )
}
