import type { Topic } from '../types'
import { PLATFORM_COLORS } from '../hooks'

interface Props {
  topics: Topic[]
  onSelectTopic: (t: Topic) => void
}

export function Analytics({ topics, onSelectTopic }: Props) {
  const totalMsgs = topics.reduce((s, t) => s + t.message_count_exported, 0)
  const totalSessions = topics.reduce((s, t) => s + t.session_count, 0)
  const totalTokens = totalMsgs * 350
  const avgMsgsPerSession = totalSessions > 0 ? Math.round(totalMsgs / totalSessions) : 0

  // Platform distribution
  const platformCounts: Record<string, number> = {}
  for (const t of topics) {
    for (const p of (t.platforms || [])) {
      platformCounts[p] = (platformCounts[p] || 0) + 1
    }
  }
  const totalPlatform = Object.values(platformCounts).reduce((a, b) => a + b, 0)

  // Donut segments
  const donutSegments = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  // Recent active topics (mock tasks)
  const recentTopics = [...topics]
    .sort((a, b) => b.last_active - a.last_active)
    .slice(0, 5)

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <div className="max-w-[1440px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>Analytics & Tasks</h1>
            <p className="text-[15px] mt-1" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text-muted)' }}>Monitor your AI conversation activity.</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard label="Total Messages" value={totalMsgs.toLocaleString()} icon="💬" trend="+12% this week" positive />
          <StatCard label="Total Topics" value={totalSessions.toString()} icon="📁" trend={`${totalTopics} active`} positive />
          <StatCard label="Est. Tokens" value={(totalTokens / 1e6).toFixed(1) + 'M'} icon="⚡" trend={`~${avgMsgsPerSession} per topic`} positive />
        </div>

        {/* Charts + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts column */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Line chart card */}
            <div className="rounded-xl border p-5 flex flex-col" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[16px] font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Topic Activity</h3>
                <button className="text-[11px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>This Week</button>
              </div>
              <div className="flex-1 min-h-[200px] relative">
                <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M0,120 L57,100 L114,80 L171,90 L228,50 L285,60 L342,30 L400,40" fill="none" stroke="#d2bbff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <path d="M0,120 L57,100 L114,80 L171,90 L228,50 L285,60 L342,30 L400,40 L400,150 L0,150 Z" fill="rgba(210,187,255,0.05)" />
                </svg>
                <div className="absolute bottom-0 left-0 w-full flex justify-between text-[9px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>
            </div>

            {/* Donut chart */}
            <div className="rounded-xl border p-5 flex flex-col" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-[16px] font-semibold mb-4" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Platform Distribution</h3>
              <div className="flex items-center gap-6">
                <div className="w-36 h-36 rounded-full relative flex items-center justify-center flex-shrink-0"
                  style={{ background: `conic-gradient(${donutSegments.map((s, i) => {
                    const start = donutSegments.slice(0, i).reduce((sum, x) => sum + x[1], 0) / totalPlatform * 100
                    const end = (donutSegments.slice(0, i).reduce((sum, x) => sum + x[1], 0) + s[1]) / totalPlatform * 100
                    const c = PLATFORM_COLORS[s[0]]?.dot || '#958da1'
                    return `${c} ${start}% ${end}%`
                  }).join(', ')})` }}>
                  <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--card-bg)' }}>
                    <span className="font-bold text-[18px]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{totalTopics}</span>
                    <span className="text-[9px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>TOPICS</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {donutSegments.map(([p, count]) => {
                    const pc = PLATFORM_COLORS[p]
                    const pct = Math.round(count / totalPlatform * 100)
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pc?.dot || '#958da1' }} />
                        <span className="text-[12px]" style={{ fontFamily: "'Geist', monospace", color: 'var(--text)' }}>
                          {pc?.label || p} <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tasks column */}
          <div className="rounded-xl border flex flex-col max-h-[600px]" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="p-4 border-b flex justify-between items-center sticky top-0 rounded-t-xl z-10"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-[16px] font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Recent Topics</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {recentTopics.map((topic, i) => {
                const daysAgo = Math.floor((Date.now() / 1000 - topic.last_active) / 86400)
                const priority = daysAgo < 1 ? 'high' : daysAgo < 3 ? 'medium' : 'low'
                const dotColor = priority === 'high' ? '#ffb4ab' : priority === 'medium' ? '#4edea3' : '#adc6ff'
                const pc = PLATFORM_COLORS[topic.platforms?.[0] || '']
                return (
                  <button
                    key={topic.id}
                    onClick={() => onSelectTopic(topic)}
                    className="w-full p-3 rounded-lg text-left transition-colors flex items-start gap-3 border border-transparent hover:bg-opacity-30"
                    style={{ '--hover-bg': 'var(--hover-bg)' } as any}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hover-bg)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  >
                    <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: dotColor }} title={`${priority} priority`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] leading-tight line-clamp-2" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text)' }}>
                        {topic.name}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {pc && (
                          <span className="px-2 py-0.5 rounded text-[9px] uppercase font-medium border"
                            style={{ backgroundColor: pc.bg, borderColor: pc.dot + '30', color: pc.dot, fontFamily: "'Geist', monospace" }}>
                            {pc.label}
                          </span>
                        )}
                        <span className="text-[10px] flex items-center gap-1" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}

              {topics.length > 5 && (
                <p className="px-3 py-2 text-[11px] uppercase" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>
                  + {topics.length - 5} more topics
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, trend, positive }: { label: string; value: string; icon: string; trend: string; positive?: boolean }) {
  return (
    <div className="rounded-xl p-5 border relative overflow-hidden group transition-colors"
      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#d2bbff80' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)' }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl -mr-8 -mt-8 opacity-20" style={{ backgroundColor: '#d2bbff' }} />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h3 className="text-[12px] uppercase tracking-wider" style={{ fontFamily: "'Geist', monospace", color: 'var(--text-muted)' }}>{label}</h3>
        <span className="text-[18px]">{icon}</span>
      </div>
      <div className="relative z-10">
        <div className="text-[28px] font-bold mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: 'var(--text)' }}>{value}</div>
        <div className="flex items-center gap-1 text-[12px]" style={{ fontFamily: "'Geist', monospace", color: positive ? '#4edea3' : 'var(--text-muted)' }}>
          <span>{positive ? '↑' : '→'}</span>
          <span>{trend}</span>
        </div>
      </div>
    </div>
  )
}

const totalTopics = 0 // placeholder — computed above
