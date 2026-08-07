import { useState, useMemo, useEffect } from 'react'
import { useTopicsData } from './hooks'
import { TopicList } from './components/TopicList'
import { TopicView } from './components/TopicView'
import { Analytics } from './components/Analytics'
import { Sidebar } from './components/Sidebar'
import type { Topic } from './types'

const PINNED_KEY = 'hermes-dashboard-pinned'

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function savePinned(pinned: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify([...pinned]))
}

export default function App() {
  const { data, loading, error, refreshing, refresh } = useTopicsData()
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [search, setSearch] = useState('')
  const [activeNav, setActiveNav] = useState('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [pinned, setPinned] = useState<Set<string>>(loadPinned)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('hermes-dashboard-theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })
  const [viewMode, setViewMode] = useState<'cards' | 'sunburst' | 'mindmap' | 'mesh'>('cards')
  const [page, setPage] = useState<'topics' | 'analytics'>('topics')

  useEffect(() => { savePinned(pinned) }, [pinned])
  useEffect(() => { localStorage.setItem('hermes-dashboard-theme', theme) }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const togglePin = (id: string) => {
    setPinned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const NAV_ITEMS = [
    { key: 'topics', label: 'Topics', icon: 'forum', test: () => true },
    { key: 'analytics', label: 'Analytics', icon: 'bar_chart', test: () => true },
    null, // divider
    { key: 'pinned', label: 'Pinned', icon: 'push_pin', test: (t: Topic) => pinned.has(t.id) },
    { key: 'recent', label: 'Recent', icon: 'history', test: (t: Topic) => (Date.now() / 1000 - t.last_active) < 7 * 86400 },
    { key: 'all', label: 'All', icon: 'select_all', test: () => true },
    { key: 'social', label: 'Social', icon: 'group', test: (t: Topic) => /instagram|linkedin|social.media|content|post/i.test(t.name) },
    { key: 'dev', label: 'Dev', icon: 'code', test: (t: Topic) => /github|repo|code|build|app\b|mobile|api|deploy|website/i.test(t.name) },
    { key: 'ai', label: 'AI', icon: 'smart_toy', test: (t: Topic) => /ollama|llm|model|ai\b|agent|hermes|claude|codex|pricing/i.test(t.name) },
    { key: 'personal', label: 'Personal', icon: 'person', test: (t: Topic) => /email|gmail|calendar|room|clean|buy|purchase|weekend|soccer|kevin|best buy/i.test(t.name) },
  ]

  const filteredTopics = useMemo(() => {
    if (!data) return []
    let topics = data.topics
    const nav = NAV_ITEMS.find(n => n && n.key === activeNav)
    if (nav && nav.key !== 'all' && nav.key !== 'topics' && nav.key !== 'analytics') topics = topics.filter(nav.test)
    if (platformFilter !== 'all') topics = topics.filter((t) => t.platforms?.includes(platformFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      topics = topics.filter((t) => t.name.toLowerCase().includes(q))
    }
    return topics
  }, [data, activeNav, platformFilter, search, pinned])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131315]">
        <div className="w-8 h-8 rounded-full border-2 border-[#444748] border-t-[#e4e2e4] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131315] p-6">
        <div className="text-center">
          <p className="text-[#8e9192] text-sm mb-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Couldn't load conversations</p>
          <button onClick={refresh} className="px-4 py-2 rounded-full bg-[#1f1f21] text-[#e4e2e4] text-sm hover:bg-[#2a2a2c] transition-colors border border-[#444748]/50">Try Again</button>
        </div>
      </div>
    )
  }

  if (selectedTopic) {
    return <TopicView topic={selectedTopic} onBack={() => setSelectedTopic(null)} />
  }

  if (page === 'analytics' && data) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-deep)' }}>
        <Sidebar
          activeNav={activeNav}
          onNavChange={(key: string) => {
            setActiveNav(key)
            if (key === 'topics') setPage('topics')
            if (key === 'analytics') setPage('analytics')
          }}
          navItems={NAV_ITEMS}
          allTopics={data.topics}
          pinned={pinned}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <Analytics topics={data.topics} onSelectTopic={setSelectedTopic} />
      </div>
    )
  }

  return (
    <div className={theme === 'light' ? 'light' : ''}>
    <TopicList
      topics={filteredTopics}
      allTopics={data!.topics}
      search={search}
      onSearchChange={setSearch}
      onSelectTopic={setSelectedTopic}
      refreshing={refreshing}
      onRefresh={refresh}
      platforms={data?.platforms}
      platformFilter={platformFilter}
      onPlatformFilterChange={setPlatformFilter}
      activeNav={activeNav}
      onNavChange={(key: string) => {
        if (key === 'analytics') { setPage('analytics'); setActiveNav('analytics') }
        else if (key === 'topics') { setPage('topics'); setActiveNav('topics') }
        else { setActiveNav(key); if (page !== 'topics') setPage('topics') }
      }}
      navItems={NAV_ITEMS}
      pinned={pinned}
      onTogglePin={togglePin}
      theme={theme}
      onToggleTheme={toggleTheme}
      viewMode={viewMode}
      onToggleView={() => setViewMode(v => v === 'cards' ? 'sunburst' : v === 'sunburst' ? 'mindmap' : v === 'mindmap' ? 'mesh' : 'cards')}
    />
    </div>
  )
}
