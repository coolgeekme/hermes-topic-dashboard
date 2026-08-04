import { useState, useMemo } from 'react'
import { useTopicsData } from './hooks'
import { TopicList } from './components/TopicList'
import { TopicView } from './components/TopicView'
import type { Topic } from './types'

const CATEGORIES = [
  { key: 'recent', label: 'Recent', icon: '🕐', test: (t: Topic) => (Date.now() / 1000 - t.last_active) < 7 * 86400 },
  { key: 'social', label: 'Social', icon: '📱', test: (t: Topic) => /instagram|linkedin|social.media|content|post/i.test(t.name) },
  { key: 'dev', label: 'Dev', icon: '💻', test: (t: Topic) => /github|repo|code|build|app\b|mobile|api|deploy|website/i.test(t.name) },
  { key: 'ai', label: 'AI', icon: '🤖', test: (t: Topic) => /ollama|llm|model|ai\b|agent|hermes|claude|codex|pricing/i.test(t.name) },
  { key: 'personal', label: 'Personal', icon: '🏠', test: (t: Topic) => /email|gmail|calendar|room|clean|buy|purchase|weekend|soccer|kevin|best buy/i.test(t.name) },
  { key: 'all', label: 'All', icon: '', test: () => true },
]

export default function App() {
  const { data, loading, error, refreshing, refresh } = useTopicsData()
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('recent')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  const filteredTopics = useMemo(() => {
    if (!data) return []
    let topics = data.topics

    // Category filter
    const cat = CATEGORIES.find(c => c.key === activeCategory)
    if (cat && cat.key !== 'all') {
      topics = topics.filter(cat.test)
    }

    // Platform filter
    if (platformFilter !== 'all') {
      topics = topics.filter((t) => t.platforms?.includes(platformFilter))
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      topics = topics.filter(
        (t) => t.name.toLowerCase().includes(q) || t.messages.some((m) => m.content?.toLowerCase().includes(q))
      )
    }

    return topics
  }, [data, activeCategory, platformFilter, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[var(--app-height)]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[var(--app-height)] p-6">
        <div className="text-center">
          <p className="text-white/30 text-sm mb-3">Couldn't load conversations</p>
          <button onClick={refresh} className="px-4 py-2 rounded-full bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors">Try Again</button>
        </div>
      </div>
    )
  }

  if (selectedTopic) {
    return <TopicView topic={selectedTopic} onBack={() => setSelectedTopic(null)} />
  }

  return (
    <TopicList
      topics={filteredTopics}
      allTopics={data!.topics}
      search={search}
      searchOpen={searchOpen}
      onSearchChange={setSearch}
      onToggleSearch={() => { setSearchOpen(!searchOpen); setSearch('') }}
      onSelectTopic={setSelectedTopic}
      generatedAt={data?.generated_at}
      refreshing={refreshing}
      onRefresh={refresh}
      platforms={data?.platforms}
      platformFilter={platformFilter}
      onPlatformFilterChange={setPlatformFilter}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      categories={CATEGORIES}
    />
  )
}
