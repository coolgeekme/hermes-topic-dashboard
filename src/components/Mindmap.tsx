import { useState, useMemo } from 'react'
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
  other: '#555',
}

function categorize(t: Topic): string {
  if (/instagram|linkedin|social.media|content|post/i.test(t.name)) return 'social'
  if (/github|repo|code|build|app\b|mobile|api|deploy|website/i.test(t.name)) return 'dev'
  if (/ollama|llm|model|ai\b|agent|hermes|claude|codex|pricing/i.test(t.name)) return 'ai'
  if (/email|gmail|calendar|room|clean|buy|purchase|weekend|soccer|kevin|best buy/i.test(t.name)) return 'personal'
  return 'other'
}

function extractKeywords(name: string): string[] {
  // Extract meaningful lowercase words (4+ chars), skip common stopwords
  const stop = new Set(['this','that','with','from','have','been','were','they','them','about','into','over','also','then','than','just','like','some','other','only','more','very','will','what','when','which','would','could','there','their','should','because','through','between'])
  return [...new Set(
    name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stop.has(w))
      .slice(0, 6)
  )]
}

const R = 9 // Node radius
const MIN_EDGE_WEIGHT = 0.15

export function Mindmap({ topics, onSelectTopic }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Precompute once
  const nodes = useMemo(() => {
    if (topics.length === 0) return { nodes: [], edges: [] }
    
    const limit = Math.min(topics.length, 50)
    const sliced = topics.slice(0, limit)
    
    // Extract keywords per topic
    const kwMap = sliced.map(t => extractKeywords(t.name))
    
    // Build edges by Jaccard similarity
    const edges: { from: string; to: string; weight: number }[] = []
    for (let i = 0; i < kwMap.length; i++) {
      for (let j = i + 1; j < kwMap.length; j++) {
        const a = new Set(kwMap[i])
        const b = new Set(kwMap[j])
        if (a.size === 0 || b.size === 0) continue
        const intersection = [...a].filter(x => b.has(x)).length
        const union = a.size + b.size - intersection
        const weight = intersection / union
        if (weight >= MIN_EDGE_WEIGHT) {
          edges.push({ from: sliced[i].id, to: sliced[j].id, weight })
        }
      }
    }

    return { nodes: sliced, edges }
  }, [topics])

  if (nodes.nodes.length === 0) return null

  // Circular layout
  const cx = 280, cy = 280, r = 220
  const positioned = nodes.nodes.map((t, i) => {
    const angle = (i / nodes.nodes.length) * (2 * Math.PI) - Math.PI / 2
    return { ...t, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle }
  })

  // Find connected nodes for hover
  const connectedIds = hovered
    ? new Set(nodes.edges.filter(e => e.from === hovered || e.to === hovered).flatMap(e => [e.from, e.to]))
    : new Set<string>()

  return (
    <div className="flex flex-col items-center py-4">
      <svg width={580} height={580} viewBox="0 0 560 560" className="max-w-full">
        {/* Edges */}
        {nodes.edges.map((e, i) => {
          const from = positioned.find(n => n.id === e.from)
          const to = positioned.find(n => n.id === e.to)
          if (!from || !to) return null
          const active = hovered === e.from || hovered === e.to
          const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2
          return (
            <g key={`e-${i}`}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={CATEGORY_COLORS[categorize(from) as string] || '#555'}
                strokeOpacity={active ? 0.35 : Math.max(0.08, e.weight * 0.3)}
                strokeWidth={active ? 2 : Math.max(0.5, e.weight * 2)}
              />
              {/* Label at midpoint for stronger connections */}
              {hovered && active && (
                <text x={midX} y={midY - 4} textAnchor="middle" fill="var(--text-muted)" fontSize={8} fontFamily="'JetBrains Mono', monospace">
                  {(e.weight * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {positioned.map((t) => {
          const cat = categorize(t)
          const color = CATEGORY_COLORS[cat] || '#555'
          const active = hovered === t.id
          const connected = connectedIds.has(t.id)
          const radius = active ? R + 3 : connected ? R + 1 : R
          const opacity = hovered && !connected ? 0.25 : 1
          const labelX = t.x + (radius + 6) * Math.cos(t.angle)
          const labelY = t.y + (radius + 6) * Math.sin(t.angle)
          const anchor = t.angle > -Math.PI / 2 && t.angle < Math.PI / 2 ? 'start' : 'end'

          return (
            <g
              key={t.id}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s', opacity }}
              onClick={() => onSelectTopic(t)}
              onMouseEnter={() => setHovered(t.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Glow for active */}
              {active && (
                <circle cx={t.x} cy={t.y} r={radius + 4} fill="none" stroke={color} strokeWidth={1} opacity={0.3} />
              )}
              <circle cx={t.x} cy={t.y} r={radius} fill={color} opacity={0.85} />
              <circle cx={t.x} cy={t.y} r={radius} fill="none" stroke="var(--bg)" strokeWidth={1.5} />
              {/* Message count inside */}
              <text x={t.x} y={t.y + 1} textAnchor="middle" fill="#fff" fontSize={R - 1} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
                {Math.min(t.message_count_exported, 99)}
              </text>
              {/* Label */}
              <text
                x={labelX} y={labelY}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={active ? 'var(--text)' : 'var(--text-muted)'}
                fontSize={active ? 11 : 9}
                fontFamily="'Hanken Grotesk', sans-serif"
                fontWeight={active ? 600 : 400}
                className="pointer-events-none"
              >
                {t.name.slice(0, active ? 35 : 20)}{t.name.length > (active ? 35 : 20) ? '...' : ''}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="text-[10px] mt-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
        {nodes.edges.length} connections · hover to explore · click to open
      </p>
    </div>
  )
}
