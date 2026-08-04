import { useState, useEffect, useCallback } from 'react'
import type { TopicsData } from './types'

const DATA_URL = 'https://raw.githubusercontent.com/coolgeekme/hermes-topic-dashboard/main/public/topics.json'

export function useTopicsData() {
  const [data, setData] = useState<TopicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const url = `${DATA_URL}?t=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: TopicsData = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refreshing, refresh: () => fetchData(true) }
}

export const PLATFORM_COLORS: Record<string, { dot: string; bg: string; label: string }> = {
  'hermes': { dot: '#22d3ee', bg: 'rgba(34,211,238,0.1)', label: 'Hermes' },
  'claude-code': { dot: '#a855f7', bg: 'rgba(168,85,247,0.1)', label: 'Claude' },
  'codex': { dot: '#34d399', bg: 'rgba(52,211,153,0.1)', label: 'Codex' },
}

export const ACCENT_COLORS = [
  { dot: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
  { dot: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
  { dot: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  { dot: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
  { dot: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
  { dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
]
