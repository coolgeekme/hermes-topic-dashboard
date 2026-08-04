import { useState, useMemo } from 'react'
import { useTopicsData } from './hooks'
import { TopicList } from './components/TopicList'
import { TopicView } from './components/TopicView'
import type { Topic } from './types'

export default function App() {
  const { data, loading, error, refreshing, refresh } = useTopicsData()
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [search, setSearch] = useState('')

  const filteredTopics = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.topics
    const q = search.toLowerCase()
    return data.topics.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.messages.some(
          (m) => m.content?.toLowerCase().includes(q)
        )
    )
  }, [data, search])

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
          <button
            onClick={refresh}
            className="px-4 py-2 bg-accent-cyan/10 text-accent-cyan rounded-lg border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (selectedTopic) {
    return (
      <TopicView
        topic={selectedTopic}
        onBack={() => setSelectedTopic(null)}
      />
    )
  }

  return (
    <TopicList
      topics={filteredTopics}
      search={search}
      onSearchChange={setSearch}
      onSelectTopic={setSelectedTopic}
      generatedAt={data?.generated_at}
      refreshing={refreshing}
      onRefresh={refresh}
      totalTopics={data?.topics.length}
    />
  )
}
