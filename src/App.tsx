import { useState, useMemo } from 'react'
import { useTopicsData } from './hooks'
import { TopicList } from './components/TopicList'
import { TopicView } from './components/TopicView'
import type { Topic } from './types'

const CATEGORY_RULES: { name: string; icon: string; pattern: RegExp }[] = [
  { name: 'Social & Content', icon: '📱', pattern: /instagram|linkedin|social.media|content|post|facebook|tweet|thread/i },
  { name: 'Development', icon: '💻', pattern: /github|repo|code|build|app\b|mobile|api|cli|server|deploy|website|calculator/i },
  { name: 'AI & Models', icon: '🤖', pattern: /ollama|llm|model|ai\b|agent|hermes|claude|codex|gpt|openai|pricing/i },
  { name: 'Communication', icon: '📧', pattern: /email|gmail|calendar|message|imessage|contact|connect/i },
  { name: 'Personal', icon: '🏠', pattern: /room|clean|buy|purchase|weekend|soccer|enzo|prescott|best buy|laptop/i },
  { name: 'System', icon: '⚙️', pattern: /cron|dashboard|export|test|console|deploy|service.worker|system.check/i },
]

function categorize(topic: Topic): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(topic.name)) return rule.name
  }
  return 'Other'
}

export default function App() {
  const { data, loading, error, refreshing, refresh } = useTopicsData()
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [compact, setCompact] = useState(false)

  const filteredTopics = useMemo(() => {
    if (!data) return []
    let topics = data.topics
    if (platformFilter !== 'all') {
      topics = topics.filter((t) => t.platforms?.includes(platformFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      topics = topics.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.messages.some((m) => m.content?.toLowerCase().includes(q))
      )
    }
    return topics
  }, [data, search, platformFilter])

  // Group by category
  const categorized = useMemo(() => {
    const cats: { name: string; icon: string; topics: Topic[] }[] = []
    const catMap = new Map<string, Topic[]>()
    for (const t of filteredTopics) {
      const cat = categorize(t)
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)!.push(t)
    }
    // Order: predefined categories first, then "Other"
    const order = [...CATEGORY_RULES.map(r => r.name), 'Other']
    for (const name of order) {
      const topics = catMap.get(name)
      if (topics && topics.length > 0) {
        const icon = CATEGORY_RULES.find(r => r.name === name)?.icon || '📌'
        cats.push({ name, icon, topics })
      }
    }
    return cats
  }, [filteredTopics])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[var(--app-height)]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm">Loading conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[var(--app-height)] p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold mb-2">Failed to load</h2>
          <p className="text-white/50 text-sm mb-4">{error}</p>
          <button onClick={refresh} className="px-4 py-2 bg-accent-cyan/10 text-accent-cyan rounded-lg border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-colors text-sm">Try Again</button>
        </div>
      </div>
    )
  }

  if (selectedTopic) {
    return <TopicView topic={selectedTopic} onBack={() => setSelectedTopic(null)} />
  }

  return (
    <TopicList
      categorized={categorized}
      allTopics={filteredTopics}
      search={search}
      onSearchChange={setSearch}
      onSelectTopic={setSelectedTopic}
      generatedAt={data?.generated_at}
      refreshing={refreshing}
      onRefresh={refresh}
      totalTopics={data?.topics.length}
      platforms={data?.platforms}
      platformFilter={platformFilter}
      onPlatformFilterChange={setPlatformFilter}
      compact={compact}
      onToggleCompact={() => setCompact(!compact)}
    />
  )
}
