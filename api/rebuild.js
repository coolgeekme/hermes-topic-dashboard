import { json } from '@vercel/node'

const BLOB_URL = `https://${process.env.BLOB_STORE_ID || 'hermes-dashboard'}.public.blob.vercel-storage.com`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const userId = new URL(req.url).searchParams.get('userId') || 'default'
    
    // Fetch all platform session files from Blob
    const platforms = ['hermes', 'claude-code', 'chatgpt-web', 'claude-web']
    const allSessions = []

    for (const platform of platforms) {
      const fileUrl = `${BLOB_URL}/${userId}/${platform}_sessions.json`
      try {
        const res = await fetch(fileUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            // Normalize platform field
            for (const s of data) {
              s.platform = s.platform || platform
            }
            allSessions.push(...data)
          } else if (data.sessions) {
            for (const s of data.sessions) {
              s.platform = s.platform || platform
            }
            allSessions.push(...data.sessions)
          }
        }
      } catch {}
    }

    if (allSessions.length === 0) {
      return json({ ok: true, topics: 0, sessions: 0 }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Simple topic grouping by title keyword similarity
    const topics = clusterByTitle(allSessions)
    
    const output = {
      generated_at: new Date().toISOString(),
      platforms: [...new Set(allSessions.map(s => s.platform))],
      total_sessions: allSessions.length,
      total_messages_approx: allSessions.reduce((sum, s) => sum + (s.message_count || 0), 0),
      topics: topics.slice(0, 100),
    }

    // Upload unified topics to Blob
    const putUrl = `${BLOB_URL}/${userId}/unified_topics.json`
    await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-blob-access': 'public',
      },
      body: JSON.stringify(output)
    })

    return json({ ok: true, topics: topics.length, sessions: allSessions.length }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch (e) {
    return json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

// Simple title-based clustering
function clusterByTitle(sessions) {
  const groups = new Map()
  
  for (const s of sessions) {
    const title = (s.title || 'Untitled').toLowerCase()
    // Group by platform + first 3 words
    const key = `${s.platform}:${title.split(/\s+/).slice(0, 3).join(' ')}`
    
    if (!groups.has(key)) {
      groups.set(key, {
        name: s.title || 'Untitled',
        platforms: [s.platform],
        sessions: [],
        message_count: 0,
      })
    }
    
    const g = groups.get(key)
    g.sessions.push(s)
    g.message_count += s.message_count || 0
  }

  return Array.from(groups.values()).map(g => ({
    id: g.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40),
    name: g.name.slice(0, 80),
    platforms: [...new Set(g.platforms.map(s => s.platform))],
    session_count: g.sessions.length,
    message_count: g.message_count,
    message_count_exported: Math.min(g.sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0), 500),
    last_active: g.sessions.reduce((max, s) => Math.max(max, new Date(s.last_active || 0).getTime() / 1000), 0),
    last_active_iso: new Date().toISOString(),
    messages: g.sessions.flatMap(s => (s.messages || []).map(m => ({
      role: m.role || 'user',
      content: (m.content || '').slice(0, 4000),
      timestamp: m.timestamp || null,
      session_id: s.id,
      platform: s.platform,
    }))).slice(-500),
    is_cron: false,
  })).sort((a, b) => b.last_active - a.last_active)
}
