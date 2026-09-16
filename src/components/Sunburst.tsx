import type { Topic } from '../types'

interface Props {
  topics: Topic[]
  onSelectTopic: (t: Topic) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  social: '#3e90ff',
  dev: '#aac7ff',
  ai: '#70ff76',
  personal: '#D4A373',
  other: '#444748',
}

const CATEGORY_LABELS: Record<string, string> = {
  social: '社群',
  dev: '開發',
  ai: 'AI',
  personal: '個人',
  other: '其他',
}

function categorize(t: Topic): string {
  if (/instagram|linkedin|social.media|content|post/i.test(t.name)) return 'social'
  if (/github|repo|code|build|app\b|mobile|api|deploy|website/i.test(t.name)) return 'dev'
  if (/ollama|llm|model|ai\b|agent|hermes|claude|codex|pricing/i.test(t.name)) return 'ai'
  if (/email|gmail|calendar|room|clean|buy|purchase|weekend|soccer|kevin|best buy/i.test(t.name)) return 'personal'
  return 'other'
}

export function Sunburst({ topics, onSelectTopic }: Props) {
  if (topics.length === 0) return null

  // Group by category
  const groups: Record<string, Topic[]> = {}
  for (const t of topics) {
    const cat = categorize(t)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(t)
  }

  const cats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  const totalMsgs = topics.reduce((s, t) => s + t.message_count_exported, 0)

  const cx = 180, cy = 180, outerR = 160, innerR = 60
  const size = 380

  // Compute arcs for outer ring (categories)
  let catStart = -Math.PI / 2
  const catArcs: { cat: string; topics: Topic[]; start: number; end: number }[] = []
  for (const [cat, catTopics] of cats) {
    const angle = (catTopics.length / topics.length) * (2 * Math.PI)
    catArcs.push({ cat, topics: catTopics, start: catStart, end: catStart + angle })
    catStart += angle
  }

  function arcPath(cx: number, cy: number, r1: number, r2: number, startAngle: number, endAngle: number): string {
    const x1 = cx + r1 * Math.cos(startAngle)
    const y1 = cy + r1 * Math.sin(startAngle)
    const x2 = cx + r2 * Math.cos(startAngle)
    const y2 = cy + r2 * Math.sin(startAngle)
    const x3 = cx + r2 * Math.cos(endAngle)
    const y3 = cy + r2 * Math.sin(endAngle)
    const x4 = cx + r1 * Math.cos(endAngle)
    const y4 = cy + r1 * Math.sin(endAngle)
    const large = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 ${large} 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 ${large} 0 ${x1} ${y1} Z`
  }

  return (
    <div className="flex flex-col items-center py-8">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring: Categories */}
        {catArcs.map(({ cat, topics: catTopics, start, end }) => (
          <g key={cat}>
            <path
              d={arcPath(cx, cy, innerR, outerR, start, end)}
              fill={CATEGORY_COLORS[cat] || 'var(--card-border)'}
              opacity={0.7}
              stroke="var(--bg)"
              strokeWidth={1.5}
            />
            {/* Category label */}
            <text
              x={cx + (innerR + outerR) / 2 * Math.cos((start + end) / 2)}
              y={cy + (innerR + outerR) / 2 * Math.sin((start + end) / 2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={catTopics.length > 3 ? 12 : 10}
              fontFamily="'Hanken Grotesk', sans-serif"
              fontWeight={600}
            >
              {CATEGORY_LABELS[cat] || cat}
            </text>
          </g>
        ))}

        {/* Inner ring: Topic arcs */}
        {catArcs.map(({ cat, topics: catTopics, start, end }) => {
          const catAngle = end - start
          let topicStart = start
          return catTopics.slice(0, 15).map((topic, i) => {
            const topicAngle = (catAngle / catTopics.length)
            const topicEnd = topicStart + topicAngle
            // Add slight gap between topics
            const gap = 0.02
            const actualStart = topicStart + gap
            const actualEnd = topicEnd - gap
            const el = (
              <g key={topic.id} style={{ cursor: 'pointer' }} onClick={() => onSelectTopic(topic)}>
                <path
                  d={arcPath(cx, cy, 30, innerR, actualStart, actualEnd)}
                  fill={CATEGORY_COLORS[cat] || '#666'}
                  opacity={0.5}
                  stroke="var(--bg)"
                  strokeWidth={1}
                />
                <title>{topic.name}</title>
              </g>
            )
            topicStart = topicEnd
            return el
          })
        })}

        {/* Center circle */}
        <circle cx={cx} cy={cy} r={28} fill="var(--bg)" stroke="var(--card-border)" strokeWidth={1} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize={14} fontFamily="'Hanken Grotesk', sans-serif" fontWeight={600}>
          {topics.length}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="'JetBrains Mono', monospace">
          主題
        </text>
      </svg>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {cats.map(([cat, catTopics]) => (
          <div key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#666' }} />
            <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              {CATEGORY_LABELS[cat] || cat} ({catTopics.length})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
