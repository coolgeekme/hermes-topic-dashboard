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
